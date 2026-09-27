import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Confirmação de operação destrutiva que exige um motivo para a auditoria. */
export function DialogoMotivo({
  aberto,
  titulo,
  descricao,
  confirmando,
  rotuloConfirmar = "Confirmar cancelamento",
  rotuloConfirmando = "Cancelando…",
  exemplo = "Ex.: cliente desistiu",
  aoFechar,
  aoConfirmar,
}: {
  aberto: boolean;
  titulo: string;
  descricao: string;
  confirmando: boolean;
  rotuloConfirmar?: string;
  rotuloConfirmando?: string;
  exemplo?: string;
  aoFechar: () => void;
  aoConfirmar: (motivo: string) => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <FormularioMotivo
          confirmando={confirmando}
          rotuloConfirmar={rotuloConfirmar}
          rotuloConfirmando={rotuloConfirmando}
          exemplo={exemplo}
          aoFechar={aoFechar}
          aoConfirmar={aoConfirmar}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Fica dentro do conteúdo do diálogo para o texto zerar sempre que ele fecha. */
function FormularioMotivo({
  confirmando,
  rotuloConfirmar,
  rotuloConfirmando,
  exemplo,
  aoFechar,
  aoConfirmar,
}: {
  confirmando: boolean;
  rotuloConfirmar: string;
  rotuloConfirmando: string;
  exemplo: string;
  aoFechar: () => void;
  aoConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const valido = motivo.trim().length >= 3;

  return (
    <>
      <form
        id="form-motivo"
        className="space-y-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (valido) aoConfirmar(motivo.trim());
        }}
      >
        <Label htmlFor="motivo">Motivo</Label>
        <Textarea
          id="motivo"
          value={motivo}
          maxLength={300}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={exemplo}
        />
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={aoFechar}>
          Voltar
        </Button>
        <Button
          type="submit"
          form="form-motivo"
          variant="destructive"
          disabled={!valido || confirmando}
        >
          {confirmando ? rotuloConfirmando : rotuloConfirmar}
        </Button>
      </DialogFooter>
    </>
  );
}
