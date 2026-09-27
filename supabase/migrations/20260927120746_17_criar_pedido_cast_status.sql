-- CASE com literais resolve para text; a coluna é enum.
do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef(
    'public.criar_pedido(uuid, public.origem_pedido, jsonb, uuid, boolean, numeric, numeric, text, uuid)'::regprocedure);
  v_def := replace(v_def,
    'case when p_confirmar then ''CONFIRMED'' else ''DRAFT'' end',
    '(case when p_confirmar then ''CONFIRMED'' else ''DRAFT'' end)::public.status_operacional_pedido');
  execute v_def;
end $$;
