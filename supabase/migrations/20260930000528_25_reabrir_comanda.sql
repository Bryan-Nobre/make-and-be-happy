-- ============================================================
-- 25. Reabrir comanda e motivo do cancelamento na reversão de estoque
-- ============================================================

-- ------------------------------------------------------------
-- reabrir_comanda: comanda que pediu a conta (ou já quitada) volta a
-- aceitar pedidos. Pagamentos continuam vinculados e o saldo é o mesmo.
-- ------------------------------------------------------------
create or replace function public.reabrir_comanda(p_comanda uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comanda public.comandas;
begin
  v_comanda := app.comanda_acessivel(p_comanda);
  perform app.exigir_papel(v_comanda.empresa_id,
    array['owner', 'admin', 'cashier', 'waiter']::public.papel_usuario[]);

  if v_comanda.status not in ('PAYMENT_PENDING', 'PAID') then
    raise exception 'A comanda #% não está aguardando pagamento.', v_comanda.numero;
  end if;

  update public.comandas
  set status = 'OPEN', conta_pedida_em = null
  where id = p_comanda;

  perform app.registrar_auditoria(
    v_comanda.empresa_id, 'comanda.reaberta', 'comandas', p_comanda::text,
    jsonb_build_object(
      'comanda', v_comanda.numero,
      'status_anterior', v_comanda.status,
      'valor_pago', v_comanda.valor_pago
    )
  );
end;
$$;

revoke execute on function public.reabrir_comanda(uuid) from public, anon;
grant execute on function public.reabrir_comanda(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- Só a comanda que pediu a conta vira PAID automaticamente. Uma comanda
-- aberta (inclusive reaberta) e quitada continua aceitando pedidos; o
-- saldo zero já é suficiente para liberar a mesa.
-- ------------------------------------------------------------
create or replace function app.recalcular_comanda_paga(p_comanda uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comanda public.comandas;
  v_pago numeric(12, 2);
  v_subtotal numeric(12, 2);
  v_total numeric(12, 2);
  v_liquido numeric(12, 2);
  v_aplicar numeric(12, 2);
  v_pedido record;
begin
  select * into v_comanda from public.comandas where id = p_comanda for update;
  if not found then
    return;
  end if;

  select coalesce(sum(valor), 0) into v_pago
  from public.pagamentos
  where comanda_id = p_comanda and status = 'CONFIRMADO';

  select coalesce(sum(total), 0) into v_subtotal
  from public.pedidos
  where comanda_id = p_comanda and status_operacional <> 'CANCELLED';

  v_total := v_subtotal + round(v_subtotal * v_comanda.taxa_servico_percentual / 100, 2);

  if v_pago > v_total then
    raise exception 'O valor já pago na comanda #% (%) passaria do total da conta (%).',
      v_comanda.numero, app.brl(v_pago), app.brl(v_total);
  end if;

  v_liquido := case
    when v_total = 0 then 0
    when v_pago >= v_total then v_subtotal
    else round(v_pago * v_subtotal / v_total, 2)
  end;

  for v_pedido in
    select id, total, status_financeiro
    from public.pedidos
    where comanda_id = p_comanda and status_operacional <> 'CANCELLED'
    order by criado_em, id
  loop
    v_aplicar := least(v_pedido.total, v_liquido);
    update public.pedidos
    set valor_pago = v_aplicar
    where id = v_pedido.id and valor_pago <> v_aplicar;
    v_liquido := v_liquido - v_aplicar;
  end loop;

  update public.comandas
  set valor_pago = v_pago,
      status = case
        when status = 'PAYMENT_PENDING' and v_total > 0 and v_pago >= v_total
          then 'PAID'::public.status_comanda
        when status = 'PAID' and v_pago < v_total
          then 'PAYMENT_PENDING'::public.status_comanda
        else status
      end
  where id = p_comanda
    and (valor_pago <> v_pago or status in ('OPEN', 'PAYMENT_PENDING', 'PAID'));
end;
$$;

-- ------------------------------------------------------------
-- Reversão de estoque: quando o pedido foi cancelado, a movimentação de
-- entrada leva o motivo do cancelamento. A saída original não é tocada.
-- ------------------------------------------------------------
create or replace function app.sincronizar_estoque_item(
  p_item_pedido uuid,
  p_empresa uuid,
  p_pedido uuid,
  p_produto uuid,
  p_unidades numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_numero bigint;
  v_status public.status_operacional_pedido;
  v_motivo_cancelamento text;
  v_alvo numeric(14, 3);
  v_consumido numeric(14, 3);
  v_delta numeric(14, 3);
begin
  select numero, status_operacional, motivo_cancelamento
  into v_numero, v_status, v_motivo_cancelamento
  from public.pedidos where id = p_pedido;

  for r in
    select i.item_id, coalesce(pi.quantidade, 0) as por_unidade
    from (
      select pi2.item_id from public.produto_insumos pi2 where pi2.produto_id = p_produto
      union
      select m.item_id from public.movimentacoes_estoque m where m.item_pedido_id = p_item_pedido
    ) i
    left join public.produto_insumos pi
      on pi.produto_id = p_produto and pi.item_id = i.item_id
    order by i.item_id
  loop
    v_alvo := round(r.por_unidade * coalesce(p_unidades, 0), 3);

    select coalesce(-sum(m.variacao), 0) into v_consumido
    from public.movimentacoes_estoque m
    where m.item_pedido_id = p_item_pedido and m.item_id = r.item_id;

    v_delta := v_alvo - v_consumido;

    if v_delta > 0 then
      perform app.aplicar_movimento_estoque(
        p_empresa, r.item_id, 'SAIDA', 'PEDIDO', -v_delta,
        format('Venda do pedido #%s', v_numero), null, p_pedido, p_item_pedido
      );
    elsif v_delta < 0 and v_status = 'CANCELLED' then
      perform app.aplicar_movimento_estoque(
        p_empresa, r.item_id, 'ENTRADA', 'PEDIDO', -v_delta,
        format('Cancelamento do pedido #%s', v_numero),
        left(v_motivo_cancelamento, 500), p_pedido, p_item_pedido
      );
    elsif v_delta < 0 then
      perform app.aplicar_movimento_estoque(
        p_empresa, r.item_id, 'ENTRADA', 'PEDIDO', -v_delta,
        format('Devolução do pedido #%s', v_numero), null, p_pedido, p_item_pedido
      );
    end if;
  end loop;
end;
$$;
