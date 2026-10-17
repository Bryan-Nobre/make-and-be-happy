import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { chaves } from "@/lib/chaves";
import { useEmpresaAtual } from "@/providers/empresa";
import { listarSessoesNoPeriodo } from "@/services/caixa";
import * as servico from "@/services/relatorios";

const INTERVALO_DASHBOARD_MS = 30_000;

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function useResumoDashboard() {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: [...chaves.dashboard(empresa.id), "resumo"],
    queryFn: () => servico.buscarResumoDashboard(empresa.id),
    refetchInterval: INTERVALO_DASHBOARD_MS,
  });
}

export function usePedidosDeHoje() {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: [...chaves.dashboard(empresa.id), "pedidos"],
    queryFn: () => servico.listarPedidosDeHoje(empresa.id),
    refetchInterval: INTERVALO_DASHBOARD_MS,
  });
}

export function useEstoqueEmAlerta() {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: [...chaves.estoque(empresa.id), "alerta"],
    queryFn: () => servico.listarEstoqueEmAlerta(empresa.id),
    refetchInterval: INTERVALO_DASHBOARD_MS,
  });
}

// ---------------------------------------------------------------------------
// Relatórios
// ---------------------------------------------------------------------------

function useRelatorio<T>(
  nome: string,
  periodo: servico.Periodo,
  consultar: (empresaId: string, periodo: servico.Periodo) => Promise<T>,
) {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: [...chaves.relatorios(empresa.id, periodo.inicio, periodo.fim), nome],
    queryFn: () => consultar(empresa.id, periodo),
  });
}

export const useResumoVendas = (periodo: servico.Periodo) =>
  useRelatorio("resumo", periodo, servico.buscarResumoVendas);

export const useVendasDiarias = (periodo: servico.Periodo) =>
  useRelatorio("diarias", periodo, servico.listarVendasDiarias);

export const useFormasPagamento = (periodo: servico.Periodo) =>
  useRelatorio("formas", periodo, servico.listarFormasPagamento);

export const useProdutosVendidos = (periodo: servico.Periodo) =>
  useRelatorio("produtos", periodo, servico.listarProdutosVendidos);

export const useResumoEstoque = (periodo: servico.Periodo) =>
  useRelatorio("estoque", periodo, servico.listarResumoEstoque);

export const useCancelamentos = (periodo: servico.Periodo) =>
  useRelatorio("cancelamentos", periodo, servico.listarCancelamentos);

export function useAuditoria(filtros: servico.FiltrosAuditoria) {
  const { empresa } = useEmpresaAtual();
  const { periodo, categoria, usuarioId } = filtros;

  return useInfiniteQuery({
    queryKey: [
      ...chaves.relatorios(empresa.id, periodo.inicio, periodo.fim),
      "auditoria",
      categoria ?? "todas",
      usuarioId ?? "todos",
    ],
    queryFn: ({ pageParam }) => servico.listarAuditoria(empresa.id, filtros, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (ultima) =>
      ultima.length < servico.TAMANHO_PAGINA_AUDITORIA ? undefined : ultima.at(-1)?.id,
  });
}

export function useAutoresAuditoria() {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: [...chaves.membros(empresa.id), "autores"],
    queryFn: () => servico.listarAutoresAuditoria(empresa.id),
    staleTime: 5 * 60 * 1000,
  });
}

export const useSessoesNoPeriodo = (periodo: servico.Periodo) =>
  useRelatorio("caixa", periodo, (empresaId, p) => {
    const { de, ate } = servico.limitesDoPeriodo(p);
    return listarSessoesNoPeriodo(empresaId, de, ate);
  });
