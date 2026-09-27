-- Necessária para referências compostas futuras a membros_empresa.
alter table public.membros_empresa
  add constraint membros_empresa_empresa_id_key unique (empresa_id, id);
