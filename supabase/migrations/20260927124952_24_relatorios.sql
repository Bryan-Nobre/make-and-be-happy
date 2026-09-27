-- ============================================================
-- ARVON FOOD - Dashboard e relatórios (PRD 16 e 17)
--
-- Agregações feitas no banco: o navegador não recebe pedidos de
-- um período inteiro só para somar. Faturamento = total dos
-- pedidos não cancelados (já com desconto), sem a taxa de
-- serviço, que é reportada à parte. Dias no fuso de Brasília.
-- ============================================================

create or replace function app.inicio_do_dia(p_dia date)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (p_dia::timestamp at time zone 'America/Sao_Paulo');
$$;

create or replace function app.validar_periodo(p_inicio date, p_fim date)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido: a data final deve ser igual ou posterior à inicial.';
  end if;
  if p_fim - p_inicio > 366 then
    raise exception 'Escolha um período de até um ano.';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- Dashboard (owner, admin, cashier)
-- ------------------------------------------------------------
create or replace function public.resumo_dashboard(p_empresa uuid)
returns table (
  faturamento numeric,
  pedidos bigint,
  ticket_medio numeric,
  na_fila bigint,
  em_preparo bigint,
  prontos bigint,
  mesas_ocupadas bigint,
  mesas_total bigint,
  estoque_alerta bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  perform app.exigir_papel(p_empresa, array['owner', 'admin', 'cashier']::public.papel_usuario[]);

  return query
  with dia as (
    select p.total
    from public.pedidos p
    where p.empresa_id = p_empresa
      and p.status_operacional not in ('DRAFT', 'CANCELLED')
      and p.criado_em >= app.inicio_do_dia(v_hoje)
      and p.criado_em < app.inicio_do_dia(v_hoje + 1)
  ),
  producao as (
    select p.status_operacional
    from public.pedidos p
    where p.empresa_id = p_empresa
      and p.status_operacional in ('CONFIRMED', 'PREPARING', 'READY')
  )
  select
    coalesce((select sum(d.total) from dia d), 0),
    (select count(*) from dia),
    coalesce((select round(avg(d.total), 2) from dia d), 0),
    (select count(*) from producao x where x.status_operacional = 'CONFIRMED'),
    (select count(*) from producao x where x.status_operacional = 'PREPARING'),
    (select count(*) from producao x where x.status_operacional = 'READY'),
    (select count(*) from public.mesas m
      where m.empresa_id = p_empresa and m.ativa
        and exists (
          select 1 from public.comandas c
          where c.empresa_id = p_empresa and c.mesa_id = m.id
            and c.status in ('OPEN', 'PAYMENT_PENDING', 'PAID')
        )),
    (select count(*) from public.mesas m where m.empresa_id = p_empresa and m.ativa),
    (select count(*) from public.itens_estoque i
      where i.empresa_id = p_empresa and i.ativo and i.quantidade <= i.quantidade_minima);
end;
$$;

-- ------------------------------------------------------------
-- Relatórios (owner, admin)
-- ------------------------------------------------------------
create or replace function public.relatorio_resumo(p_empresa uuid, p_inicio date, p_fim date)
returns table (
  pedidos bigint,
  faturamento numeric,
  descontos numeric,
  ticket_medio numeric,
  taxa_servico numeric,
  cancelados bigint,
  valor_cancelado numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.exigir_papel(p_empresa, array['owner', 'admin']::public.papel_usuario[]);
  perform app.validar_periodo(p_inicio, p_fim);

  return query
  with base as (
    select p.status_operacional, p.total, p.desconto
    from public.pedidos p
    where p.empresa_id = p_empresa
      and p.status_operacional <> 'DRAFT'
      and p.criado_em >= app.inicio_do_dia(p_inicio)
      and p.criado_em < app.inicio_do_dia(p_fim + 1)
  )
  select
    count(*) filter (where b.status_operacional <> 'CANCELLED'),
    coalesce(sum(b.total) filter (where b.status_operacional <> 'CANCELLED'), 0),
    coalesce(sum(b.desconto) filter (where b.status_operacional <> 'CANCELLED'), 0),
    coalesce(round(avg(b.total) filter (where b.status_operacional <> 'CANCELLED'), 2), 0),
    (select coalesce(sum(c.taxa_servico), 0)
       from public.comandas_resumo c
       where c.empresa_id = p_empresa
         and c.status <> 'CANCELLED'
         and c.aberta_em >= app.inicio_do_dia(p_inicio)
         and c.aberta_em < app.inicio_do_dia(p_fim + 1)),
    count(*) filter (where b.status_operacional = 'CANCELLED'),
    coalesce(sum(b.total) filter (where b.status_operacional = 'CANCELLED'), 0)
  from base b;
end;
$$;

create or replace function public.relatorio_vendas_diarias(p_empresa uuid, p_inicio date, p_fim date)
returns table (dia date, pedidos bigint, faturamento numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.exigir_papel(p_empresa, array['owner', 'admin']::public.papel_usuario[]);
  perform app.validar_periodo(p_inicio, p_fim);

  return query
  select
    d.dia::date,
    count(p.id),
    coalesce(sum(p.total), 0)
  from generate_series(p_inicio, p_fim, interval '1 day') as d(dia)
  left join public.pedidos p
    on p.empresa_id = p_empresa
   and p.status_operacional not in ('DRAFT', 'CANCELLED')
   and p.criado_em >= app.inicio_do_dia(d.dia::date)
   and p.criado_em < app.inicio_do_dia(d.dia::date + 1)
  group by d.dia
  order by d.dia;
end;
$$;

-- Recebimentos confirmados (inclui taxa de serviço, porque é o que entrou no caixa).
create or replace function public.relatorio_formas_pagamento(p_empresa uuid, p_inicio date, p_fim date)
returns table (metodo public.metodo_pagamento, quantidade bigint, valor numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.exigir_papel(p_empresa, array['owner', 'admin']::public.papel_usuario[]);
  perform app.validar_periodo(p_inicio, p_fim);

  return query
  select g.metodo, count(*), sum(g.valor)
  from public.pagamentos g
  where g.empresa_id = p_empresa
    and g.status = 'CONFIRMADO'
    and g.criado_em >= app.inicio_do_dia(p_inicio)
    and g.criado_em < app.inicio_do_dia(p_fim + 1)
  group by g.metodo
  order by sum(g.valor) desc;
end;
$$;

-- Valor por produto = total dos itens (com adicionais), antes do desconto do pedido.
create or replace function public.relatorio_produtos(
  p_empresa uuid,
  p_inicio date,
  p_fim date,
  p_limite int default 20
)
returns table (produto_id uuid, nome text, quantidade numeric, faturamento numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.exigir_papel(p_empresa, array['owner', 'admin']::public.papel_usuario[]);
  perform app.validar_periodo(p_inicio, p_fim);

  return query
  select
    i.produto_id,
    (array_agg(i.nome_produto order by i.criado_em desc))[1],
    sum(i.quantidade),
    sum(i.total)
  from public.itens_pedido i
  join public.pedidos p on p.id = i.pedido_id
  where p.empresa_id = p_empresa
    and p.status_operacional not in ('DRAFT', 'CANCELLED')
    and p.criado_em >= app.inicio_do_dia(p_inicio)
    and p.criado_em < app.inicio_do_dia(p_fim + 1)
  group by i.produto_id
  order by sum(i.quantidade) desc, sum(i.total) desc
  limit least(greatest(coalesce(p_limite, 20), 1), 100);
end;
$$;

create or replace function public.relatorio_estoque(p_empresa uuid, p_inicio date, p_fim date)
returns table (
  tipo public.tipo_movimentacao_estoque,
  origem public.origem_movimentacao_estoque,
  movimentacoes bigint,
  itens bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.exigir_papel(p_empresa, array['owner', 'admin']::public.papel_usuario[]);
  perform app.validar_periodo(p_inicio, p_fim);

  return query
  select m.tipo, m.origem, count(*), count(distinct m.item_id)
  from public.movimentacoes_estoque m
  where m.empresa_id = p_empresa
    and m.criado_em >= app.inicio_do_dia(p_inicio)
    and m.criado_em < app.inicio_do_dia(p_fim + 1)
  group by m.tipo, m.origem
  order by m.tipo, m.origem;
end;
$$;

create index if not exists pagamentos_empresa_criado_idx
  on public.pagamentos (empresa_id, criado_em);

do $$
declare
  v_assinatura text;
begin
  foreach v_assinatura in array array[
    'public.resumo_dashboard(uuid)',
    'public.relatorio_resumo(uuid, date, date)',
    'public.relatorio_vendas_diarias(uuid, date, date)',
    'public.relatorio_formas_pagamento(uuid, date, date)',
    'public.relatorio_produtos(uuid, date, date, int)',
    'public.relatorio_estoque(uuid, date, date)'
  ]
  loop
    execute format('revoke all on function %s from public', v_assinatura);
    execute format('revoke all on function %s from anon', v_assinatura);
    execute format('grant execute on function %s to authenticated, service_role', v_assinatura);
  end loop;

  foreach v_assinatura in array array[
    'app.inicio_do_dia(date)',
    'app.validar_periodo(date, date)'
  ]
  loop
    execute format('revoke all on function %s from public', v_assinatura);
  end loop;
end $$;
