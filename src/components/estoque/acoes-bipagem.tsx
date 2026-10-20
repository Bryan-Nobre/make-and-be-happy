import { ArrowDownToLine, ArrowUpFromLine, Camera, Keyboard, ScanBarcode } from "lucide-react";
import { useState } from "react";

import { SessaoBipagem } from "@/components/estoque/sessao-bipagem";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ItemEstoque } from "@/services/estoque";

type ModoLeitura = "usb" | "camera";
type Operacao = "ENTRADA" | "SAIDA";

type Props = {
  itens: ItemEstoque[];
  className?: string;
};

/**
 * Card compacto da coluna direita: Leitor USB / Câmera.
 * Depois escolhe Entrada ou Saída e abre a sessão de bipagem.
 */
export function AcoesBipagem({ itens, className }: Props) {
  const [modo, setModo] = useState<ModoLeitura | null>(null);
  const [operacao, setOperacao] = useState<Operacao | null>(null);

  const fechar = () => {
    setModo(null);
    setOperacao(null);
  };

  return (
    <>
      <div className={cn("rounded-xl border border-border bg-card p-3 shadow-xs", className)}>
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-strong">
            <ScanBarcode className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight text-foreground">
              Escanear código de barras
            </h2>
            <p className="text-xs leading-snug text-muted-foreground">
              Nada é gravado até confirmar.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => {
              setModo("usb");
              setOperacao(null);
            }}
          >
            <Keyboard className="size-3.5" aria-hidden="true" />
            Leitor USB
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 gap-1.5"
            onClick={() => {
              setModo("camera");
              setOperacao(null);
            }}
          >
            <Camera className="size-3.5" aria-hidden="true" />
            Câmera
          </Button>
        </div>
      </div>

      <Dialog open={!!modo} onOpenChange={(abrir) => !abrir && fechar()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {!operacao ? (
            <>
              <DialogHeader>
                <DialogTitle>Entrada ou saída?</DialogTitle>
                <DialogDescription>
                  {modo === "usb"
                    ? "Leitor USB selecionado. O que você quer registrar?"
                    : "Câmera selecionada. O que você quer registrar?"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  type="button"
                  className="h-10 gap-1.5"
                  onClick={() => setOperacao("ENTRADA")}
                >
                  <ArrowDownToLine className="size-4" aria-hidden="true" />
                  Entrada
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-1.5"
                  onClick={() => setOperacao("SAIDA")}
                >
                  <ArrowUpFromLine className="size-4" aria-hidden="true" />
                  Saída
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  {operacao === "ENTRADA" ? "Bipagem · Entrada" : "Bipagem · Saída"}
                </DialogTitle>
                <DialogDescription>
                  {modo === "usb"
                    ? "Use o leitor USB no campo (Enter ao final)."
                    : "Aponte a câmera para o código."}{" "}
                  Ajuste as quantidades e confirme.
                </DialogDescription>
              </DialogHeader>
              {modo && (
                <SessaoBipagem
                  itens={itens}
                  tipo={operacao}
                  modoLeitura={modo}
                  embutido
                  onConcluido={fechar}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
