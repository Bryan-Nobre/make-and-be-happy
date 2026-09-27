-- Ajustes: marcas de tempo também no insert e leitura segura de
-- NEW/OLD no gatilho de itens (NEW não existe em DELETE).

create or replace function app.tg_pedido_consistencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric(12, 2);
begin
  v_total := new.subtotal - new.desconto + new.acrescimo;

  if tg_op = 'UPDATE' then
    if not app.transicao_operacional_valida(old.status_operacional, new.status_operacional) then
      raise exception 'Não é possível mudar o pedido de % para %.',
        app.rotulo_status(old.status_operacional), app.rotulo_status(new.status_operacional);
    end if;

    if new.status_operacional = 'CANCELLED'
       and old.status_operacional <> 'CANCELLED'
       and old.valor_pago > 0 then
      raise exception 'Este pedido já tem pagamento registrado. Faça o estorno antes de cancelar.';
    end if;

    if old.status_financeiro = 'REFUNDED' and new.status_financeiro <> 'REFUNDED' then
      raise exception 'Pedido estornado não volta a ficar em aberto.';
    end if;

    if old.status_operacional in ('DELIVERED', 'CANCELLED')
       and (old.subtotal <> new.subtotal
            or old.desconto <> new.desconto
            or old.acrescimo <> new.acrescimo) then
      raise exception 'Pedido % não pode mais ter os valores alterados.',
        app.rotulo_status(old.status_operacional);
    end if;
  end if;

  -- Marca o momento de cada etapa, inclusive quando o pedido já nasce
  -- confirmado (envio direto do PDV para a cozinha).
  if tg_op = 'INSERT' or new.status_operacional <> old.status_operacional then
    if new.status_operacional = 'CONFIRMED' then
      new.confirmado_em := coalesce(new.confirmado_em, now());
    elsif new.status_operacional = 'PREPARING' then
      new.preparo_em := coalesce(new.preparo_em, now());
    elsif new.status_operacional = 'READY' then
      new.pronto_em := coalesce(new.pronto_em, now());
    elsif new.status_operacional = 'DELIVERED' then
      new.entregue_em := coalesce(new.entregue_em, now());
    elsif new.status_operacional = 'CANCELLED' then
      new.cancelado_em := coalesce(new.cancelado_em, now());
    end if;
  end if;

  if new.valor_pago > v_total then
    raise exception 'O valor pago não pode passar do total do pedido.';
  end if;

  if new.status_financeiro <> 'REFUNDED' then
    new.status_financeiro := case
      when new.valor_pago <= 0 then 'UNPAID'
      when new.valor_pago >= v_total then 'PAID'
      else 'PARTIALLY_PAID'
    end;
  end if;

  return new;
end;
$$;

create or replace function app.tg_item_protegido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido record;
  v_pedido_id uuid;
  v_item_id uuid;
  v_nome text;
  v_qtd_antes numeric(12, 3);
  v_qtd_depois numeric(12, 3);
  v_acao text;
begin
  if tg_op = 'DELETE' then
    v_pedido_id := old.pedido_id;
    v_item_id := old.id;
    v_nome := old.nome_produto;
    v_qtd_antes := old.quantidade;
    v_acao := 'pedido.item_removido_apos_envio';
  elsif tg_op = 'INSERT' then
    v_pedido_id := new.pedido_id;
    v_item_id := new.id;
    v_nome := new.nome_produto;
    v_qtd_depois := new.quantidade;
    v_acao := 'pedido.item_adicionado_apos_envio';
  else
    -- Atualizações internas (total de adicionais, marca de envio) passam direto.
    if old.quantidade = new.quantidade
       and old.preco_unitario = new.preco_unitario
       and old.produto_id = new.produto_id
       and coalesce(old.observacoes, '') = coalesce(new.observacoes, '') then
      return new;
    end if;
    v_pedido_id := new.pedido_id;
    v_item_id := new.id;
    v_nome := new.nome_produto;
    v_qtd_antes := old.quantidade;
    v_qtd_depois := new.quantidade;
    v_acao := 'pedido.item_alterado_apos_envio';
  end if;

  select p.status_operacional, p.status_financeiro, p.numero, p.empresa_id
  into v_pedido
  from public.pedidos p
  where p.id = v_pedido_id;

  if not found then
    -- Pedido sendo removido em cascata: nada a validar.
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if v_pedido.status_operacional in ('DELIVERED', 'CANCELLED') then
    raise exception 'O pedido #% já está % e não aceita mais mudança de itens.',
      v_pedido.numero, app.rotulo_status(v_pedido.status_operacional);
  end if;

  if v_pedido.status_financeiro in ('PAID', 'REFUNDED') then
    raise exception 'O pedido #% já foi pago. Itens não podem mais ser alterados.',
      v_pedido.numero;
  end if;

  if v_pedido.status_operacional <> 'DRAFT' then
    perform app.registrar_auditoria(
      v_pedido.empresa_id, v_acao, 'itens_pedido', v_item_id::text,
      jsonb_build_object(
        'pedido', v_pedido.numero,
        'produto', v_nome,
        'quantidade_antes', v_qtd_antes,
        'quantidade_depois', v_qtd_depois
      )
    );
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
