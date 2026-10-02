import { Check, Search, UserPlus, UserRound, UserX } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useClienteMutations, useClientes } from "@/hooks/use-clientes";
import { podeVerModulo } from "@/lib/permissoes";
import { cn } from "@/lib/utils";
import { useEmpresaAtual } from "@/providers/empresa";

export type ClienteEscolhido = { id: string; nome: string };

/** Linha que mostra o cliente atual e abre o seletor. */
export function BotaoCliente({
  nome,
  disabled,
  onClick,
}: {
  nome: string | null;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    >
      <UserRound
        className={cn("size-4.5 shrink-0", nome ? "text-primary-strong" : "text-muted-foreground")}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        {nome ? (
          <span className="block truncate font-medium text-foreground">{nome}</span>
        ) : (
          <span className="text-muted-foreground">Cliente (opcional)</span>
        )}
      </span>
      <span className="text-xs font-medium text-primary-strong">
        {nome ? "Trocar" : "Adicionar"}
      </span>
    </button>
  );
}

/**
 * Escolhe um cliente ativo (ou nenhum). Quem pode cadastrar clientes também
 * cadastra um novo aqui mesmo, só com nome e telefone.
 */
export function SeletorCliente({
  aberto,
  atualId,
  aoFechar,
  aoEscolher,
}: {
  aberto: boolean;
  atualId: string | null;
  aoFechar: () => void;
  aoEscolher: (cliente: ClienteEscolhido | null) => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escolher cliente</DialogTitle>
          <DialogDescription>
            Os pedidos entram no histórico do cliente escolhido.
          </DialogDescription>
        </DialogHeader>
        {aberto && <Conteudo atualId={atualId} aoEscolher={aoEscolher} />}
      </DialogContent>
    </Dialog>
  );
}

function Conteudo({
  atualId,
  aoEscolher,
}: {
  atualId: string | null;
  aoEscolher: (cliente: ClienteEscolhido | null) => void;
}) {
  const { papel } = useEmpresaAtual();
  // Nota: controla apenas a interface; a RLS de clientes decide quem cadastra.
  const podeCadastrar = podeVerModulo(papel, "clientes");
  const clientes = useClientes();
  const { salvar } = useClienteMutations();
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState<{ nome: string; telefone: string } | null>(null);

  const termo = busca.trim().toLowerCase();
  const lista = (clientes.data ?? []).filter(
    (c) => c.ativo && (c.nome.toLowerCase().includes(termo) || c.telefone.includes(termo)),
  );

  if (novo) {
    const valido = novo.nome.trim().length >= 2;
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valido) return;
          salvar.mutate(
            { nome: novo.nome, telefone: novo.telefone, email: "", observacoes: "" },
            { onSuccess: (id) => aoEscolher({ id, nome: novo.nome.trim() }) },
          );
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="novo-cliente-nome">Nome</Label>
          <Input
            id="novo-cliente-nome"
            autoFocus
            value={novo.nome}
            onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="novo-cliente-telefone">Telefone (opcional)</Label>
          <Input
            id="novo-cliente-telefone"
            inputMode="tel"
            value={novo.telefone}
            onChange={(e) => setNovo({ ...novo, telefone: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => setNovo(null)}>
            Voltar
          </Button>
          <Button type="submit" disabled={!valido || salvar.isPending}>
            {salvar.isPending ? "Salvando…" : "Cadastrar e usar"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="pl-9"
          autoFocus
          placeholder="Buscar por nome ou telefone..."
          aria-label="Buscar cliente"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
        {clientes.isPending ? (
          <div className="space-y-2 p-3" aria-busy="true">
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} className="h-9 w-full" />
            ))}
          </div>
        ) : clientes.isError ? (
          <p className="p-4 text-sm text-muted-foreground">
            Não foi possível carregar os clientes.
          </p>
        ) : lista.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {lista.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => aoEscolher({ id: c.id, nome: c.nome })}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
                    c.id === atualId && "bg-primary-soft",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{c.nome}</p>
                    {c.telefone && (
                      <p className="truncate text-xs text-muted-foreground">{c.telefone}</p>
                    )}
                  </div>
                  {c.id === atualId && (
                    <Check className="size-4 shrink-0 text-primary-strong" aria-label="Atual" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        {atualId ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => aoEscolher(null)}>
            <UserX className="size-4" aria-hidden="true" /> Sem cliente
          </Button>
        ) : (
          <span />
        )}
        {podeCadastrar && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setNovo({ nome: busca.trim(), telefone: "" })}
          >
            <UserPlus className="size-4" aria-hidden="true" /> Novo cliente
          </Button>
        )}
      </div>
    </div>
  );
}
