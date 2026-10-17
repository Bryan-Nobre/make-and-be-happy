import type { ReactNode } from "react";

import { LogoMarca } from "@/components/shared/logo-marca";

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
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <LogoMarca />
        </div>

        <main className="mt-6 rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
          {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
          <div className="mt-5">{children}</div>
        </main>

        {rodape && <div className="mt-4 text-center text-sm text-muted-foreground">{rodape}</div>}
      </div>
    </div>
  );
}
