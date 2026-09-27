-- Funções recebem EXECUTE de PUBLIC por padrão, e `anon` herda esse direito.
-- Revogar de PUBLIC e conceder explicitamente só a quem precisa.

do $$
declare
  v_assinatura text;
begin
  foreach v_assinatura in array array[
    'public.criar_empresa_com_owner(text, text, text, text)',
    'public.convidar_membro(uuid, text, text, public.papel_usuario)',
    'public.cancelar_convite(uuid)',
    'public.consultar_convite(text)',
    'public.aceitar_convite(text)',
    'public.alterar_papel_membro(uuid, public.papel_usuario)',
    'public.definir_membro_ativo(uuid, boolean)',
    'public.renomear_membro(uuid, text)'
  ]
  loop
    execute format('revoke all on function %s from public', v_assinatura);
    execute format('revoke all on function %s from anon', v_assinatura);
    execute format('grant execute on function %s to authenticated, service_role', v_assinatura);
  end loop;
end $$;

-- A numeração por empresa é manipulada apenas por funções SECURITY DEFINER.
revoke all on table public.sequencias_empresa from anon, authenticated;

-- Auditoria e convites são somente leitura para o cliente (owner/admin via RLS).
revoke insert, update, delete on table public.auditoria from anon, authenticated;
revoke insert, update, delete on table public.convites from anon, authenticated;
revoke insert, update, delete on table public.membros_empresa from anon, authenticated;
revoke insert, delete on table public.empresas from anon, authenticated;

-- O cliente anônimo não tem nada a fazer nestas tabelas.
revoke all on table public.empresas from anon;
revoke all on table public.membros_empresa from anon;
revoke all on table public.convites from anon;
revoke all on table public.auditoria from anon;
