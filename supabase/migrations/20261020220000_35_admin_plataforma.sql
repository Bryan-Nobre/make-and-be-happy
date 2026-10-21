-- Admin da plataforma (SaaS): fora do papel de empresa.
-- Lista / pausa empresas, métricas leves e acesso temporário de suporte.

-- ------------------------------------------------------------
-- Tabelas
-- ------------------------------------------------------------
create table public.admins_plataforma (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

create table public.acessos_suporte (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  membro_id uuid references public.membros_empresa (id) on delete set null,
  criou_membro boolean not null default false,
  iniciado_em timestamptz not null default now(),
  encerrado_em timestamptz
);

-- unique parcial: um suporte aberto por par usuario/empresa
drop index if exists acessos_suporte_aberto_idx;
create unique index acessos_suporte_aberto_idx
  on public.acessos_suporte (usuario_id, empresa_id)
  where encerrado_em is null;

alter table public.admins_plataforma enable row level security;
alter table public.acessos_suporte enable row level security;

revoke all on table public.admins_plataforma from anon, authenticated;
revoke all on table public.acessos_suporte from anon, authenticated;
grant select on table public.admins_plataforma to authenticated;
grant select on table public.acessos_suporte to authenticated;

create policy admins_plataforma_select on public.admins_plataforma
  for select to authenticated
  using (usuario_id = auth.uid());

create policy acessos_suporte_select on public.acessos_suporte
  for select to authenticated
  using (usuario_id = auth.uid());

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
create or replace function app.eh_admin_plataforma()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.admins_plataforma a
    where a.usuario_id = auth.uid()
  );
$$;

create or replace function app.exigir_admin_plataforma()
returns void
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sua sessão expirou. Entre novamente.';
  end if;
  if not app.eh_admin_plataforma() then
    raise exception 'Acesso restrito ao administrador da plataforma.';
  end if;
end;
$$;

grant execute on function app.eh_admin_plataforma() to authenticated;
grant execute on function app.exigir_admin_plataforma() to authenticated;

-- Membros comuns só veem empresa ativa; admin da plataforma vê todas.
drop policy if exists empresas_select on public.empresas;
create policy empresas_select on public.empresas
  for select to authenticated
  using (
    app.eh_admin_plataforma()
    or (ativa and app.eh_membro(id))
  );

-- ------------------------------------------------------------
-- Bootstrap: só funciona com a tabela vazia (primeiro admin).
-- ------------------------------------------------------------
create or replace function public.reclamar_admin_plataforma()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sua sessão expirou. Entre novamente.';
  end if;

  if exists (select 1 from public.admins_plataforma) then
    raise exception 'Já existe um administrador da plataforma.';
  end if;

  insert into public.admins_plataforma (usuario_id) values (auth.uid());
  return true;
end;
$$;

revoke all on function public.reclamar_admin_plataforma() from public, anon;
grant execute on function public.reclamar_admin_plataforma() to authenticated;

create or replace function public.sou_admin_plataforma()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select app.eh_admin_plataforma();
$$;

revoke all on function public.sou_admin_plataforma() from public, anon;
grant execute on function public.sou_admin_plataforma() to authenticated;

-- ------------------------------------------------------------
-- Métricas + lista
-- ------------------------------------------------------------
create or replace function public.admin_plataforma_metricas()
returns table (
  empresas bigint,
  empresas_ativas bigint,
  empresas_pausadas bigint,
  membros_ativos bigint,
  caixas_abertos bigint,
  vendas_hoje numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  v_fim timestamptz := v_inicio + interval '1 day';
begin
  perform app.exigir_admin_plataforma();

  return query
  select
    (select count(*) from public.empresas)::bigint,
    (select count(*) from public.empresas e where e.ativa)::bigint,
    (select count(*) from public.empresas e where not e.ativa)::bigint,
    (select count(*) from public.membros_empresa m where m.ativo)::bigint,
    (select count(*) from public.sessoes_caixa s where s.status = 'OPEN')::bigint,
    coalesce((
      select sum(m.valor)
      from public.movimentacoes_caixa m
      where m.tipo = 'VENDA'
        and m.criado_em >= v_inicio
        and m.criado_em < v_fim
    ), 0)::numeric;
end;
$$;

revoke all on function public.admin_plataforma_metricas() from public, anon;
grant execute on function public.admin_plataforma_metricas() to authenticated;

create or replace function public.admin_plataforma_listar_empresas()
returns table (
  id uuid,
  nome text,
  ativa boolean,
  criado_em timestamptz,
  membros bigint,
  caixas_abertos bigint,
  vendas_hoje numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  v_fim timestamptz := v_inicio + interval '1 day';
begin
  perform app.exigir_admin_plataforma();

  return query
  select
    e.id,
    e.nome,
    e.ativa,
    e.criado_em,
    (select count(*) from public.membros_empresa m where m.empresa_id = e.id and m.ativo)::bigint,
    (select count(*) from public.sessoes_caixa s where s.empresa_id = e.id and s.status = 'OPEN')::bigint,
    coalesce((
      select sum(mv.valor)
      from public.movimentacoes_caixa mv
      where mv.empresa_id = e.id
        and mv.tipo = 'VENDA'
        and mv.criado_em >= v_inicio
        and mv.criado_em < v_fim
    ), 0)::numeric
  from public.empresas e
  order by e.criado_em desc;
end;
$$;

revoke all on function public.admin_plataforma_listar_empresas() from public, anon;
grant execute on function public.admin_plataforma_listar_empresas() to authenticated;

create or replace function public.admin_plataforma_definir_ativa(
  p_empresa uuid,
  p_ativa boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.exigir_admin_plataforma();

  update public.empresas
  set ativa = p_ativa
  where id = p_empresa;

  if not found then
    raise exception 'Empresa não encontrada.';
  end if;

  perform app.registrar_auditoria(
    p_empresa,
    case when p_ativa then 'plataforma.empresa_reativada' else 'plataforma.empresa_pausada' end,
    'empresas',
    p_empresa::text,
    jsonb_build_object('ativa', p_ativa)
  );
end;
$$;

revoke all on function public.admin_plataforma_definir_ativa(uuid, boolean) from public, anon;
grant execute on function public.admin_plataforma_definir_ativa(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- Suporte: vínculo temporário como admin (não owner)
-- ------------------------------------------------------------
create or replace function public.admin_plataforma_iniciar_suporte(p_empresa uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membro uuid;
  v_criou boolean := false;
  v_nome text;
begin
  perform app.exigir_admin_plataforma();

  if not exists (select 1 from public.empresas e where e.id = p_empresa) then
    raise exception 'Empresa não encontrada.';
  end if;

  -- Já tem suporte aberto nesta empresa.
  if exists (
    select 1 from public.acessos_suporte a
    where a.usuario_id = auth.uid()
      and a.empresa_id = p_empresa
      and a.encerrado_em is null
  ) then
    return p_empresa;
  end if;

  select m.id into v_membro
  from public.membros_empresa m
  where m.empresa_id = p_empresa
    and m.usuario_id = auth.uid()
  limit 1;

  if v_membro is null then
    v_nome := coalesce(
      (select u.raw_user_meta_data->>'nome' from auth.users u where u.id = auth.uid()),
      'Suporte Arvon'
    );
    if length(btrim(v_nome)) < 2 then
      v_nome := 'Suporte Arvon';
    end if;

    insert into public.membros_empresa (empresa_id, usuario_id, papel, nome_exibicao, ativo)
    values (p_empresa, auth.uid(), 'admin', left(btrim(v_nome), 120), true)
    returning id into v_membro;
    v_criou := true;
  else
    update public.membros_empresa
    set ativo = true
    where id = v_membro and not ativo;
  end if;

  insert into public.acessos_suporte (usuario_id, empresa_id, membro_id, criou_membro)
  values (auth.uid(), p_empresa, v_membro, v_criou);

  perform app.registrar_auditoria(
    p_empresa,
    'plataforma.suporte_iniciado',
    'empresas',
    p_empresa::text,
    jsonb_build_object('criou_membro', v_criou)
  );

  return p_empresa;
end;
$$;

revoke all on function public.admin_plataforma_iniciar_suporte(uuid) from public, anon;
grant execute on function public.admin_plataforma_iniciar_suporte(uuid) to authenticated;

create or replace function public.admin_plataforma_encerrar_suporte(p_empresa uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acesso public.acessos_suporte%rowtype;
begin
  perform app.exigir_admin_plataforma();

  select * into v_acesso
  from public.acessos_suporte a
  where a.usuario_id = auth.uid()
    and a.empresa_id = p_empresa
    and a.encerrado_em is null
  limit 1;

  if not found then
    raise exception 'Não há acesso de suporte aberto nesta empresa.';
  end if;

  update public.acessos_suporte
  set encerrado_em = now()
  where id = v_acesso.id;

  if v_acesso.criou_membro and v_acesso.membro_id is not null then
    update public.membros_empresa
    set ativo = false
    where id = v_acesso.membro_id
      and usuario_id = auth.uid()
      and papel = 'admin';
  end if;

  perform app.registrar_auditoria(
    p_empresa,
    'plataforma.suporte_encerrado',
    'empresas',
    p_empresa::text,
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.admin_plataforma_encerrar_suporte(uuid) from public, anon;
grant execute on function public.admin_plataforma_encerrar_suporte(uuid) to authenticated;
