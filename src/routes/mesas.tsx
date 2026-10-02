import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LayoutGrid, Search } from "lucide-react";
import { useState } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { PainelMesa } from "@/components/mesas/painel-mesa";
import { ListaMesas, MapaSalao } from "@/components/mesas/salao";
import { VISUAL_MESA } from "@/components/mesas/visual";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMesasEstado, useRealtimeSalao } from "@/hooks/use-pedidos";
import { STATUS_MESA } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { StatusMesa } from "@/services/pedidos";

export const Route = createFileRoute("/mesas")({
  validateSearch: (search: Record<string, unknown>): { mesa?: string } => {
    const mesa = search["mesa"];
    return typeof mesa === "string" && mesa !== "" ? { mesa } : {};
  },
  head: () => ({
    meta: [
      { title: "Mesas — ARVON FOOD" },
      { name: "description", content: "Mapa de mesas, comandas abertas e fechamento de conta." },
      { property: "og:title", content: "Mesas — ARVON FOOD" },
      {
        property: "og:description",
        content: "Mapa de mesas, comandas abertas e fechamento de conta.",
      },
    ],
  }),
  component: () => (
    <AppLayout module="mesas">
      <Mesas />
    </AppLayout>
  ),
});

type Filtro = "TODAS" | StatusMesa;

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "TODAS", label: "Todas" },
  { id: "LIVRE", label: "Livres" },
  { id: "OCUPADA", label: "Ocupadas" },
  { id: "AGUARDANDO_PAGAMENTO", label: "Aguardando pagamento" },
];

function Mesas() {
  useRealtimeSalao();
  const mesas = useMesasEstado();
  const { mesa: mesaDaUrl } = Route.useSearch();
  const navigate = useNavigate({ from: "/mesas" });
  const [destacadaId, setDestacadaId] = useState<string | null>(mesaDaUrl ?? null);
  const [painelAberto, setPainelAberto] = useState(!!mesaDaUrl);
  const [filtro, setFiltro] = useState<Filtro>("TODAS");
  const [busca, setBusca] = useState("");

  const lista = mesas.data ?? [];
  const selecionada = lista.find((m) => m.id === destacadaId) ?? null;

  const destacar = (id: string) => {
    setDestacadaId(id);
    if (mesaDaUrl) void navigate({ search: {}, replace: true });
  };

  const abrirMesa = (id: string, rolarAteMapa = false) => {
    destacar(id);
    setPainelAberto(true);
    if (rolarAteMapa) {
      document
        .querySelector(`[data-mesa-id="${id}"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  const contagem = (status: StatusMesa) => lista.filter((m) => m.status === status).length;
  const termo = busca.trim().toLowerCase();
  const visiveis = lista.filter(
    (m) =>
      (filtro === "TODAS" || m.status === filtro) &&
      (termo === "" ||
        m.nome.toLowerCase().includes(termo) ||
        (m.comandaNumero !== null && String(m.comandaNumero).includes(termo))),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mesas"
        description="Visualize o salão e acompanhe as comandas em tempo real."
      />

      {mesas.isPending ? (
        <LoadingState label="Carregando mesas…" />
      ) : mesas.isError ? (
        <ErrorState
          description="Não foi possível carregar as mesas."
          onRetry={() => void mesas.refetch()}
        />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Nenhuma mesa ativa"
          description="Cadastre mesas em Configurações para usar o salão."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div
              className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-border bg-card p-1"
              role="group"
              aria-label="Filtrar mesas"
            >
              {FILTROS.map((f) => {
                const ativo = filtro === f.id;
                const total = f.id === "TODAS" ? lista.length : contagem(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setFiltro(f.id)}
                    className={cn(
                      "flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                      ativo
                        ? "bg-primary-soft text-primary-strong"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.id !== "TODAS" && (
                      <span
                        aria-hidden="true"
                        className={cn("size-1.5 rounded-full", VISUAL_MESA[f.id].ponto)}
                      />
                    )}
                    {f.label}
                    <span
                      className={cn(
                        "rounded-md px-1.5 text-xs tabular-nums",
                        ativo ? "bg-card/70 text-primary-strong" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {total}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="relative w-full md:max-w-sm xl:w-72">
              <Search
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                className="h-10 rounded-xl bg-card pl-9"
                placeholder="Buscar mesa..."
                aria-label="Buscar mesa ou comanda"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-[208px_minmax(0,1fr)] xl:grid-cols-[256px_minmax(0,1fr)]">
            <aside
              aria-label="Lista de mesas"
              className="hidden max-h-[calc(100dvh-7rem)] self-start overflow-y-auto rounded-2xl border border-border bg-card p-2 md:sticky md:top-20 md:block"
            >
              <p className="flex items-center justify-between px-2.5 pt-1.5 pb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Salão
                <span className="tracking-normal tabular-nums">{visiveis.length}</span>
              </p>
              <ListaMesas
                mesas={visiveis}
                destacadaId={destacadaId}
                aoSelecionar={(id) => abrirMesa(id, true)}
              />
            </aside>

            <section
              aria-label="Mapa do salão"
              className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-muted/30 bg-[radial-gradient(circle,var(--color-border)_1px,transparent_1px)] bg-size-[22px_22px] px-3 pt-14 pb-8 sm:px-6 sm:pb-10 xl:px-12 xl:pb-14"
            >
              <ul
                className="absolute top-4 right-4 left-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground"
                aria-label="Legenda"
              >
                {(Object.keys(STATUS_MESA) as StatusMesa[]).map((status) => (
                  <li key={status} className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className={cn("size-2 rounded-full", VISUAL_MESA[status].ponto)}
                    />
                    {STATUS_MESA[status].label}
                  </li>
                ))}
              </ul>
              {visiveis.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="Nenhuma mesa encontrada"
                  description="Ajuste a busca ou o filtro."
                  className="border-0 bg-transparent py-10"
                />
              ) : (
                <MapaSalao
                  mesas={visiveis}
                  destacadaId={destacadaId}
                  aoSelecionar={(id) => abrirMesa(id)}
                />
              )}
            </section>
          </div>
        </>
      )}

      <Dialog
        open={painelAberto && !!selecionada}
        onOpenChange={(aberto) => !aberto && setPainelAberto(false)}
      >
        <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px]">
          {selecionada && (
            <PainelMesa
              key={selecionada.id}
              mesa={selecionada}
              mesas={lista}
              aoTrocarMesa={destacar}
              aoFechar={() => setPainelAberto(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
