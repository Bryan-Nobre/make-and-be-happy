import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Flashlight, FlashlightOff, ScanBarcode } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

const FORMATOS_ESTOQUE = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
  BarcodeFormat.QR_CODE,
];

const CONSTRAINTS_ALTA: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
};

const CONSTRAINTS_BASICA: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

function criarHints() {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATOS_ESTOQUE);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return hints;
}

/**
 * Campo preparado para leitor USB (modo teclado) ou câmera.
 * O leitor USB costuma digitar rápido e enviar Enter.
 */
export function LeitorCodigo({ onCodigo, desabilitado, modo = "usb", className }: Props) {
  const id = useId();
  const [valor, setValor] = useState("");
  const [lanternaLigada, setLanternaLigada] = useState(false);
  const [temLanterna, setTemLanterna] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlesRef = useRef<IScannerControls | null>(null);
  const onCodigoRef = useRef(onCodigo);
  const desabilitadoRef = useRef(desabilitado);
  const ultimoLido = useRef<{ codigo: string; em: number }>({ codigo: "", em: 0 });

  onCodigoRef.current = onCodigo;
  desabilitadoRef.current = desabilitado;

  const emitir = (bruto: string) => {
    const codigo = normalizarCodigoBarras(bruto);
    if (!codigo || desabilitadoRef.current) return;
    const agora = Date.now();
    if (ultimoLido.current.codigo === codigo && agora - ultimoLido.current.em < 1200) return;
    ultimoLido.current = { codigo, em: agora };
    onCodigoRef.current(codigo);
    setValor("");
  };

  useEffect(() => {
    if (modo !== "camera") return;

    const reader = new BrowserMultiFormatReader(criarHints(), {
      delayBetweenScanAttempts: 120,
      delayBetweenScanSuccess: 800,
      tryPlayVideoTimeout: 8000,
    });
    let cancelado = false;

    void (async () => {
      try {
        if (!videoRef.current) return;

        let controles: IScannerControls;
        try {
          controles = await reader.decodeFromConstraints(
            CONSTRAINTS_ALTA,
            videoRef.current,
            (resultado) => {
              if (cancelado || !resultado) return;
              emitir(resultado.getText());
            },
          );
        } catch {
          if (cancelado || !videoRef.current) return;
          controles = await reader.decodeFromConstraints(
            CONSTRAINTS_BASICA,
            videoRef.current,
            (resultado) => {
              if (cancelado || !resultado) return;
              emitir(resultado.getText());
            },
          );
        }

        if (cancelado) {
          controles.stop();
          return;
        }

        controlesRef.current = controles;
        setTemLanterna(typeof controles.switchTorch === "function");

        // Foco contínuo quando o device permitir (constraint experimental)
        try {
          controles.streamVideoConstraintsApply?.({
            advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
          });
        } catch {
          /* ignore */
        }
      } catch {
        if (!cancelado) {
          toast.error("Não foi possível abrir a câmera. Verifique a permissão.");
        }
      }
    })();

    return () => {
      cancelado = true;
      const controles = controlesRef.current;
      controlesRef.current = null;
      if (controles?.switchTorch) {
        void controles.switchTorch(false).catch(() => undefined);
      }
      controles?.stop();
      setLanternaLigada(false);
      setTemLanterna(false);
    };
  }, [modo]);

  useEffect(() => {
    if (modo === "usb" && !desabilitado) inputRef.current?.focus();
  }, [modo, desabilitado]);

  const alternarLanterna = async () => {
    const controles = controlesRef.current;
    if (!controles?.switchTorch) return;
    const proximo = !lanternaLigada;
    try {
      await controles.switchTorch(proximo);
      setLanternaLigada(proximo);
    } catch {
      toast.error("Não foi possível acionar a lanterna neste aparelho.");
      setTemLanterna(false);
    }
  };

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
          <div className="relative aspect-video w-full bg-black">
            <video
              ref={videoRef}
              className="size-full object-cover"
              muted
              playsInline
              autoPlay
            />
            {/* Guia: encaixe o código na faixa central */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-[28%] w-[78%] max-w-md">
                <div className="absolute inset-0 rounded-md border-2 border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                <span className="absolute -top-px -left-px size-4 rounded-tl-md border-t-[3px] border-l-[3px] border-emerald-400" />
                <span className="absolute -top-px -right-px size-4 rounded-tr-md border-t-[3px] border-r-[3px] border-emerald-400" />
                <span className="absolute -bottom-px -left-px size-4 rounded-bl-md border-b-[3px] border-l-[3px] border-emerald-400" />
                <span className="absolute -right-px -bottom-px size-4 rounded-br-md border-r-[3px] border-b-[3px] border-emerald-400" />
              </div>
            </div>
            {temLanterna ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute right-2 bottom-2 size-9 bg-black/55 text-white hover:bg-black/70"
                onClick={() => void alternarLanterna()}
                disabled={desabilitado}
                aria-pressed={lanternaLigada}
                aria-label={lanternaLigada ? "Desligar lanterna" : "Ligar lanterna"}
              >
                {lanternaLigada ? (
                  <FlashlightOff className="size-4" aria-hidden="true" />
                ) : (
                  <Flashlight className="size-4" aria-hidden="true" />
                )}
              </Button>
            ) : null}
          </div>
          <p className="bg-card px-3 py-2 text-xs text-muted-foreground">
            Encaixe o código na faixa. Boa luz e distância ~10–20 cm ajudam.
          </p>
        </div>
      )}
    </div>
  );
}
