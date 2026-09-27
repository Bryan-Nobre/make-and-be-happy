-- ============================================================
-- ARVON FOOD - RPCs de onboarding, convites e membros
-- ============================================================

-- ------------------------------------------------------------
-- Cria a empresa e vincula quem chamou como owner.
-- ------------------------------------------------------------
create or replace function public.criar_empresa_com_owner(
  p_nome text,
  p_nome_responsavel text,
  p_telefone text default null,
  p_cnpj text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessao invalida.' using errcode = '42501';
  end if;

  insert into public.empresas (nome, telefone, cnpj)
  values (
    btrim(p_nome),
    nullif(btrim(coalesce(p_telefone, '')), ''),
    nullif(btrim(coalesce(p_cnpj, '')), '')
  )
  returning id into v_empresa;

  insert into public.membros_empresa (empresa_id, usuario_id, papel, nome_exibicao)
  values (v_empresa, auth.uid(), 'owner', btrim(p_nome_responsavel));

  -- Pedido comeca em 1001 e comanda em 1, conforme PRD 21.
  insert into public.sequencias_empresa (empresa_id, tipo, valor)
  values (v_empresa, 'PEDIDO', 1000), (v_empresa, 'COMANDA', 0);

  perform app.registrar_auditoria(
    v_empresa,
    'empresa.criada',
    'empresas',
    v_empresa::text,
    jsonb_build_object('nome', btrim(p_nome))
  );

  return v_empresa;
end;
$$;

-- ------------------------------------------------------------
-- Convites
-- ------------------------------------------------------------
create or replace function public.convidar_membro(
  p_empresa uuid,
  p_email text,
  p_nome_exibicao text,
  p_papel public.papel_usuario
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_papel_autor public.papel_usuario;
  v_email text := lower(btrim(p_email));
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  v_papel_autor := app.exigir_papel(p_empresa, array['owner', 'admin']::public.papel_usuario[]);

  -- Somente o proprietario cria outros proprietarios ou administradores.
  if v_papel_autor = 'admin' and p_papel in ('owner', 'admin') then
    raise exception 'Apenas o proprietario pode conceder este perfil.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.membros_empresa m
    join auth.users u on u.id = m.usuario_id
    where m.empresa_id = p_empresa
      and lower(u.email) = v_email
      and m.ativo
  ) then
    raise exception 'Este e-mail ja faz parte da equipe.' using errcode = '23505';
  end if;

  update public.convites
  set status = 'CANCELADO'
  where empresa_id = p_empresa
    and email = v_email
    and status = 'PENDENTE';

  insert into public.convites (
    empresa_id, email, papel, nome_exibicao, token, convidado_por, expira_em
  )
  values (
    p_empresa, v_email, p_papel, btrim(p_nome_exibicao), v_token, auth.uid(), now() + interval '7 days'
  );

  perform app.registrar_auditoria(
    p_empresa,
    'convite.criado',
    'convites',
    v_email,
    jsonb_build_object('papel', p_papel)
  );

  return v_token;
end;
$$;

create or replace function public.cancelar_convite(p_convite uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convite public.convites;
begin
  select * into v_convite from public.convites where id = p_convite;

  if v_convite.id is null then
    raise exception 'Convite nao encontrado.' using errcode = 'P0002';
  end if;

  perform app.exigir_papel(v_convite.empresa_id, array['owner', 'admin']::public.papel_usuario[]);

  update public.convites set status = 'CANCELADO' where id = p_convite and status = 'PENDENTE';

  perform app.registrar_auditoria(
    v_convite.empresa_id,
    'convite.cancelado',
    'convites',
    v_convite.email,
    null
  );
end;
$$;

-- Consulta publica pelo token: o token e o segredo.
create or replace function public.consultar_convite(p_token text)
returns table (
  empresa_nome text,
  papel public.papel_usuario,
  email text,
  nome_exibicao text,
  valido boolean
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    e.nome,
    c.papel,
    c.email,
    c.nome_exibicao,
    (c.status = 'PENDENTE' and c.expira_em > now())
  from public.convites c
  join public.empresas e on e.id = c.empresa_id
  where c.token = p_token;
$$;

create or replace function public.aceitar_convite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convite public.convites;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Sessao invalida.' using errcode = '42501';
  end if;

  select lower(email) into v_email from auth.users where id = auth.uid();

  select * into v_convite
  from public.convites
  where token = p_token
  for update;

  if v_convite.id is null then
    raise exception 'Convite nao encontrado.' using errcode = 'P0002';
  end if;

  if v_convite.status <> 'PENDENTE' then
    raise exception 'Este convite nao esta mais disponivel.' using errcode = '22023';
  end if;

  if v_convite.expira_em <= now() then
    raise exception 'Este convite expirou.' using errcode = '22023';
  end if;

  if v_convite.email <> v_email then
    raise exception 'Este convite foi enviado para outro e-mail.' using errcode = '42501';
  end if;

  insert into public.membros_empresa (empresa_id, usuario_id, papel, nome_exibicao)
  values (v_convite.empresa_id, auth.uid(), v_convite.papel, v_convite.nome_exibicao)
  on conflict (empresa_id, usuario_id) do update
    set papel = excluded.papel,
        nome_exibicao = excluded.nome_exibicao,
        ativo = true;

  update public.convites
  set status = 'ACEITO', aceito_em = now(), aceito_por = auth.uid()
  where id = v_convite.id;

  perform app.registrar_auditoria(
    v_convite.empresa_id,
    'convite.aceito',
    'membros_empresa',
    auth.uid()::text,
    jsonb_build_object('papel', v_convite.papel)
  );

  return v_convite.empresa_id;
end;
$$;

-- ------------------------------------------------------------
-- Membros
-- ------------------------------------------------------------
create or replace function public.alterar_papel_membro(
  p_membro uuid,
  p_papel public.papel_usuario
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membro public.membros_empresa;
  v_papel_autor public.papel_usuario;
begin
  select * into v_membro from public.membros_empresa where id = p_membro;

  if v_membro.id is null then
    raise exception 'Membro nao encontrado.' using errcode = 'P0002';
  end if;

  v_papel_autor := app.exigir_papel(
    v_membro.empresa_id, array['owner', 'admin']::public.papel_usuario[]
  );

  if v_membro.usuario_id = auth.uid() then
    raise exception 'Voce nao pode alterar o seu proprio perfil.' using errcode = '42501';
  end if;

  if v_papel_autor = 'admin' and (v_membro.papel in ('owner', 'admin') or p_papel in ('owner', 'admin')) then
    raise exception 'Apenas o proprietario pode gerenciar este perfil.' using errcode = '42501';
  end if;

  update public.membros_empresa set papel = p_papel where id = p_membro;

  perform app.registrar_auditoria(
    v_membro.empresa_id,
    'membro.papel_alterado',
    'membros_empresa',
    p_membro::text,
    jsonb_build_object('antes', v_membro.papel, 'depois', p_papel)
  );
end;
$$;

create or replace function public.definir_membro_ativo(p_membro uuid, p_ativo boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membro public.membros_empresa;
  v_papel_autor public.papel_usuario;
begin
  select * into v_membro from public.membros_empresa where id = p_membro;

  if v_membro.id is null then
    raise exception 'Membro nao encontrado.' using errcode = 'P0002';
  end if;

  v_papel_autor := app.exigir_papel(
    v_membro.empresa_id, array['owner', 'admin']::public.papel_usuario[]
  );

  if v_membro.usuario_id = auth.uid() then
    raise exception 'Voce nao pode desativar o seu proprio acesso.' using errcode = '42501';
  end if;

  if v_papel_autor = 'admin' and v_membro.papel in ('owner', 'admin') then
    raise exception 'Apenas o proprietario pode gerenciar este perfil.' using errcode = '42501';
  end if;

  update public.membros_empresa set ativo = p_ativo where id = p_membro;

  perform app.registrar_auditoria(
    v_membro.empresa_id,
    case when p_ativo then 'membro.reativado' else 'membro.desativado' end,
    'membros_empresa',
    p_membro::text,
    null
  );
end;
$$;

create or replace function public.renomear_membro(p_membro uuid, p_nome_exibicao text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membro public.membros_empresa;
begin
  select * into v_membro from public.membros_empresa where id = p_membro;

  if v_membro.id is null then
    raise exception 'Membro nao encontrado.' using errcode = 'P0002';
  end if;

  -- O proprio usuario pode ajustar o seu nome; owner/admin ajustam os demais.
  if v_membro.usuario_id <> auth.uid() then
    perform app.exigir_papel(v_membro.empresa_id, array['owner', 'admin']::public.papel_usuario[]);
  elsif not app.eh_membro(v_membro.empresa_id) then
    raise exception 'Voce nao tem acesso a esta empresa.' using errcode = '42501';
  end if;

  update public.membros_empresa
  set nome_exibicao = btrim(p_nome_exibicao)
  where id = p_membro;
end;
$$;

-- ------------------------------------------------------------
-- Exposicao: nenhuma RPC deste modulo deve ser chamavel sem sessao.
-- ------------------------------------------------------------
revoke execute on function public.criar_empresa_com_owner(text, text, text, text) from anon;
revoke execute on function public.convidar_membro(uuid, text, text, public.papel_usuario) from anon;
revoke execute on function public.cancelar_convite(uuid) from anon;
revoke execute on function public.consultar_convite(text) from anon;
revoke execute on function public.aceitar_convite(text) from anon;
revoke execute on function public.alterar_papel_membro(uuid, public.papel_usuario) from anon;
revoke execute on function public.definir_membro_ativo(uuid, boolean) from anon;
revoke execute on function public.renomear_membro(uuid, text) from anon;
