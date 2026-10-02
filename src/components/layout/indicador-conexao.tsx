import { dateTime } from "@/lib/format";
import { useConexao, type EstadoConexao } from "@/lib/offline/conectividade";
import { cn } from "@/lib/utils";
import { useCacheOffline } from "@/providers/offline";

const VISUAL: Record<
  EstadoConexao,
  { texto: string; curto: string; ponto: string; caixa: string }
> = {
  ONLINE: {
    texto: "Online",
    curto: "",
    ponto: "bg-success",
    caixa: "text-muted-foreground",
  },
  INSTAVEL: {
    texto: "Conexão instável",
    curto: "Instável",
    ponto: "bg-warning animate-pulse",
    caixa: "border-warning/40 bg-warning-soft text-foreground",
  },
  OFFLINE: {
    texto: "Offline — usando dados salvos",
    curto: "Offline",
    ponto: "bg-destructive",
    caixa: "border-destructive/30 bg-destructive-soft text-foreground",
  },
};

/** Estado da conexão no header. Informativo: nunca bloqueia a tela. */
export function IndicadorConexao() {
  const conexao = useConexao();
  const { ultimaSincronizacao } = useCacheOffline();
  const visual = VISUAL[conexao];
  const sincronizado = ultimaSincronizacao
    ? `Última sincronização: ${dateTime(new Date(ultimaSincronizacao).toISOString())}`
    : "Nenhum dado salvo neste aparelho ainda";

  return (
    <span
      role="status"
      aria-live="polite"
      title={conexao === "ONLINE" ? undefined : sincronizado}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border border-transparent px-2.5 text-xs font-medium",
        visual.caixa,
      )}
    >
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", visual.ponto)} />
      {conexao === "ONLINE" ? (
        <span className="sr-only md:not-sr-only">{visual.texto}</span>
      ) : (
        <>
          <span className="hidden sm:inline">{visual.texto}</span>
          <span className="sm:hidden">{visual.curto}</span>
          <span className="sr-only">. {sincronizado}</span>
        </>
      )}
    </span>
  );
}
