import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type TomIndicador = "neutro" | "primario" | "atencao" | "critico";

const TOM: Record<TomIndicador, { icone: string; valor: string }> = {
  neutro: { icone: "bg-muted text-muted-foreground", valor: "text-foreground" },
  primario: { icone: "bg-primary-soft text-primary-strong", valor: "text-foreground" },
  atencao: { icone: "bg-warning-soft text-warning-foreground", valor: "text-warning-foreground" },
  critico: { icone: "bg-destructive-soft text-destructive", valor: "text-destructive" },
};

/** Indicador compacto: rótulo, número grande e uma dica opcional. */
export function Indicador({
  rotulo,
  valor,
  dica,
  icone: Icone,
  tom = "neutro",
  className,
}: {
  rotulo: string;
  valor: string | number;
  dica?: string;
  icone: LucideIcon;
  tom?: TomIndicador;
  className?: string;
}) {
  const estilo = TOM[tom];
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-xs sm:px-4",
        className,
      )}
    >
      <span
        className={cn(
          "hidden size-10 shrink-0 items-center justify-center rounded-lg sm:flex",
          estilo.icone,
        )}
      >
        <Icone className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{rotulo}</p>
        <p
          className={cn(
            "truncate text-2xl leading-tight font-bold tracking-tight tabular-nums",
            estilo.valor,
          )}
        >
          {valor}
        </p>
        {dica && <p className="truncate text-xs text-muted-foreground">{dica}</p>}
      </div>
    </div>
  );
}
