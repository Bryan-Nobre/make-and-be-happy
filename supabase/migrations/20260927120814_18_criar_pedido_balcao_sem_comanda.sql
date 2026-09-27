-- Pedido de balcão não carrega v_comanda; o registro fica sem estrutura.
do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef(
    'public.criar_pedido(uuid, public.origem_pedido, jsonb, uuid, boolean, numeric, numeric, text, uuid)'::regprocedure);
  v_def := replace(v_def,
    'if p_origem = ''MESA'' and v_comanda.status = ''PAYMENT_PENDING'' then',
    'if p_origem = ''MESA'' and exists (select 1 from public.comandas where id = p_comanda and status = ''PAYMENT_PENDING'') then');
  if v_def not like '%exists (select 1 from public.comandas where id = p_comanda%' then
    raise exception 'Trecho a corrigir não encontrado.';
  end if;
  execute v_def;
end $$;
