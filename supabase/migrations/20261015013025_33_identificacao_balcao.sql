-- ============================================================
-- 33. Nome para chamar no pedido de balcão
--
-- - pedidos.identificacao: nome curto digitado no balcão para chamar o
--   cliente quando o pedido ficar pronto. Só existe em pedido de balcão
--   (constraint) e não substitui o cadastro de cliente.
-- - criar_pedido aceita p_identificacao. Preço, estoque, permissão e
--   idempotência continuam iguais à migration 31.
-- - painel_cozinha devolve a identificação (sem nenhum valor).
-- ============================================================

alter table public.pedidos
  add column identificacao text,
  add constraint pedidos_identificacao_tamanho
    check (identificacao is null or char_length(identificacao) between 1 and 40),
  add constraint pedidos_identificacao_so_balcao
    check (identificacao is null or origem = 'BALCAO');

-- ------------------------------------------------------------
-- criar_pedido com identificação. A assinatura muda, então a antiga sai.
-- ------------------------------------------------------------
drop function if exists public.criar_pedido(
  uuid, public.origem_pedido, jsonb, uuid, boolean, numeric, numeric, text, uuid, uuid
);

create function public.criar_pedido(
  p_empresa uuid,
  p_origem public.origem_pedido,
  p_itens jsonb,
  p_comanda uuid default null,
  p_confirmar boolean default true,
  p_desconto numeric default 0,
  p_acrescimo numeric default 0,
  p_observacoes text default null,
  p_client_request_id uuid default null,
  p_cliente uuid default null,
  p_identificacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_papel public.papel_usuario;
  v_pedido uuid;
  v_comanda record;
  v_cliente uuid := p_cliente;
  v_subtotal numeric(12, 2);
  v_desconto numeric(12, 2) := round(coalesce(p_desconto, 0), 2);
  v_acrescimo numeric(12, 2) := round(coalesce(p_acrescimo, 0), 2);
  v_identificacao text := nullif(btrim(coalesce(p_identificacao, '')), '');
begin
  v_papel := app.exigir_papel(p_empresa, array['owner', 'admin', 'cashier', 'waiter']::public.papel_usuario[]);

  -- Reenvio da mesma requisição devolve o pedido já criado (PRD 22).
  if p_client_request_id is not null then
    select id into v_pedido
    from public.pedidos
    where empresa_id = p_empresa and client_request_id = p_client_request_id;
    if found then
      return v_pedido;
    end if;
  end if;

  if v_desconto < 0 or v_acrescimo < 0 then
    raise exception 'Desconto e acréscimo não podem ser negativos.';
  end if;

  if (v_desconto > 0 or v_acrescimo > 0)
     and v_papel not in ('owner', 'admin', 'cashier') then
    raise exception 'Seu perfil não pode aplicar desconto ou acréscimo.';
  end if;

  if v_identificacao is not null then
    if p_origem <> 'BALCAO' then
      raise exception 'O nome para chamar só vale para pedido de balcão.';
    end if;
    if char_length(v_identificacao) > 40 then
      raise exception 'O nome para chamar pode ter no máximo 40 caracteres.';
    end if;
  end if;

  perform app.validar_cliente(p_empresa, p_cliente);

  if p_origem = 'MESA' then
    if p_comanda is null then
      raise exception 'Escolha a comanda para lançar o pedido.';
    end if;

    select id, numero, status, cliente_id into v_comanda
    from public.comandas
    where empresa_id = p_empresa and id = p_comanda
    for update;

    if not found then
      raise exception 'Comanda não encontrada.';
    end if;
    if v_comanda.status not in ('OPEN', 'PAYMENT_PENDING') then
      raise exception 'A comanda #% não está aberta.', v_comanda.numero;
    end if;

    v_cliente := coalesce(p_cliente, v_comanda.cliente_id);
  elsif p_comanda is not null then
    raise exception 'Pedido de balcão não usa comanda.';
  end if;

  insert into public.pedidos (
    empresa_id, numero, origem, comanda_id, cliente_id, observacoes, identificacao,
    criado_por, client_request_id
  )
  values (
    p_empresa,
    app.proximo_numero(p_empresa, 'PEDIDO'),
    p_origem,
    p_comanda,
    v_cliente,
    nullif(btrim(coalesce(p_observacoes, '')), ''),
    v_identificacao,
    app.membro_atual(p_empresa),
    p_client_request_id
  )
  returning id into v_pedido;

  perform app.inserir_itens(p_empresa, v_pedido, p_itens, p_confirmar);

  select subtotal into v_subtotal from public.pedidos where id = v_pedido;

  if v_desconto > v_subtotal then
    raise exception 'O desconto não pode passar do subtotal do pedido.';
  end if;

  update public.pedidos
  set desconto = v_desconto,
      acrescimo = v_acrescimo,
      status_operacional = (case when p_confirmar then 'CONFIRMED' else 'DRAFT' end)::public.status_operacional_pedido
  where id = v_pedido;

  -- Lançar em comanda que já pediu a conta reabre o consumo.
  if p_origem = 'MESA' and exists (select 1 from public.comandas where id = p_comanda and status = 'PAYMENT_PENDING') then
    update public.comandas
    set status = 'OPEN', conta_pedida_em = null
    where id = p_comanda;
  end if;

  if v_desconto > 0 or v_acrescimo > 0 then
    perform app.registrar_auditoria(
      p_empresa, 'pedido.valores_aplicados', 'pedidos', v_pedido::text,
      jsonb_build_object('desconto', v_desconto, 'acrescimo', v_acrescimo)
    );
  end if;

  return v_pedido;
end;
$$;

revoke all on function public.criar_pedido(
  uuid, public.origem_pedido, jsonb, uuid, boolean, numeric, numeric, text, uuid, uuid, text
) from public, anon;
grant execute on function public.criar_pedido(
  uuid, public.origem_pedido, jsonb, uuid, boolean, numeric, numeric, text, uuid, uuid, text
) to authenticated, service_role;

-- ------------------------------------------------------------
-- painel_cozinha com a identificação. O retorno muda, então a antiga sai.
-- ------------------------------------------------------------
drop function public.painel_cozinha(uuid, uuid);

create function public.painel_cozinha(p_empresa uuid, p_setor uuid default null)
returns table (
  pedido_id uuid,
  numero bigint,
  origem public.origem_pedido,
  status public.status_operacional_pedido,
  nome_mesa text,
  comanda_numero bigint,
  observacoes_pedido text,
  identificacao text,
  criado_em timestamptz,
  confirmado_em timestamptz,
  preparo_em timestamptz,
  pronto_em timestamptz,
  item_id uuid,
  nome_produto text,
  quantidade numeric,
  observacoes_item text,
  nome_setor text,
  enviado_em timestamptz,
  adicionais text[]
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.eh_membro(p_empresa) then
    raise exception 'Restaurante não encontrado.';
  end if;

  return query
  select
    p.id, p.numero, p.origem, p.status_operacional,
    m.nome, c.numero, p.observacoes, p.identificacao,
    p.criado_em, p.confirmado_em, p.preparo_em, p.pronto_em,
    i.id, i.nome_produto, i.quantidade, i.observacoes, i.nome_setor, i.enviado_em,
    coalesce((
      select array_agg(a.nome_opcao order by a.nome_grupo, a.nome_opcao)
      from public.item_pedido_adicional a
      where a.item_pedido_id = i.id
    ), '{}'::text[])
  from public.pedidos p
  join public.itens_pedido i on i.pedido_id = p.id
  left join public.comandas c on c.id = p.comanda_id
  left join public.mesas m on m.id = c.mesa_id
  where p.empresa_id = p_empresa
    and p.status_operacional in ('CONFIRMED', 'PREPARING', 'READY')
    and i.setor_id is not null
    and (p_setor is null or i.setor_id = p_setor)
  order by p.criado_em, i.criado_em;
end;
$$;

revoke execute on function public.painel_cozinha(uuid, uuid) from public, anon;
grant execute on function public.painel_cozinha(uuid, uuid) to authenticated, service_role;
