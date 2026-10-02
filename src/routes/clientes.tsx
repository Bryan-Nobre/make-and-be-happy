import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Search, Users } from "lucide-react";
import { useState } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useClienteMutations, useClientes, useHistoricoCliente } from "@/hooks/use-clientes";
import { brl, dateShort, dateTime } from "@/lib/format";
import { STATUS_PEDIDO } from "@/lib/labels";
import { cn } from "@/lib/utils";
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

const iniciais = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

function Clientes() {
  const consulta = useClientes();
  const { salvar, alternarAtivo } = useClienteMutations();
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<Formulario | null>(null);
  const [vendo, setVendo] = useState<Cliente | null>(null);

  const clientes = consulta.data ?? [];
  const termo = busca.trim().toLowerCase();
  const lista = clientes.filter(
    (c) => c.nome.toLowerCase().includes(termo) || c.telefone.includes(termo),
  );

  const editar = (cliente: Cliente) =>
    setForm({
      id: cliente.id,
      nome: cliente.nome,
      telefone: cliente.telefone,
      email: cliente.email,
      observacoes: cliente.observacoes,
    });

  const ativo = (cliente: Cliente) => (
    <Switch
      checked={cliente.ativo}
      onCheckedChange={(valor) => alternarAtivo.mutate({ id: cliente.id, ativo: valor })}
      aria-label={`Cliente ${cliente.nome} ativo`}
    />
  );

  const botaoEditar = (cliente: Cliente) => (
    <Button
      size="icon"
      variant="ghost"
      className="size-8 text-muted-foreground hover:text-foreground"
      onClick={() => editar(cliente)}
      aria-label={`Editar ${cliente.nome}`}
    >
      <Pencil className="size-4" />
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description={
          consulta.isSuccess
            ? `${clientes.length} ${clientes.length === 1 ? "cliente cadastrado" : "clientes cadastrados"}`
            : "Cadastro dos clientes do restaurante."
        }
        actions={
          <Button onClick={() => setForm(VAZIO)}>
            <Plus className="size-4" aria-hidden="true" />
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
        <ClientesSkeleton />
      ) : clientes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente cadastrado"
          description="Cadastre clientes para guardar telefone e observações."
          action={
            <Button onClick={() => setForm(VAZIO)}>
              <Plus className="size-4" aria-hidden="true" /> Novo cliente
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="relative sm:max-w-sm">
            <Search
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              placeholder="Buscar por nome ou telefone..."
              aria-label="Buscar cliente"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {lista.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum cliente encontrado"
              description="Ajuste a busca ou cadastre um novo cliente."
              className="py-10"
            />
          ) : (
            <>
              <ul className="space-y-2 md:hidden">
                {lista.map((c) => (
                  <li
                    key={c.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-xs",
                      !c.ativo && "opacity-60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setVendo(c)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <Avatar nome={c.nome} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{c.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.telefone || "Sem telefone"}
                        </p>
                        {c.observacoes && (
                          <p className="truncate text-xs text-muted-foreground">{c.observacoes}</p>
                        )}
                      </div>
                    </button>
                    {ativo(c)}
                    {botaoEditar(c)}
                  </li>
                ))}
              </ul>

              <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-xs md:block">
                <table className="w-full table-fixed text-sm">
                  <thead className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Cliente</th>
                      <th className="w-40 px-4 py-3 font-medium">Telefone</th>
                      <th className="hidden px-4 py-3 font-medium lg:table-cell">Observações</th>
                      <th className="w-20 px-4 py-3 font-medium">Ativo</th>
                      <th className="w-14 px-4 py-3">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lista.map((c) => (
                      <tr
                        key={c.id}
                        className={cn(
                          "transition-colors hover:bg-muted/30",
                          !c.ativo && "opacity-60",
                        )}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setVendo(c)}
                            className="group flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                          >
                            <Avatar nome={c.nome} />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground group-hover:text-primary-strong">
                                {c.nome}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {c.email || "Ver histórico"}
                              </p>
                            </div>
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
                          {c.telefone || "—"}
                        </td>
                        <td className="hidden px-4 py-3 lg:table-cell">
                          <p className="truncate text-muted-foreground">{c.observacoes || "—"}</p>
                        </td>
                        <td className="px-4 py-3">{ativo(c)}</td>
                        <td className="px-4 py-3 text-right">{botaoEditar(c)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <DialogoHistorico cliente={vendo} aoFechar={() => setVendo(null)} />

      <Dialog open={form !== null} onOpenChange={(aberto) => !aberto && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>

          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cliente-nome">Nome</Label>
                <Input
                  id="cliente-nome"
                  value={form.nome}
                  autoFocus
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cliente-telefone">Telefone</Label>
                <Input
                  id="cliente-telefone"
                  inputMode="tel"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cliente-email">E-mail (opcional)</Label>
                <Input
                  id="cliente-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cliente-observacoes">Observações</Label>
                <Textarea
                  id="cliente-observacoes"
                  placeholder="Ex.: alérgico a camarão, prefere mesa externa"
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
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DialogoHistorico({
  cliente,
  aoFechar,
}: {
  cliente: Cliente | null;
  aoFechar: () => void;
}) {
  const historico = useHistoricoCliente(cliente?.id ?? null);

  return (
    <Dialog open={!!cliente} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cliente?.nome}</DialogTitle>
          <DialogDescription>
            {[cliente?.telefone, cliente?.email].filter(Boolean).join(" · ") || "Sem contato"}
          </DialogDescription>
        </DialogHeader>

        {cliente?.observacoes && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-foreground">
            {cliente.observacoes}
          </p>
        )}

        {historico.isPending ? (
          <div className="space-y-3" aria-busy="true">
            <span className="sr-only">Carregando histórico…</span>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((n) => (
                <Skeleton key={n} className="h-16 rounded-lg" />
              ))}
            </div>
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} className="h-10 w-full" />
            ))}
          </div>
        ) : historico.isError ? (
          <ErrorState
            className="border-0 bg-transparent px-0 py-4 shadow-none"
            description="Não foi possível carregar o histórico."
            onRetry={() => void historico.refetch()}
          />
        ) : (
          <div className="min-w-0 space-y-4">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { rotulo: "Pedidos", valor: String(historico.data.pedidos) },
                { rotulo: "Total gasto", valor: brl(historico.data.totalGasto) },
                {
                  rotulo: "Último pedido",
                  valor: historico.data.ultimoPedido ? dateShort(historico.data.ultimoPedido) : "—",
                },
              ].map((d) => (
                <div
                  key={d.rotulo}
                  className="min-w-0 rounded-lg border border-border px-2.5 py-2 last:col-span-2 sm:last:col-span-1"
                >
                  <dt className="truncate text-xs text-muted-foreground">{d.rotulo}</dt>
                  <dd className="truncate text-sm font-bold tabular-nums sm:text-base">
                    {d.valor}
                  </dd>
                </div>
              ))}
            </dl>

            {historico.data.recentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum pedido ainda. Vincule o cliente no PDV ou na comanda da mesa.
              </p>
            ) : (
              <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {historico.data.recentes.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold tabular-nums">#{p.numero}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.nomeMesa ?? "Balcão"} · {dateTime(p.criadoEm)}
                      </p>
                    </div>
                    <StatusBadge tone={STATUS_PEDIDO[p.status].tone} className="shrink-0">
                      {STATUS_PEDIDO[p.status].label}
                    </StatusBadge>
                    <span
                      className={cn(
                        "shrink-0 text-right font-semibold tabular-nums sm:w-20",
                        p.status === "CANCELLED" && "text-muted-foreground line-through",
                      )}
                    >
                      {brl(p.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Avatar({ nome }: { nome: string }) {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-strong"
      aria-hidden="true"
    >
      {iniciais(nome)}
    </span>
  );
}

function ClientesSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Carregando clientes…</span>
      <Skeleton className="h-10 w-full rounded-lg sm:max-w-sm" />
      <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-xs">
        {[0, 1, 2, 3, 4].map((n) => (
          <div key={n} className="flex items-center gap-3 px-4 py-3.5">
            <Skeleton className="size-9 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-9 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
