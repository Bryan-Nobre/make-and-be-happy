-- ============================================================
-- 31. Cliente no pedido e histórico do cliente (PRD 15)
--
-- - criar_pedido aceita p_cliente. Pedido de mesa herda o cliente da
--   comanda quando nenhum é informado.
-- - definir_cliente_comanda vincula ou remove o cliente de uma comanda
--   ainda não encerrada.
-- - historico_cliente e resumo_cliente são SECURITY INVOKER: a RLS de
--   pedidos/comandas decide quem lê.
-- ============================================================

-- ------------------------------------------------------------
-- app.validar_cliente: cliente ativo da mesma empresa.
-- ------------------------------------------------------------
create or replace function app.validar_cliente(p_empresa uuid, p_cliente uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_cliente is null then
    return;
  end if;
  if not exists (
    select 1 from public.clientes
    where empresa_id = p_empresa and id = p_cliente and ativo
  ) then
    raise exception 'Cliente não encontrado.';
  end if;
end;
$$;

revoke all on function app.validar_cliente(uuid, uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- criar_pedido com cliente. A assinatura muda, então a antiga sai.
-- ------------------------------------------------------------
drop function if exists public.criar_pedido(
  uuid, public.origem_pedido, jsonb, uuid, boolean, numeric, numeric, text, uuid
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
  p_cliente uuid default null
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
    empresa_id, numero, origem, comanda_id, cliente_id, observacoes, criado_por, client_request_id
  )
  values (
    p_empresa,
    app.proximo_numero(p_empresa, 'PEDIDO'),
    p_origem,
    p_comanda,
    v_cliente,
    nullif(btrim(coalesce(p_observacoes, '')), ''),
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
  uuid, public.origem_pedido, jsonb, uuid, boolean, numeric, numeric, text, uuid, uuid
) from public, anon;
grant execute on function public.criar_pedido(
  uuid, public.origem_pedido, jsonb, uuid, boolean, numeric, numeric, text, uuid, uuid
) to authenticated, service_role;

-- ------------------------------------------------------------
-- definir_cliente_comanda: p_cliente nulo remove o vínculo.
-- ------------------------------------------------------------
create or replace function public.definir_cliente_comanda(p_comanda uuid, p_cliente uuid)
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

  if v_comanda.status not in ('OPEN', 'PAYMENT_PENDING', 'PAID') then
    raise exception 'A comanda #% já foi encerrada.', v_comanda.numero;
  end if;

  perform app.validar_cliente(v_comanda.empresa_id, p_cliente);

  if v_comanda.cliente_id is not distinct from p_cliente then
    return;
  end if;

  update public.comandas set cliente_id = p_cliente where id = p_comanda;

  perform app.registrar_auditoria(
    v_comanda.empresa_id, 'comanda.cliente_definido', 'comandas', p_comanda::text,
    jsonb_build_object('comanda', v_comanda.numero, 'removido', p_cliente is null)
  );
end;
$$;

revoke all on function public.definir_cliente_comanda(uuid, uuid) from public, anon;
grant execute on function public.definir_cliente_comanda(uuid, uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- Histórico: pedido do cliente direto ou da comanda dele.
-- ------------------------------------------------------------
create index if not exists pedidos_empresa_cliente_idx
  on public.pedidos (empresa_id, cliente_id, criado_em desc) where cliente_id is not null;
create index if not exists comandas_empresa_cliente_idx
  on public.comandas (empresa_id, cliente_id) where cliente_id is not null;

create or replace function public.historico_cliente(p_empresa uuid, p_cliente uuid)
returns table (
  id uuid,
  numero bigint,
  origem public.origem_pedido,
  status_operacional public.status_operacional_pedido,
  status_financeiro public.status_financeiro_pedido,
  total numeric,
  criado_em timestamptz,
  nome_mesa text,
  comanda_numero bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.numero::bigint, p.origem, p.status_operacional, p.status_financeiro,
         p.total, p.criado_em, m.nome, c.numero::bigint
  from public.pedidos p
  left join public.comandas c on c.empresa_id = p.empresa_id and c.id = p.comanda_id
  left join public.mesas m on m.empresa_id = c.empresa_id and m.id = c.mesa_id
  where p.empresa_id = p_empresa
    and coalesce(p.cliente_id, c.cliente_id) = p_cliente
  order by p.criado_em desc
  limit 50;
$$;

create or replace function public.resumo_cliente(p_empresa uuid, p_cliente uuid)
returns table (pedidos bigint, total_gasto numeric, ultimo_pedido timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::bigint,
         coalesce(sum(p.total), 0),
         max(p.criado_em)
  from public.pedidos p
  left join public.comandas c on c.empresa_id = p.empresa_id and c.id = p.comanda_id
  where p.empresa_id = p_empresa
    and coalesce(p.cliente_id, c.cliente_id) = p_cliente
    and p.status_operacional not in ('DRAFT', 'CANCELLED');
$$;

revoke all on function public.historico_cliente(uuid, uuid) from public, anon;
revoke all on function public.resumo_cliente(uuid, uuid) from public, anon;
grant execute on function public.historico_cliente(uuid, uuid) to authenticated, service_role;
grant execute on function public.resumo_cliente(uuid, uuid) to authenticated, service_role;
