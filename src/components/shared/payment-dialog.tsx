import { useState } from "react";
import { toast } from "sonner";
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
import { MoneyInput } from "@/components/shared/money-input";
import type { PaymentMethod } from "@/data/types";
import { brl } from "@/lib/format";
import { PAYMENT_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function PaymentDialog({
  open,
  onOpenChange,
  total,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  total: number;
  onConfirm: (p: { method: PaymentMethod; amount: number; received?: number; change?: number }) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("PIX");
  const [received, setReceived] = useState<number | "">("");
  const change = method === "DINHEIRO" && received !== "" ? received - total : 0;

  const confirm = () => {
    if (method === "DINHEIRO" && (received === "" || received < total)) {
      toast.error("Valor recebido menor que o total.");
      return;
    }
    onConfirm({
      method,
      amount: total,
      received: method === "DINHEIRO" ? Number(received) : undefined,
      change: method === "DINHEIRO" ? change : undefined,
    });
    setReceived("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receber pagamento</DialogTitle>
          <DialogDescription>Total a receber: {brl(total)}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((m) => (
            <Button
              key={m}
              type="button"
              variant="outline"
              className={cn("h-12", method === m && "border-primary bg-primary-soft text-primary")}
              onClick={() => setMethod(m)}
            >
              {PAYMENT_LABEL[m]}
            </Button>
          ))}
        </div>
        {method === "DINHEIRO" && (
          <div className="space-y-2">
            <Label htmlFor="recv">Valor recebido</Label>
            <MoneyInput id="recv" value={received} onChange={setReceived} autoFocus />
            <p className="text-sm text-muted-foreground">
              Troco: <span className="font-semibold text-foreground">{brl(Math.max(0, change))}</span>
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm}>Confirmar {brl(total)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
