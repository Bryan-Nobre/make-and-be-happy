-- ============================================================
-- ARVON FOOD - Fundacao multi-tenant
-- Empresas, membros, convites, sequencias, auditoria, RLS.
-- ============================================================

-- Schema interno: nao exposto pela API REST/GraphQL do Supabase.
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
create type public.papel_usuario as enum ('owner', 'admin', 'cashier', 'waiter', 'kitchen');
create type public.status_convite as enum ('PENDENTE', 'ACEITO', 'CANCELADO');
create type public.tipo_sequencia as enum ('PEDIDO', 'COMANDA');

-- ------------------------------------------------------------
-- empresas
-- ------------------------------------------------------------
create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 2 and 120),
  cnpj text check (cnpj is null or length(btrim(cnpj)) between 11 and 20),
  telefone text,
  endereco text,
  horario_funcionamento text,
  logo_url text,
  taxa_servico numeric(5, 2) not null default 10 check (taxa_servico >= 0 and taxa_servico <= 100),
  envio_automatico_cozinha boolean not null default false,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ------------------------------------------------------------
-- membros_empresa: vinculo usuario <-> empresa, fonte do papel
-- ------------------------------------------------------------
create table public.membros_empresa (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  papel public.papel_usuario not null,
  nome_exibicao text not null check (length(btrim(nome_exibicao)) between 2 and 120),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint membros_empresa_unico unique (empresa_id, usuario_id)
);

create index membros_empresa_usuario_idx on public.membros_empresa (usuario_id) where ativo;
create index membros_empresa_empresa_idx on public.membros_empresa (empresa_id);

-- ------------------------------------------------------------
-- convites: entrada de novos membros sem service role
-- ------------------------------------------------------------
create table public.convites (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  email text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'),
  papel public.papel_usuario not null,
  nome_exibicao text not null check (length(btrim(nome_exibicao)) between 2 and 120),
  token text not null unique,
  status public.status_convite not null default 'PENDENTE',
  convidado_por uuid references auth.users (id) on delete set null,
  expira_em timestamptz not null,
  aceito_em timestamptz,
  aceito_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);

create unique index convites_pendente_unico
  on public.convites (empresa_id, email)
  where status = 'PENDENTE';

create index convites_email_idx on public.convites (email) where status = 'PENDENTE';

-- ------------------------------------------------------------
-- sequencias_empresa: numeracao operacional por empresa
-- Sem policy de RLS: acesso apenas por funcoes SECURITY DEFINER.
-- ------------------------------------------------------------
create table public.sequencias_empresa (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  tipo public.tipo_sequencia not null,
  valor bigint not null default 0 check (valor >= 0),
  primary key (empresa_id, tipo)
);

-- ------------------------------------------------------------
-- auditoria
-- ------------------------------------------------------------
create table public.auditoria (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  usuario_id uuid references auth.users (id) on delete set null,
  acao text not null,
  entidade text not null,
  entidade_id text,
  dados jsonb,
  criado_em timestamptz not null default now()
);

create index auditoria_empresa_idx on public.auditoria (empresa_id, criado_em desc);
create index auditoria_entidade_idx on public.auditoria (empresa_id, entidade, entidade_id);

-- ------------------------------------------------------------
-- Helpers de autorizacao
-- SECURITY DEFINER para nao recursionar na RLS de membros_empresa.
-- ------------------------------------------------------------
create or replace function app.eh_membro(p_empresa uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.membros_empresa m
    where m.empresa_id = p_empresa
      and m.usuario_id = auth.uid()
      and m.ativo
  );
$$;

create or replace function app.papel(p_empresa uuid)
returns public.papel_usuario
language sql
security definer
stable
set search_path = ''
as $$
  select m.papel
  from public.membros_empresa m
  where m.empresa_id = p_empresa
    and m.usuario_id = auth.uid()
    and m.ativo
  limit 1;
$$;

create or replace function app.tem_papel(p_empresa uuid, p_papeis public.papel_usuario[])
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select app.papel(p_empresa) = any (p_papeis);
$$;

-- Versao que interrompe a operacao: usada dentro das RPCs.
create or replace function app.exigir_papel(p_empresa uuid, p_papeis public.papel_usuario[])
returns public.papel_usuario
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_papel public.papel_usuario;
begin
  if auth.uid() is null then
    raise exception 'Sessao invalida.' using errcode = '42501';
  end if;

  v_papel := app.papel(p_empresa);

  if v_papel is null then
    raise exception 'Voce nao tem acesso a esta empresa.' using errcode = '42501';
  end if;

  if not (v_papel = any (p_papeis)) then
    raise exception 'Seu perfil nao permite esta operacao.' using errcode = '42501';
  end if;

  return v_papel;
end;
$$;

create or replace function app.registrar_auditoria(
  p_empresa uuid,
  p_acao text,
  p_entidade text,
  p_entidade_id text,
  p_dados jsonb default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.auditoria (empresa_id, usuario_id, acao, entidade, entidade_id, dados)
  values (p_empresa, auth.uid(), p_acao, p_entidade, p_entidade_id, p_dados);
$$;

-- Numeracao atomica por empresa (PRD 21).
create or replace function app.proximo_numero(p_empresa uuid, p_tipo public.tipo_sequencia)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_valor bigint;
begin
  insert into public.sequencias_empresa as s (empresa_id, tipo, valor)
  values (p_empresa, p_tipo, 1)
  on conflict (empresa_id, tipo) do update set valor = s.valor + 1
  returning s.valor into v_valor;

  return v_valor;
end;
$$;

-- Nome do usuario logado dentro da empresa, para snapshots de historico.
create or replace function app.nome_membro(p_empresa uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select m.nome_exibicao
  from public.membros_empresa m
  where m.empresa_id = p_empresa
    and m.usuario_id = auth.uid()
  limit 1;
$$;

grant execute on function app.eh_membro(uuid) to authenticated;
grant execute on function app.papel(uuid) to authenticated;
grant execute on function app.tem_papel(uuid, public.papel_usuario[]) to authenticated;

-- ------------------------------------------------------------
-- Triggers utilitarias
-- ------------------------------------------------------------
create or replace function app.tg_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger empresas_atualizado_em
  before update on public.empresas
  for each row execute function app.tg_atualizado_em();

create trigger membros_empresa_atualizado_em
  before update on public.membros_empresa
  for each row execute function app.tg_atualizado_em();

-- A empresa e atualizada direto por RLS (owner/admin); a auditoria fica na trigger.
create or replace function app.tg_auditar_empresa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.registrar_auditoria(
    new.id,
    'empresa.atualizada',
    'empresas',
    new.id::text,
    jsonb_build_object(
      'antes', to_jsonb(old) - 'atualizado_em',
      'depois', to_jsonb(new) - 'atualizado_em'
    )
  );
  return new;
end;
$$;

create trigger empresas_auditoria
  after update on public.empresas
  for each row
  when (to_jsonb(old) - 'atualizado_em' is distinct from to_jsonb(new) - 'atualizado_em')
  execute function app.tg_auditar_empresa();

-- Nao permitir deixar a empresa sem owner ativo.
create or replace function app.tg_exigir_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid := coalesce(old.empresa_id, new.empresa_id);
begin
  if not exists (
    select 1
    from public.membros_empresa m
    where m.empresa_id = v_empresa
      and m.papel = 'owner'
      and m.ativo
  ) then
    raise exception 'A empresa precisa de pelo menos um proprietario ativo.' using errcode = '23514';
  end if;

  return null;
end;
$$;

create constraint trigger membros_empresa_exige_owner
  after update or delete on public.membros_empresa
  deferrable initially deferred
  for each row execute function app.tg_exigir_owner();

-- ------------------------------------------------------------
-- RLS
-- Escrita de vinculos, convites, sequencias e auditoria e feita
-- exclusivamente por RPC SECURITY DEFINER: nenhuma policy de
-- insert/update/delete e concedida ao cliente.
-- ------------------------------------------------------------
alter table public.empresas enable row level security;
alter table public.membros_empresa enable row level security;
alter table public.convites enable row level security;
alter table public.sequencias_empresa enable row level security;
alter table public.auditoria enable row level security;

create policy empresas_select on public.empresas
  for select to authenticated
  using (app.eh_membro(id));

create policy empresas_update on public.empresas
  for update to authenticated
  using (app.tem_papel(id, array['owner', 'admin']::public.papel_usuario[]))
  with check (app.tem_papel(id, array['owner', 'admin']::public.papel_usuario[]));

create policy membros_empresa_select on public.membros_empresa
  for select to authenticated
  using (app.eh_membro(empresa_id));

create policy convites_select on public.convites
  for select to authenticated
  using (app.tem_papel(empresa_id, array['owner', 'admin']::public.papel_usuario[]));

create policy auditoria_select on public.auditoria
  for select to authenticated
  using (app.tem_papel(empresa_id, array['owner', 'admin']::public.papel_usuario[]));
