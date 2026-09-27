-- A tela de Configurações precisa mostrar o e-mail de cada membro, que mora em
-- auth.users. Em vez de expor aquela tabela, entregamos só as colunas
-- necessárias por uma função restrita a owner/admin.
create or replace function public.listar_membros(p_empresa uuid)
returns table (
  id uuid,
  usuario_id uuid,
  nome_exibicao text,
  email text,
  papel public.papel_usuario,
  ativo boolean,
  criado_em timestamptz,
  sou_eu boolean
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  perform app.exigir_papel(p_empresa, array['owner', 'admin']::public.papel_usuario[]);

  return query
  select
    m.id,
    m.usuario_id,
    m.nome_exibicao,
    u.email::text,
    m.papel,
    m.ativo,
    m.criado_em,
    m.usuario_id = auth.uid()
  from public.membros_empresa m
  join auth.users u on u.id = m.usuario_id
  where m.empresa_id = p_empresa
  order by m.ativo desc, m.criado_em;
end;
$$;

revoke all on function public.listar_membros(uuid) from public, anon;
grant execute on function public.listar_membros(uuid) to authenticated, service_role;
