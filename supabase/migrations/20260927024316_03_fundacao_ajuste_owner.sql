-- A exigencia de owner ativo nao deve impedir a exclusao da propria empresa,
-- que remove os vinculos em cascata.
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
    raise exception 'A empresa precisa de pelo menos um proprietario ativo.' using errcode = '23514';
  end if;

  return null;
end;
$$;
