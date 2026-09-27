-- Contrato de erro do ARVON FOOD.
--
-- Toda violação de regra de negócio levanta P0001 (padrão de RAISE) com uma
-- mensagem escrita para o usuário final. O frontend exibe a mensagem apenas
-- quando o código é P0001; qualquer outro erro vira mensagem genérica, para
-- nunca expor estrutura interna do banco.

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
    raise exception 'Sua sessão expirou. Entre novamente.';
  end if;

  v_papel := app.papel(p_empresa);

  if v_papel is null then
    raise exception 'Você não tem acesso a esta empresa.';
  end if;

  if not (v_papel = any (p_papeis)) then
    raise exception 'Seu perfil não permite esta operação.';
  end if;

  return v_papel;
end;
$$;

create or replace function app.tg_exigir_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid := coalesce(old.empresa_id, new.empresa_id);
begin
  if not exists (select 1 from public.empresas where id = v_empresa) then
    return null;
  end if;

  if not exists (
    select 1
    from public.membros_empresa m
    where m.empresa_id = v_empresa
      and m.papel = 'owner'
      and m.ativo
  ) then
    raise exception 'A empresa precisa de pelo menos um proprietário ativo.';
  end if;

  return null;
end;
$$;

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
    raise exception 'Sua sessão expirou. Entre novamente.';
  end if;

  if length(btrim(coalesce(p_nome, ''))) < 2 then
    raise exception 'Informe o nome do restaurante.';
  end if;

  if length(btrim(coalesce(p_nome_responsavel, ''))) < 2 then
    raise exception 'Informe o seu nome.';
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

  -- Pedido começa em 1001 e comanda em 1, conforme PRD 21.
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
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  v_papel_autor := app.exigir_papel(p_empresa, array['owner', 'admin']::public.papel_usuario[]);

  if v_papel_autor = 'admin' and p_papel in ('owner', 'admin') then
    raise exception 'Apenas o proprietário pode conceder este perfil.';
  end if;

  if v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
    raise exception 'Informe um e-mail válido.';
  end if;

  if length(btrim(coalesce(p_nome_exibicao, ''))) < 2 then
    raise exception 'Informe o nome da pessoa convidada.';
  end if;

  if exists (
    select 1
    from public.membros_empresa m
    join auth.users u on u.id = m.usuario_id
    where m.empresa_id = p_empresa
      and lower(u.email) = v_email
      and m.ativo
  ) then
    raise exception 'Este e-mail já faz parte da equipe.';
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
    p_empresa, 'convite.criado', 'convites', v_email, jsonb_build_object('papel', p_papel)
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
    raise exception 'Convite não encontrado.';
  end if;

  perform app.exigir_papel(v_convite.empresa_id, array['owner', 'admin']::public.papel_usuario[]);

  update public.convites set status = 'CANCELADO' where id = p_convite and status = 'PENDENTE';

  perform app.registrar_auditoria(
    v_convite.empresa_id, 'convite.cancelado', 'convites', v_convite.email, null
  );
end;
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
    raise exception 'Sua sessão expirou. Entre novamente.';
  end if;

  select lower(email) into v_email from auth.users where id = auth.uid();

  select * into v_convite from public.convites where token = p_token for update;

  if v_convite.id is null then
    raise exception 'Convite não encontrado.';
  end if;

  if v_convite.status <> 'PENDENTE' then
    raise exception 'Este convite não está mais disponível.';
  end if;

  if v_convite.expira_em <= now() then
    raise exception 'Este convite expirou. Peça um novo ao administrador.';
  end if;

  if v_convite.email <> v_email then
    raise exception 'Este convite foi enviado para outro e-mail.';
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
    raise exception 'Membro não encontrado.';
  end if;

  v_papel_autor := app.exigir_papel(
    v_membro.empresa_id, array['owner', 'admin']::public.papel_usuario[]
  );

  if v_membro.usuario_id = auth.uid() then
    raise exception 'Você não pode alterar o seu próprio perfil.';
  end if;

  if v_papel_autor = 'admin' and (v_membro.papel in ('owner', 'admin') or p_papel in ('owner', 'admin')) then
    raise exception 'Apenas o proprietário pode gerenciar este perfil.';
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
    raise exception 'Membro não encontrado.';
  end if;

  v_papel_autor := app.exigir_papel(
    v_membro.empresa_id, array['owner', 'admin']::public.papel_usuario[]
  );

  if v_membro.usuario_id = auth.uid() then
    raise exception 'Você não pode desativar o seu próprio acesso.';
  end if;

  if v_papel_autor = 'admin' and v_membro.papel in ('owner', 'admin') then
    raise exception 'Apenas o proprietário pode gerenciar este perfil.';
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
  if length(btrim(coalesce(p_nome_exibicao, ''))) < 2 then
    raise exception 'Informe um nome válido.';
  end if;

  select * into v_membro from public.membros_empresa where id = p_membro;

  if v_membro.id is null then
    raise exception 'Membro não encontrado.';
  end if;

  if v_membro.usuario_id <> auth.uid() then
    perform app.exigir_papel(v_membro.empresa_id, array['owner', 'admin']::public.papel_usuario[]);
  elsif not app.eh_membro(v_membro.empresa_id) then
    raise exception 'Você não tem acesso a esta empresa.';
  end if;

  update public.membros_empresa
  set nome_exibicao = btrim(p_nome_exibicao)
  where id = p_membro;
end;
$$;
