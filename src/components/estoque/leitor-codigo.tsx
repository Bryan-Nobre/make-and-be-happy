import { BrowserMultiFormatReader } from "@zxing/browser";
import { ScanBarcode } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { normalizarCodigoBarras } from "@/services/estoque";

type Props = {
  onCodigo: (codigo: string) => void;
  desabilitado?: boolean;
  /** usb = campo + Enter; camera = vídeo contínuo. */
  modo?: "usb" | "camera";
  className?: string;
};

/**
 * Campo preparado para leitor USB (modo teclado) ou câmera.
 * O leitor USB costuma digitar rápido e enviar Enter.
 */
export function LeitorCodigo({ onCodigo, desabilitado, modo = "usb", className }: Props) {
  const id = useId();
  const [valor, setValor] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ultimoLido = useRef<{ codigo: string; em: number }>({ codigo: "", em: 0 });

  const emitir = (bruto: string) => {
    const codigo = normalizarCodigoBarras(bruto);
    if (!codigo || desabilitado) return;
    const agora = Date.now();
    if (ultimoLido.current.codigo === codigo && agora - ultimoLido.current.em < 1200) return;
    ultimoLido.current = { codigo, em: agora };
    onCodigo(codigo);
    setValor("");
  };

  useEffect(() => {
    if (modo !== "camera") return;

    const reader = new BrowserMultiFormatReader();
    let cancelado = false;
    let parar: (() => void) | undefined;

    void (async () => {
      try {
        if (!videoRef.current) return;
        const controles = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (resultado) => {
            if (cancelado) return;
            if (resultado) emitir(resultado.getText());
          },
        );
        if (cancelado) {
          controles.stop();
          return;
        }
        parar = () => controles.stop();
      } catch {
        if (!cancelado) {
          toast.error("Não foi possível abrir a câmera. Verifique a permissão.");
        }
      }
    })();

    return () => {
      cancelado = true;
      parar?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessão de câmera
  }, [modo, desabilitado]);

  useEffect(() => {
    if (modo === "usb" && !desabilitado) inputRef.current?.focus();
  }, [modo, desabilitado]);

  return (
    <div className={cn("space-y-3", className)}>
      {modo === "usb" ? (
        <div className="space-y-1.5">
          <Label htmlFor={id}>Código de barras</Label>
          <div className="relative">
            <ScanBarcode
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              ref={inputRef}
              id={id}
              className="pl-9 font-mono tracking-wide"
              placeholder="Bipe ou digite e pressione Enter"
              value={valor}
              disabled={desabilitado}
              autoComplete="off"
              inputMode="numeric"
              onChange={(e) => setValor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                emitir(valor);
              }}
            />
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-black">
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
          <p className="bg-card px-3 py-2 text-xs text-muted-foreground">
            Aponte para o código. A leitura entra na lista automaticamente.
          </p>
        </div>
      )}
    </div>
  );
}
