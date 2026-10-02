-- Logo da empresa: arquivo público (também servirá ao cardápio digital),
-- mas somente owner/admin da própria empresa podem gravar ou remover.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 524288, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists logos_leitura on storage.objects;
create policy logos_leitura on storage.objects
  for select using (bucket_id = 'logos');

drop policy if exists logos_insert on storage.objects;
create policy logos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and app.tem_papel(app.empresa_do_caminho(name), array['owner', 'admin']::public.papel_usuario[])
  );

drop policy if exists logos_update on storage.objects;
create policy logos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and app.tem_papel(app.empresa_do_caminho(name), array['owner', 'admin']::public.papel_usuario[])
  )
  with check (
    bucket_id = 'logos'
    and app.tem_papel(app.empresa_do_caminho(name), array['owner', 'admin']::public.papel_usuario[])
  );

drop policy if exists logos_delete on storage.objects;
create policy logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and app.tem_papel(app.empresa_do_caminho(name), array['owner', 'admin']::public.papel_usuario[])
  );

-- O endereço do logo é renderizado em <img>: aceita apenas https.
alter table public.empresas drop constraint if exists empresas_logo_url_https;
alter table public.empresas
  add constraint empresas_logo_url_https
  check (logo_url is null or (logo_url ~ '^https://\S+$' and length(logo_url) <= 1000));
