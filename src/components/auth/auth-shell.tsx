import { Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";

import { LogoMarca } from "@/components/shared/logo-marca";
import { Button } from "@/components/ui/button";
import { useTema } from "@/providers/tema";

export function AuthShell({
  titulo,
  descricao,
  children,
  rodape,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  const { escuro, alternar } = useTema();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      {/* Atmosfera: faixas suaves na cor da marca, sem poluir o formulário. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent),radial-gradient(circle_at_100%_100%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent),radial-gradient(circle_at_0%_80%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />

      <header className="relative z-10 flex items-center justify-end px-4 py-4 sm:px-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={alternar}
          aria-pressed={escuro}
          aria-label={escuro ? "Ativar modo claro" : "Ativar modo escuro"}
          className="gap-2 rounded-full border-border/80 bg-card/80 backdrop-blur-sm"
        >
          {escuro ? (
            <Sun className="size-4 text-primary" aria-hidden="true" />
          ) : (
            <Moon className="size-4 text-primary" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{escuro ? "Claro" : "Escuro"}</span>
        </Button>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-10 pt-2">
        <div className="w-full max-w-[400px]">
          <div className="mb-7 flex justify-center">
            <LogoMarca tamanho="lg" className="gap-3" />
          </div>

          <main className="rounded-2xl border border-border/70 bg-card/95 p-6 shadow-[0_20px_50px_-28px_color-mix(in_oklab,var(--primary)_45%,transparent)] backdrop-blur-sm sm:p-7">
            <div className="mb-5 h-1 w-12 rounded-full bg-primary" aria-hidden="true" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{titulo}</h1>
            {descricao && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{descricao}</p>
            )}
            <div className="mt-6">{children}</div>
          </main>

          {rodape && (
            <div className="mt-5 text-center text-sm leading-relaxed text-muted-foreground">
              {rodape}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
