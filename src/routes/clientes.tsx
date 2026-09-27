import { createFileRoute } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
import { useState } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useClienteMutations, useClientes } from "@/hooks/use-clientes";
import type { Cliente } from "@/services/clientes";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — ARVON FOOD" },
      { name: "description", content: "Cadastro e histórico de consumo dos clientes." },
      { property: "og:title", content: "Clientes — ARVON FOOD" },
      {
        property: "og:description",
        content: "Cadastro e histórico de consumo dos clientes.",
      },
    ],
  }),
  component: () => (
    <AppLayout module="clientes">
      <Clientes />
    </AppLayout>
  ),
});

type Formulario = {
  id?: string;
  nome: string;
  telefone: string;
  email: string;
  observacoes: string;
};

const VAZIO: Formulario = { nome: "", telefone: "", email: "", observacoes: "" };

function Clientes() {
  const consulta = useClientes();
  const { salvar, alternarAtivo } = useClienteMutations();
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<Formulario | null>(null);

  const clientes = consulta.data ?? [];
  const termo = busca.trim().toLowerCase();
  const lista = clientes.filter(
    (c) => c.nome.toLowerCase().includes(termo) || c.telefone.includes(termo),
  );

  const editar = (cliente: Cliente): Formulario => ({
    id: cliente.id,
    nome: cliente.nome,
    telefone: cliente.telefone,
    email: cliente.email,
    observacoes: cliente.observacoes,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description={
          consulta.isSuccess
            ? `${clientes.length} ${clientes.length === 1 ? "cliente cadastrado" : "clientes cadastrados"}`
            : undefined
        }
        actions={
          <Button onClick={() => setForm(VAZIO)}>
            <Plus className="size-4" />
            Novo cliente
          </Button>
        }
      />

      {consulta.error ? (
        <ErrorState
          description="Não foi possível carregar os clientes."
          onRetry={() => void consulta.refetch()}
        />
      ) : consulta.isPending ? (
        <LoadingState label="Carregando clientes…" />
      ) : (
        <>
          <Input
            className="h-11 max-w-sm"
            placeholder="Buscar por nome ou telefone"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          {lista.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum cliente"
              description="Ajuste a busca ou cadastre um novo cliente."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map((cliente) => (
                <div key={cliente.id} className="flex flex-col gap-2 rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{cliente.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {cliente.telefone || "Sem telefone"}
                      </p>
                      {cliente.email && (
                        <p className="truncate text-sm text-muted-foreground">{cliente.email}</p>
                      )}
                    </div>
                    {!cliente.ativo && <StatusBadge tone="neutral">Inativo</StatusBadge>}
                  </div>

                  {cliente.observacoes && (
                    <p className="text-sm text-muted-foreground">{cliente.observacoes}</p>
                  )}

                  <div className="mt-auto flex items-center justify-between pt-2">
                    <Button size="sm" variant="outline" onClick={() => setForm(editar(cliente))}>
                      Editar
                    </Button>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      Ativo
                      <Switch
                        checked={cliente.ativo}
                        onCheckedChange={(ativo) => alternarAtivo.mutate({ id: cliente.id, ativo })}
                        aria-label={`Cliente ${cliente.nome} ativo`}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={form !== null} onOpenChange={(aberto) => !aberto && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>

          {form && (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label htmlFor="cliente-nome">Nome</Label>
                <Input
                  id="cliente-nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="cliente-telefone">Telefone</Label>
                <Input
                  id="cliente-telefone"
                  inputMode="tel"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="cliente-email">E-mail</Label>
                <Input
                  id="cliente-email"
                  type="email"
                  placeholder="Opcional"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="cliente-observacoes">Observações</Label>
                <Textarea
                  id="cliente-observacoes"
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button
              disabled={salvar.isPending || !form || form.nome.trim().length < 2}
              onClick={() => {
                if (!form) return;
                salvar.mutate(form, { onSuccess: () => setForm(null) });
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
