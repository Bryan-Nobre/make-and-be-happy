-- ============================================================
-- ARVON FOOD - Caixa e pagamentos: estrutura (PRD 11 e 26)
--
-- Pagamento -> sessão de caixa aberta -> movimentação, sempre
-- juntos. O saldo do caixa nunca é coluna: é a soma das
-- movimentações. Caixa fechado e movimentações são imutáveis;
-- correção é feita com nova movimentação (estorno).
-- ============================================================

create type public.status_sessao_caixa as enum ('OPEN', 'CLOSED');
create type public.tipo_movimentacao_caixa as enum (
  'ABERTURA', 'VENDA', 'SUPRIMENTO', 'SANGRIA', 'ESTORNO'
);
create type public.status_pagamento as enum ('CONFIRMADO', 'ESTORNADO');

-- ------------------------------------------------------------
-- sessoes_caixa
-- No MVP há um terminal por empresa: no máximo uma sessão aberta.
-- ------------------------------------------------------------
create table public.sessoes_caixa (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  numero bigint not null,
  terminal text not null default 'Principal'
    check (length(btrim(terminal)) between 1 and 60),
  status public.status_sessao_caixa not null default 'OPEN',
  valor_inicial numeric(12, 2) not null check (valor_inicial >= 0),
  observacao_abertura text
    check (observacao_abertura is null or length(observacao_abertura) <= 300),
  aberta_por uuid references public.membros_empresa (id) on delete set null,
  nome_abertura text,
  aberta_em timestamptz not null default now(),
  fechada_por uuid references public.membros_empresa (id) on delete set null,
  nome_fechamento text,
  fechada_em timestamptz,
  -- Fotografia do fechamento: não muda se algo for recalculado depois.
  dinheiro_esperado numeric(12, 2),
  dinheiro_informado numeric(12, 2)
    check (dinheiro_informado is null or dinheiro_informado >= 0),
  diferenca numeric(12, 2)
    generated always as (dinheiro_informado - dinheiro_esperado) stored,
  justificativa text check (justificativa is null or length(justificativa) <= 500),
  total_dinheiro numeric(12, 2),
  total_pix numeric(12, 2),
  total_debito numeric(12, 2),
  total_credito numeric(12, 2),
  total_estornos numeric(12, 2),
  client_request_id uuid,
  constraint sessoes_caixa_empresa_id_key unique (empresa_id, id),
  constraint sessoes_caixa_numero_unico unique (empresa_id, numero),
  constraint sessoes_caixa_requisicao_unica unique (empresa_id, client_request_id),
  constraint sessoes_caixa_fechamento check (
    (status = 'OPEN' and fechada_em is null and dinheiro_informado is null)
    or (status = 'CLOSED' and fechada_em is not null
        and dinheiro_informado is not null and dinheiro_esperado is not null)
  )
);

create unique index sessoes_caixa_uma_aberta
  on public.sessoes_caixa (empresa_id)
  where status = 'OPEN';

create index sessoes_caixa_empresa_idx on public.sessoes_caixa (empresa_id, aberta_em desc);

-- ------------------------------------------------------------
-- movimentacoes_caixa: livro-razão da sessão, só inserção
-- ------------------------------------------------------------
create table public.movimentacoes_caixa (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  sessao_id uuid not null,
  tipo public.tipo_movimentacao_caixa not null,
  metodo public.metodo_pagamento not null,
  valor numeric(12, 2) not null check (valor > 0),
  descricao text check (descricao is null or length(descricao) <= 300),
  membro_id uuid references public.membros_empresa (id) on delete set null,
  client_request_id uuid,
  criado_em timestamptz not null default now(),
  constraint movimentacoes_caixa_empresa_id_key unique (empresa_id, id),
  constraint movimentacoes_caixa_requisicao_unica unique (empresa_id, client_request_id),
  constraint movimentacoes_caixa_sessao_fk foreign key (empresa_id, sessao_id)
    references public.sessoes_caixa (empresa_id, id),
  -- Abertura, sangria e suprimento mexem só no dinheiro físico.
  constraint movimentacoes_caixa_metodo check (tipo in ('VENDA', 'ESTORNO') or metodo = 'DINHEIRO')
);

create index movimentacoes_caixa_sessao_idx on public.movimentacoes_caixa (sessao_id, criado_em);

-- ------------------------------------------------------------
-- pagamentos
-- Um pagamento quita um pedido de balcão OU uma comanda (mesa).
-- Pagamento dividido = várias linhas com o mesmo lote_id, gravadas
-- numa única chamada; o lote_id é a chave de idempotência.
-- ------------------------------------------------------------
create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  sessao_id uuid not null,
  pedido_id uuid,
  comanda_id uuid,
  metodo public.metodo_pagamento not null,
  valor numeric(12, 2) not null check (valor > 0),
  valor_recebido numeric(12, 2),
  troco numeric(12, 2) generated always as (coalesce(valor_recebido - valor, 0)) stored,
  status public.status_pagamento not null default 'CONFIRMADO',
  movimentacao_id uuid not null,
  lote_id uuid not null,
  ordem smallint not null check (ordem > 0),
  criado_por uuid references public.membros_empresa (id) on delete set null,
  criado_em timestamptz not null default now(),
  estornado_em timestamptz,
  estornado_por uuid references public.membros_empresa (id) on delete set null,
  motivo_estorno text check (motivo_estorno is null or length(motivo_estorno) <= 300),
  movimentacao_estorno_id uuid,
  constraint pagamentos_empresa_id_key unique (empresa_id, id),
  constraint pagamentos_lote_unico unique (empresa_id, lote_id, ordem),
  constraint pagamentos_movimentacao_unica unique (movimentacao_id),
  constraint pagamentos_sessao_fk foreign key (empresa_id, sessao_id)
    references public.sessoes_caixa (empresa_id, id),
  constraint pagamentos_pedido_fk foreign key (empresa_id, pedido_id)
    references public.pedidos (empresa_id, id),
  constraint pagamentos_comanda_fk foreign key (empresa_id, comanda_id)
    references public.comandas (empresa_id, id),
  constraint pagamentos_movimentacao_fk foreign key (empresa_id, movimentacao_id)
    references public.movimentacoes_caixa (empresa_id, id),
  constraint pagamentos_movimentacao_estorno_fk foreign key (empresa_id, movimentacao_estorno_id)
    references public.movimentacoes_caixa (empresa_id, id),
  constraint pagamentos_alvo check (num_nonnulls(pedido_id, comanda_id) = 1),
  -- Troco só existe para dinheiro (PRD 26).
  constraint pagamentos_troco check (
    valor_recebido is null or (metodo = 'DINHEIRO' and valor_recebido >= valor)
  ),
  constraint pagamentos_estorno check (
    (status = 'CONFIRMADO' and estornado_em is null and movimentacao_estorno_id is null)
    or (status = 'ESTORNADO' and estornado_em is not null
        and movimentacao_estorno_id is not null and motivo_estorno is not null)
  )
);

create index pagamentos_sessao_idx on public.pagamentos (sessao_id, criado_em);
create index pagamentos_pedido_idx on public.pagamentos (pedido_id) where pedido_id is not null;
create index pagamentos_comanda_idx on public.pagamentos (comanda_id) where comanda_id is not null;

-- O pagamento da mesa é da comanda, porque inclui a taxa de serviço,
-- que não pertence a nenhum pedido. O valor é distribuído nos pedidos
-- para manter o status financeiro de cada um coerente.
alter table public.comandas
  add column valor_pago numeric(12, 2) not null default 0 check (valor_pago >= 0);

-- ============================================================
-- Imutabilidade
-- pg_trigger_depth() > 1 identifica a exclusão em cascata da
-- empresa, a única remoção física permitida.
-- ============================================================
create or replace function app.tg_sessao_caixa_protegida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then
      return old;
    end if;
    raise exception 'Sessões de caixa não podem ser excluídas.';
  end if;

  if old.status = 'CLOSED' then
    raise exception 'Caixa fechado não pode ser alterado.';
  end if;

  if new.empresa_id <> old.empresa_id
     or new.numero <> old.numero
     or new.valor_inicial <> old.valor_inicial
     or new.aberta_em <> old.aberta_em then
    raise exception 'Os dados de abertura do caixa não podem ser alterados.';
  end if;

  return new;
end;
$$;

create trigger sessoes_caixa_protegida
  before update or delete on public.sessoes_caixa
  for each row execute function app.tg_sessao_caixa_protegida();

create or replace function app.tg_movimentacao_caixa_protegida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.sessoes_caixa s
      where s.id = new.sessao_id and s.status = 'OPEN'
    ) then
      raise exception 'O caixa está fechado. Abra um novo caixa para movimentar.';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  raise exception 'Movimentações de caixa não podem ser alteradas. Registre um estorno.';
end;
$$;

create trigger movimentacoes_caixa_protegida
  before insert or update or delete on public.movimentacoes_caixa
  for each row execute function app.tg_movimentacao_caixa_protegida();

create or replace function app.tg_pagamento_protegido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then
      return old;
    end if;
    raise exception 'Pagamentos não podem ser excluídos. Registre um estorno.';
  end if;

  -- A única mudança aceita é confirmado -> estornado.
  if old.status <> 'CONFIRMADO'
     or new.status <> 'ESTORNADO'
     or (new.empresa_id, new.sessao_id, new.pedido_id, new.comanda_id, new.metodo,
         new.valor, new.valor_recebido, new.movimentacao_id, new.lote_id, new.ordem,
         new.criado_por, new.criado_em)
        is distinct from
        (old.empresa_id, old.sessao_id, old.pedido_id, old.comanda_id, old.metodo,
         old.valor, old.valor_recebido, old.movimentacao_id, old.lote_id, old.ordem,
         old.criado_por, old.criado_em) then
    raise exception 'Pagamentos não podem ser alterados. Registre um estorno.';
  end if;

  return new;
end;
$$;

create trigger pagamentos_protegido
  before update or delete on public.pagamentos
  for each row execute function app.tg_pagamento_protegido();

-- ============================================================
-- RLS: leitura para quem responde pelo caixa. Escrita só por RPC.
-- ============================================================
do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['sessoes_caixa', 'movimentacoes_caixa', 'pagamentos']
  loop
    execute format('alter table public.%I enable row level security', v_tabela);
    execute format(
      'create policy %I on public.%I for select to authenticated using (app.tem_papel(empresa_id, array[''owner'', ''admin'', ''cashier'']::public.papel_usuario[]))',
      v_tabela || '_select', v_tabela
    );
    execute format('revoke all on table public.%I from anon', v_tabela);
    execute format('revoke insert, update, delete, truncate on table public.%I from authenticated', v_tabela);
  end loop;
end $$;
