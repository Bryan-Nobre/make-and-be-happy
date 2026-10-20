import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Transações recentes / histórico. */
export const ITENS_POR_PAGINA_ESTOQUE = 10;

/** Lista de insumos (desktop/mobile). */
export const INSUMOS_POR_PAGINA = 20;

export function fatiaPagina<T>(itens: T[], pagina: number, porPagina = ITENS_POR_PAGINA_ESTOQUE): T[] {
  const inicio = (pagina - 1) * porPagina;
  return itens.slice(inicio, inicio + porPagina);
}

export function totalPaginas(total: number, porPagina = ITENS_POR_PAGINA_ESTOQUE): number {
  return Math.max(1, Math.ceil(Math.max(total, 1) / porPagina));
}

export function PaginacaoEstoque({
  pagina,
  total,
  onChange,
  porPagina = ITENS_POR_PAGINA_ESTOQUE,
  /** Se false, mostra o rodapé mesmo com uma única página (útil nos insumos). */
  ocultarSeUnica = true,
  className,
}: {
  pagina: number;
  total: number;
  onChange: (pagina: number) => void;
  porPagina?: number;
  ocultarSeUnica?: boolean;
  className?: string;
}) {
  if (total === 0) return null;
  if (ocultarSeUnica && total <= porPagina) return null;

  const paginas = totalPaginas(total, porPagina);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-2.5 text-sm text-muted-foreground",
        className,
      )}
    >
      <p className="min-w-0 truncate">
        Página {pagina} de {paginas} · {total} itens
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-8 rounded-md"
          disabled={pagina <= 1}
          onClick={() => onChange(pagina - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-8 rounded-md"
          disabled={pagina >= paginas}
          onClick={() => onChange(pagina + 1)}
          aria-label="Próxima página"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
