import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

export type PedidoDeConfirmacao = {
  titulo: string;
  descricao?: string;
  acao: string;
  aoConfirmar: () => void;
};

/**
 * Confirmação para ações destrutivas. `confirmar` abre o diálogo e `dialogo`
 * precisa ser renderizado uma vez pelo componente que usa o hook.
 */
export function useConfirmacao() {
  const [pedido, setPedido] = useState<PedidoDeConfirmacao | null>(null);
  // Mantém o texto enquanto a animação de fechamento roda.
  const [ultimo, setUltimo] = useState<PedidoDeConfirmacao | null>(null);

  const confirmar = (novo: PedidoDeConfirmacao) => {
    setUltimo(novo);
    setPedido(novo);
  };

  const dialogo = (
    <AlertDialog open={pedido !== null} onOpenChange={(aberto) => !aberto && setPedido(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{ultimo?.titulo}</AlertDialogTitle>
          <AlertDialogDescription>
            {ultimo?.descricao ?? "Esta ação não pode ser desfeita."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={() => pedido?.aoConfirmar()}
          >
            {ultimo?.acao}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirmar, dialogo };
}
