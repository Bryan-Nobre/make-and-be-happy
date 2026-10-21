import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Controles Anterior / Próxima para listas com `usePaginaLista`. */
export function ControlesPagina({
  pagina,
  totalPaginas,
  totalItens,
  tamanho,
  onMudar,
  /** Se true, mostra o rodapé mesmo com uma única página. */
  sempreVisivel = false,
  className,
}: {
  pagina: number;
  totalPaginas: number;
  totalItens: number;
  tamanho: number;
  onMudar: (pagina: number) => void;
  sempreVisivel?: boolean;
  className?: string;
}) {
  if (totalItens === 0) return null;
  if (!sempreVisivel && totalItens <= tamanho) return null;

  const paginas = Math.max(1, totalPaginas);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-t border-border pt-3",
        className,
      )}
    >
      <p className="min-w-0 truncate text-xs text-muted-foreground tabular-nums">
        Página {pagina + 1} de {paginas} · {totalItens}{" "}
        {totalItens === 1 ? "item" : "itens"}
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 rounded-md"
          disabled={pagina <= 0}
          onClick={() => onMudar(pagina - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 rounded-md"
          disabled={pagina >= paginas - 1}
          onClick={() => onMudar(pagina + 1)}
          aria-label="Próxima página"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
