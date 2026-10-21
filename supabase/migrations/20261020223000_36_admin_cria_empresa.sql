-- Empresas e logins passam a ser criados só pelo admin da plataforma.
-- O público não chama mais criar_empresa_com_owner.

revoke all on function public.criar_empresa_com_owner(text, text, text, text) from public, anon, authenticated;
grant execute on function public.criar_empresa_com_owner(text, text, text, text) to service_role;

create or replace function public.admin_plataforma_criar_empresa(
  p_nome text,
  p_nome_responsavel text,
  p_email text,
  p_senha text,
  p_telefone text default null
)
returns table (
  empresa_id uuid,
  usuario_id uuid,
  email text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
  v_usuario uuid := gen_random_uuid();
  v_email text;
  v_metodo public.metodo_pagamento;
  v_ordem integer := 0;
begin
  perform app.exigir_admin_plataforma();

  if length(btrim(coalesce(p_nome, ''))) < 2 then
    raise exception 'Informe o nome do restaurante.';
  end if;

  if length(btrim(coalesce(p_nome_responsavel, ''))) < 2 then
    raise exception 'Informe o nome do responsável.';
  end if;

  v_email := lower(btrim(coalesce(p_email, '')));
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Informe um e-mail válido.';
  end if;

  if length(coalesce(p_senha, '')) < 8 then
    raise exception 'A senha precisa ter pelo menos 8 caracteres.';
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'Já existe uma conta com este e-mail.';
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    is_sso_user,
    is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_usuario,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_senha, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', btrim(p_nome_responsavel)),
    now(),
    now(),
    '',
    '',
    '',
    '',
    false,
    false
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    v_usuario,
    v_usuario,
    jsonb_build_object('sub', v_usuario::text, 'email', v_email, 'email_verified', true),
    'email',
    v_usuario::text,
    now(),
    now(),
    now()
  );

  insert into public.empresas (nome, telefone)
  values (
    btrim(p_nome),
    nullif(btrim(coalesce(p_telefone, '')), '')
  )
  returning id into v_empresa;

  insert into public.membros_empresa (empresa_id, usuario_id, papel, nome_exibicao)
  values (v_empresa, v_usuario, 'owner', btrim(p_nome_responsavel));

  insert into public.sequencias_empresa (empresa_id, tipo, valor)
  values (v_empresa, 'PEDIDO', 1000), (v_empresa, 'COMANDA', 0);

  insert into public.setores_cozinha (empresa_id, nome, ordem)
  values (v_empresa, 'Cozinha', 1);

  insert into public.categorias (empresa_id, nome, ordem)
  values (v_empresa, 'Cardápio', 1);

  foreach v_metodo in array enum_range(null::public.metodo_pagamento)
  loop
    v_ordem := v_ordem + 1;
    insert into public.formas_pagamento (empresa_id, metodo, ordem)
    values (v_empresa, v_metodo, v_ordem);
  end loop;

  perform app.registrar_auditoria(
    v_empresa,
    'plataforma.empresa_criada',
    'empresas',
    v_empresa::text,
    jsonb_build_object(
      'nome', btrim(p_nome),
      'email_owner', v_email,
      'usuario_id', v_usuario
    )
  );

  empresa_id := v_empresa;
  usuario_id := v_usuario;
  email := v_email;
  return next;
end;
$$;

revoke all on function public.admin_plataforma_criar_empresa(text, text, text, text, text)
  from public, anon;
grant execute on function public.admin_plataforma_criar_empresa(text, text, text, text, text)
  to authenticated;
