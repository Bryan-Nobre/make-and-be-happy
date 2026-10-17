import { cn } from "@/lib/utils";

/** Marca Arvon Food (logo do produto, não a logo do restaurante). */
export function LogoMarca({
  className,
  mostrarNome = true,
  tamanho = "md",
}: {
  className?: string;
  mostrarNome?: boolean;
  tamanho?: "sm" | "md" | "lg";
}) {
  const img = tamanho === "sm" ? "size-7" : tamanho === "lg" ? "size-11" : "size-9";
  const titulo = tamanho === "sm" ? "text-sm" : tamanho === "lg" ? "text-base" : "text-sm";

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <img
        src="/logo-arvon.png"
        alt=""
        width={596}
        height={596}
        className={cn(img, "shrink-0 rounded-md object-contain")}
        decoding="async"
      />
      {mostrarNome && (
        <span className="min-w-0 leading-tight">
          <span className={cn("block truncate font-bold tracking-tight text-foreground", titulo)}>
            Arvon Food
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            Gestão para restaurantes
          </span>
        </span>
      )}
    </span>
  );
}
