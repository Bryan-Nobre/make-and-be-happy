import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Controles Anterior / Próxima para listas com `usePaginaLista`. */
export function ControlesPagina({
  pagina,
  totalPaginas,
  totalItens,
  tamanho,
  onMudar,
}: {
  pagina: number;
  totalPaginas: number;
  totalItens: number;
  tamanho: number;
  onMudar: (pagina: number) => void;
}) {
  if (totalItens <= tamanho) return null;

  const de = pagina * tamanho + 1;
  const ate = Math.min((pagina + 1) * tamanho, totalItens);

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
      <p className="text-xs text-muted-foreground tabular-nums">
        {de}–{ate} de {totalItens}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2"
          disabled={pagina <= 0}
          onClick={() => onMudar(pagina - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2"
          disabled={pagina >= totalPaginas - 1}
          onClick={() => onMudar(pagina + 1)}
        >
          Próxima
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
