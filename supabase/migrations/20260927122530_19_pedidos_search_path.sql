-- Fixa o search_path das funções auxiliares apontadas pelo advisor
-- (function_search_path_mutable). Ambas só usam os parâmetros.
alter function app.rotulo_status(public.status_operacional_pedido)
  set search_path = '';

alter function app.transicao_operacional_valida(
  public.status_operacional_pedido,
  public.status_operacional_pedido
) set search_path = '';
