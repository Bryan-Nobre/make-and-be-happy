import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppLayout, NAV } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Role } from "@/data/types";
import { PERMISSIONS, ROLE_LABEL, useArvon } from "@/store/arvon";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — ARVON FOOD" },
      { name: "description", content: "Dados da empresa, regras de operação, usuários e permissões." },
      { property: "og:title", content: "Configurações — ARVON FOOD" },
      { property: "og:description", content: "Dados da empresa, regras de operação, usuários e permissões." },
    ],
  }),
  component: () => (
    <AppLayout module="configuracoes">
      <Config />
    </AppLayout>
  ),
});

function Config() {
  const { company, updateCompany, users } = useArvon();
  const [form, setForm] = useState(company);
  const field = (k: "name" | "cnpj" | "phone" | "address" | "openingHours", label: string) => (
    <div className="grid gap-1">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Ajuste os dados e as regras do restaurante." />
      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold">Empresa</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {field("name", "Nome fantasia")}
          {field("cnpj", "CNPJ")}
          {field("phone", "Telefone")}
          {field("openingHours", "Horário de funcionamento")}
          <div className="md:col-span-2">{field("address", "Endereço")}</div>
        </div>
      </section>
      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold">Operação</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="grid gap-1">
            <Label htmlFor="fee">Taxa de serviço (%)</Label>
            <Input id="fee" type="number" min={0} max={30} value={form.serviceFee} onChange={(e) => setForm({ ...form, serviceFee: Number(e.target.value) })} />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span>Enviar pedidos automaticamente para a cozinha</span>
            <Switch checked={form.autoSendKitchen} onCheckedChange={(v) => setForm({ ...form, autoSendKitchen: v })} />
          </label>
        </div>
        <Button className="mt-4" onClick={() => { updateCompany(form); toast.success("Configurações salvas."); }}>Salvar alterações</Button>
      </section>
      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold">Usuários</h2>
        <ul className="mt-3 divide-y text-sm">
          {users.map((u) => <li key={u.id} className="flex justify-between py-2"><span className="font-medium">{u.name}</span><span className="text-muted-foreground">{ROLE_LABEL[u.role]}</span></li>)}
        </ul>
      </section>
      <section className="overflow-x-auto rounded-lg border bg-card p-5">
        <h2 className="font-semibold">Permissões por perfil</h2>
        <table className="mt-3 w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="py-2 pr-3">Módulo</th>{(Object.keys(PERMISSIONS) as Role[]).map((r) => <th key={r} className="px-2 py-2 text-center">{ROLE_LABEL[r]}</th>)}</tr></thead>
          <tbody className="divide-y">
            {NAV.map((n) => (
              <tr key={n.key}>
                <td className="py-2 pr-3">{n.label}</td>
                {(Object.keys(PERMISSIONS) as Role[]).map((r) => (
                  <td key={r} className="px-2 text-center">{PERMISSIONS[r].includes(n.key) ? <span className="text-success">●</span> : <span className="text-muted-foreground">—</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
