import { createFileRoute } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/data/types";
import { brl, dateShort, uid } from "@/lib/format";
import { useArvon } from "@/store/arvon";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — ARVON FOOD" },
      { name: "description", content: "Cadastro e histórico de consumo dos clientes." },
      { property: "og:title", content: "Clientes — ARVON FOOD" },
      { property: "og:description", content: "Cadastro e histórico de consumo dos clientes." },
    ],
  }),
  component: () => (
    <AppLayout module="clientes">
      <Clientes />
    </AppLayout>
  ),
});

function Clientes() {
  const { customers, saveCustomer } = useArvon();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Customer | null>(null);
  const list = customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description={`${customers.length} clientes cadastrados`}
        actions={<Button onClick={() => setEdit({ id: uid("cu"), name: "", phone: "", orders: 0, total: 0, lastOrderAt: new Date().toISOString() })}><Plus className="size-4" />Novo cliente</Button>}
      />
      <Input className="h-11 max-w-sm" placeholder="Buscar por nome ou telefone" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum cliente" description="Ajuste a busca ou cadastre um novo cliente." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <button key={c.id} onClick={() => setEdit(c)} className="rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary">
              <p className="font-semibold">{c.name}</p>
              <p className="text-sm text-muted-foreground">{c.phone}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><p className="text-muted-foreground">Pedidos</p><p className="font-semibold tabular-nums">{c.orders}</p></div>
                <div><p className="text-muted-foreground">Total</p><p className="font-semibold tabular-nums">{brl(c.total)}</p></div>
                <div><p className="text-muted-foreground">Último</p><p className="font-semibold">{dateShort(c.lastOrderAt)}</p></div>
              </div>
            </button>
          ))}
        </div>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{customers.some((c) => c.id === edit?.id) ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <div className="grid gap-1"><Label htmlFor="cn">Nome</Label><Input id="cn" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div className="grid gap-1"><Label htmlFor="cp">Telefone</Label><Input id="cp" inputMode="tel" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>
              <div className="grid gap-1"><Label htmlFor="co">Observações</Label><Textarea id="co" value={edit.note ?? ""} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => {
              if (!edit?.name.trim() || !edit.phone.trim()) return toast.error("Informe nome e telefone.");
              saveCustomer(edit); toast.success("Cliente salvo."); setEdit(null);
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
