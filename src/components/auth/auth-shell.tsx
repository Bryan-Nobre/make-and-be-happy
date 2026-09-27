import type { ReactNode } from "react";

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
        <div className="flex items-center justify-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            A
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-tight">ARVON FOOD</span>
            <span className="block text-xs text-muted-foreground">Gestão para restaurantes</span>
          </span>
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
