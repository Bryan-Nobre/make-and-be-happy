import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function LoadingState({
  label = "Carregando…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border bg-card px-6 py-12 text-center",
        className,
      )}
    >
      <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/** Versão de tela cheia, usada enquanto a sessão e o vínculo são resolvidos. */
export function LoadingScreen({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
