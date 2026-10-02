import { useState } from "react";

import { cn } from "@/lib/utils";

const iniciais = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

export function LogoEmpresa({
  nome,
  logoUrl,
  className,
}: {
  nome: string;
  logoUrl: string | null;
  className?: string;
}) {
  const [falhou, setFalhou] = useState<string | null>(null);
  const mostrarImagem = logoUrl && falhou !== logoUrl;

  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card text-xs font-semibold text-primary-strong",
        !mostrarImagem && "border-transparent bg-primary-soft",
        className,
      )}
      aria-hidden="true"
    >
      {mostrarImagem ? (
        <img
          src={logoUrl}
          alt=""
          className="size-full object-contain"
          onError={() => setFalhou(logoUrl)}
        />
      ) : (
        iniciais(nome)
      )}
    </span>
  );
}
