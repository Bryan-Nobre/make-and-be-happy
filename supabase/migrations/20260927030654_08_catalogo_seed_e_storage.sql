-- ============================================================
-- Dados iniciais da empresa + bucket de imagens de produto
-- ============================================================

-- ------------------------------------------------------------
-- A criação da empresa já entrega o mínimo para operar: um setor de
-- produção, uma categoria de catálogo e as quatro formas de pagamento.
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
  v_metodo public.metodo_pagamento;
  v_ordem integer := 0;
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
    'empresa.criada',
    'empresas',
    v_empresa::text,
    jsonb_build_object('nome', btrim(p_nome))
  );

  return v_empresa;
end;
$$;

revoke all on function public.criar_empresa_com_owner(text, text, text, text) from public, anon;
grant execute on function public.criar_empresa_com_owner(text, text, text, text)
  to authenticated, service_role;

-- ------------------------------------------------------------
-- Storage: imagens de produto em {empresa_id}/{arquivo}
-- ------------------------------------------------------------
create or replace function app.empresa_do_caminho(p_nome text)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  begin
    v_empresa := (storage.foldername(p_nome))[1]::uuid;
  exception
    when others then
      return null;
  end;

  return v_empresa;
end;
$$;

grant execute on function app.empresa_do_caminho(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'produtos',
  'produtos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Foto de produto é conteúdo de cardápio: leitura pública.
create policy produtos_imagens_leitura on storage.objects
  for select
  using (bucket_id = 'produtos');

create policy produtos_imagens_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'produtos'
    and app.tem_papel(
      app.empresa_do_caminho(name),
      array['owner', 'admin']::public.papel_usuario[]
    )
  );

create policy produtos_imagens_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'produtos'
    and app.tem_papel(
      app.empresa_do_caminho(name),
      array['owner', 'admin']::public.papel_usuario[]
    )
  );

create policy produtos_imagens_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'produtos'
    and app.tem_papel(
      app.empresa_do_caminho(name),
      array['owner', 'admin']::public.papel_usuario[]
    )
  );
