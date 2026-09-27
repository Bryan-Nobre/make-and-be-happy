-- ============================================================
-- RPCs de comanda e visões de salão (PRD 9)
-- ============================================================

create type public.status_mesa as enum ('LIVRE', 'OCUPADA', 'AGUARDANDO_PAGAMENTO');

-- ------------------------------------------------------------
-- abrir_comanda
-- ------------------------------------------------------------
create or replace function public.abrir_comanda(
  p_empresa uuid,
  p_mesa uuid,
  p_pessoas integer default null,
  p_cliente uuid default null,
  p_observacoes text default null,
  p_client_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mesa record;
  v_comanda uuid;
  v_taxa numeric(5, 2);
begin
  perform app.exigir_papel(p_empresa,
    array['owner', 'admin', 'cashier', 'waiter']::public.papel_usuario[]);

  if p_client_request_id is not null then
    select id into v_comanda
    from public.comandas
    where empresa_id = p_empresa and client_request_id = p_client_request_id;
    if found then
      return v_comanda;
    end if;
  end if;

  select id, nome, ativa into v_mesa
  from public.mesas
  where empresa_id = p_empresa and id = p_mesa
  for update;

  if not found then
    raise exception 'Mesa não encontrada.';
  end if;
  if not v_mesa.ativa then
    raise exception 'A mesa "%" está desativada.', v_mesa.nome;
  end if;

  if exists (
    select 1 from public.comandas
    where mesa_id = p_mesa and status in ('OPEN', 'PAYMENT_PENDING', 'PAID')
  ) then
    raise exception 'A mesa "%" já tem uma comanda aberta.', v_mesa.nome;
  end if;

  if p_cliente is not null
     and not exists (
       select 1 from public.clientes
       where empresa_id = p_empresa and id = p_cliente and ativo
     ) then
    raise exception 'Cliente não encontrado.';
  end if;

  select coalesce(taxa_servico, 0) into v_taxa from public.empresas where id = p_empresa;

  insert into public.comandas (
    empresa_id, numero, mesa_id, cliente_id, pessoas,
    taxa_servico_percentual, observacoes, aberta_por, client_request_id
  )
  values (
    p_empresa,
    app.proximo_numero(p_empresa, 'COMANDA'),
    p_mesa,
    p_cliente,
    p_pessoas,
    v_taxa,
    nullif(btrim(coalesce(p_observacoes, '')), ''),
    app.membro_atual(p_empresa),
    p_client_request_id
  )
  returning id into v_comanda;

  return v_comanda;
end;
$$;

-- ------------------------------------------------------------
-- Carrega uma comanda garantindo vínculo do usuário com a empresa.
-- ------------------------------------------------------------
create or replace function app.comanda_acessivel(p_comanda uuid)
returns public.comandas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comanda public.comandas;
begin
  select * into v_comanda from public.comandas where id = p_comanda for update;
  if not found or not app.eh_membro(v_comanda.empresa_id) then
    raise exception 'Comanda não encontrada.';
  end if;
  return v_comanda;
end;
$$;

-- ------------------------------------------------------------
-- pedir_conta: mesa passa a aguardar pagamento
-- ------------------------------------------------------------
create or replace function public.pedir_conta(p_comanda uuid)
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

  if v_comanda.status <> 'OPEN' then
    raise exception 'A comanda #% não está aberta.', v_comanda.numero;
  end if;

  update public.comandas
  set status = 'PAYMENT_PENDING', conta_pedida_em = now()
  where id = p_comanda;
end;
$$;

-- ------------------------------------------------------------
-- transferir_comanda: destino precisa estar livre (PRD 9)
-- ------------------------------------------------------------
create or replace function public.transferir_comanda(
  p_comanda uuid,
  p_mesa_destino uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comanda public.comandas;
  v_origem text;
  v_destino record;
begin
  v_comanda := app.comanda_acessivel(p_comanda);
  perform app.exigir_papel(v_comanda.empresa_id,
    array['owner', 'admin', 'cashier', 'waiter']::public.papel_usuario[]);

  if v_comanda.status not in ('OPEN', 'PAYMENT_PENDING') then
    raise exception 'Só é possível transferir uma comanda aberta.';
  end if;
  if v_comanda.mesa_id = p_mesa_destino then
    raise exception 'A comanda já está nesta mesa.';
  end if;

  select id, nome, ativa into v_destino
  from public.mesas
  where empresa_id = v_comanda.empresa_id and id = p_mesa_destino
  for update;

  if not found then
    raise exception 'Mesa de destino não encontrada.';
  end if;
  if not v_destino.ativa then
    raise exception 'A mesa "%" está desativada.', v_destino.nome;
  end if;

  if exists (
    select 1 from public.comandas
    where mesa_id = p_mesa_destino and status in ('OPEN', 'PAYMENT_PENDING', 'PAID')
  ) then
    raise exception 'A mesa "%" já está ocupada.', v_destino.nome;
  end if;

  select nome into v_origem from public.mesas where id = v_comanda.mesa_id;

  update public.comandas set mesa_id = p_mesa_destino where id = p_comanda;

  perform app.registrar_auditoria(
    v_comanda.empresa_id, 'comanda.transferida', 'comandas', p_comanda::text,
    jsonb_build_object('comanda', v_comanda.numero, 'de', v_origem, 'para', v_destino.nome)
  );
end;
$$;

-- ------------------------------------------------------------
-- encerrar_comanda: exige conta quitada e cozinha sem pendência
-- ------------------------------------------------------------
create or replace function public.encerrar_comanda(p_comanda uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comanda public.comandas;
  v_conta record;
begin
  v_comanda := app.comanda_acessivel(p_comanda);
  perform app.exigir_papel(v_comanda.empresa_id,
    array['owner', 'admin', 'cashier']::public.papel_usuario[]);

  if v_comanda.status in ('CLOSED', 'CANCELLED') then
    raise exception 'A comanda #% já foi encerrada.', v_comanda.numero;
  end if;

  select
    coalesce(sum(p.total), 0) as total,
    coalesce(sum(p.valor_pago), 0) as pago,
    count(*) filter (
      where p.status_operacional in ('DRAFT', 'CONFIRMED', 'PREPARING', 'READY')
    ) as em_producao
  into v_conta
  from public.pedidos p
  where p.comanda_id = p_comanda and p.status_operacional <> 'CANCELLED';

  if v_conta.em_producao > 0 then
    raise exception 'A comanda #% tem % pedido(s) ainda em andamento.',
      v_comanda.numero, v_conta.em_producao;
  end if;

  if v_conta.pago < round(v_conta.total * (1 + v_comanda.taxa_servico_percentual / 100), 2) then
    raise exception 'A comanda #% ainda tem saldo em aberto.', v_comanda.numero;
  end if;

  update public.comandas
  set status = 'CLOSED', fechada_em = now()
  where id = p_comanda;
end;
$$;

-- ------------------------------------------------------------
-- cancelar_comanda: libera a mesa sem faturar, com motivo e auditoria.
-- Bloqueada se houver consumo entregue ou pagamento, para não virar
-- caminho de saída de venda sem registro.
-- ------------------------------------------------------------
create or replace function public.cancelar_comanda(
  p_comanda uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comanda public.comandas;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_membro uuid;
  v_bloqueio record;
begin
  v_comanda := app.comanda_acessivel(p_comanda);
  perform app.exigir_papel(v_comanda.empresa_id,
    array['owner', 'admin']::public.papel_usuario[]);

  if length(v_motivo) < 3 then
    raise exception 'Informe o motivo do cancelamento.';
  end if;
  if v_comanda.status in ('CLOSED', 'CANCELLED') then
    raise exception 'A comanda #% já foi encerrada.', v_comanda.numero;
  end if;

  select
    coalesce(sum(p.valor_pago), 0) as pago,
    count(*) filter (where p.status_operacional in ('READY', 'DELIVERED')) as entregues,
    coalesce(sum(p.total), 0) as total
  into v_bloqueio
  from public.pedidos p
  where p.comanda_id = p_comanda and p.status_operacional <> 'CANCELLED';

  if v_bloqueio.pago > 0 then
    raise exception 'A comanda #% tem pagamento registrado. Faça o estorno antes de cancelar.',
      v_comanda.numero;
  end if;
  if v_bloqueio.entregues > 0 then
    raise exception 'A comanda #% tem pedidos prontos ou entregues. Receba a conta em vez de cancelar.',
      v_comanda.numero;
  end if;

  v_membro := app.membro_atual(v_comanda.empresa_id);

  update public.pedidos
  set status_operacional = 'CANCELLED',
      motivo_cancelamento = 'Comanda cancelada: ' || v_motivo,
      cancelado_por = v_membro
  where comanda_id = p_comanda
    and status_operacional in ('DRAFT', 'CONFIRMED', 'PREPARING');

  update public.comandas
  set status = 'CANCELLED',
      motivo_cancelamento = v_motivo,
      cancelada_por = v_membro,
      fechada_em = now()
  where id = p_comanda;

  perform app.registrar_auditoria(
    v_comanda.empresa_id, 'comanda.cancelada', 'comandas', p_comanda::text,
    jsonb_build_object('comanda', v_comanda.numero, 'total', v_bloqueio.total, 'motivo', v_motivo)
  );
end;
$$;

-- ============================================================
-- Visões
-- security_invoker: a RLS das tabelas vale para quem consulta,
-- não para o dono da view.
-- ============================================================

create view public.comandas_resumo with (security_invoker = true) as
select
  c.id,
  c.empresa_id,
  c.numero,
  c.mesa_id,
  m.nome as nome_mesa,
  c.cliente_id,
  cl.nome as nome_cliente,
  c.pessoas,
  c.status,
  c.taxa_servico_percentual,
  c.observacoes,
  c.aberta_em,
  c.conta_pedida_em,
  c.fechada_em,
  c.motivo_cancelamento,
  coalesce(t.subtotal, 0) as subtotal,
  round(coalesce(t.subtotal, 0) * c.taxa_servico_percentual / 100, 2) as taxa_servico,
  coalesce(t.subtotal, 0)
    + round(coalesce(t.subtotal, 0) * c.taxa_servico_percentual / 100, 2) as total,
  coalesce(t.valor_pago, 0) as valor_pago,
  coalesce(t.pedidos, 0) as pedidos,
  coalesce(t.em_producao, 0) as pedidos_em_producao
from public.comandas c
join public.mesas m on m.empresa_id = c.empresa_id and m.id = c.mesa_id
left join public.clientes cl on cl.empresa_id = c.empresa_id and cl.id = c.cliente_id
left join lateral (
  select
    sum(p.total) as subtotal,
    sum(p.valor_pago) as valor_pago,
    count(*) as pedidos,
    count(*) filter (
      where p.status_operacional in ('DRAFT', 'CONFIRMED', 'PREPARING', 'READY')
    ) as em_producao
  from public.pedidos p
  where p.comanda_id = c.id and p.status_operacional <> 'CANCELLED'
) t on true;

-- O estado da mesa é derivado da comanda, nunca uma coluna paralela
-- que possa divergir.
create view public.mesas_estado with (security_invoker = true) as
select
  m.id,
  m.empresa_id,
  m.nome,
  m.lugares,
  m.ordem,
  m.ativa,
  case
    when c.id is null then 'LIVRE'
    when c.status in ('PAYMENT_PENDING', 'PAID') then 'AGUARDANDO_PAGAMENTO'
    else 'OCUPADA'
  end::public.status_mesa as status,
  c.id as comanda_id,
  c.numero as comanda_numero,
  c.pessoas,
  c.aberta_em,
  coalesce(c.subtotal, 0) as subtotal,
  coalesce(c.total, 0) as total,
  coalesce(c.pedidos_em_producao, 0) as pedidos_em_producao
from public.mesas m
left join public.comandas_resumo c
  on c.empresa_id = m.empresa_id
 and c.mesa_id = m.id
 and c.status in ('OPEN', 'PAYMENT_PENDING', 'PAID');
