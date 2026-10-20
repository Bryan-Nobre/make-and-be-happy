import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  PackageX,
  RefreshCw,
} from "lucide-react";

import { Indicador, type TomIndicador } from "@/components/shared/indicador";
import {
  resumirMovimentacoesDia,
  type ItemEstoque,
  type MovimentacaoEstoque,
} from "@/services/estoque";
import { cn } from "@/lib/utils";

export type FiltroKpiEstoque =
  | "ativos"
  | "baixo"
  | "sem_estoque"
  | "entradas_hoje"
  | "saidas_hoje"
  | "ajustes_hoje";

const FUNDO_ATIVO: Record<TomIndicador, string> = {
  neutro: "border-primary/35 bg-primary-soft shadow-none",
  primario: "border-primary/45 bg-primary-soft shadow-none",
  atencao: "border-warning/45 bg-warning-soft shadow-none",
  critico: "border-destructive/40 bg-destructive-soft shadow-none",
};

export function KpisEstoque({
  itens,
  movsHoje,
  selecionados,
  onToggle,
}: {
  itens: ItemEstoque[];
  movsHoje: MovimentacaoEstoque[];
  selecionados: ReadonlySet<FiltroKpiEstoque>;
  onToggle: (filtro: FiltroKpiEstoque) => void;
}) {
  const ativos = itens.filter((i) => i.ativo);
  const baixos = ativos.filter((i) => i.status === "BAIXO").length;
  const zerados = ativos.filter((i) => i.status === "SEM_ESTOQUE").length;
  const dia = resumirMovimentacoesDia(movsHoje);

  const cards: Array<{
    id: FiltroKpiEstoque;
    rotulo: string;
    valor: number;
    icone: typeof Boxes;
    tom: TomIndicador;
  }> = [
    { id: "ativos", rotulo: "Itens ativos", valor: ativos.length, icone: Boxes, tom: "neutro" },
    {
      id: "baixo",
      rotulo: "Estoque baixo",
      valor: baixos,
      icone: AlertTriangle,
      tom: baixos > 0 ? "atencao" : "neutro",
    },
    {
      id: "sem_estoque",
      rotulo: "Sem estoque",
      valor: zerados,
      icone: PackageX,
      tom: zerados > 0 ? "critico" : "neutro",
    },
    {
      id: "entradas_hoje",
      rotulo: "Entradas hoje",
      valor: dia.entradas,
      icone: ArrowDownToLine,
      tom: "primario",
    },
    {
      id: "saidas_hoje",
      rotulo: "Saídas hoje",
      valor: dia.saidas,
      icone: ArrowUpFromLine,
      tom: "neutro",
    },
    {
      id: "ajustes_hoje",
      rotulo: "Ajustes hoje",
      valor: dia.ajustes,
      icone: RefreshCw,
      tom: "neutro",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 sm:gap-3">
      {cards.map((c) => {
        const ativo = selecionados.has(c.id);
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={ativo}
            onClick={() => onToggle(c.id)}
            className="rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Indicador
              rotulo={c.rotulo}
              valor={c.valor}
              icone={c.icone}
              tom={c.tom}
              className={cn(
                "h-full transition-[background-color,border-color,box-shadow]",
                ativo
                  ? FUNDO_ATIVO[c.tom]
                  : "hover:border-border hover:bg-muted/40",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
