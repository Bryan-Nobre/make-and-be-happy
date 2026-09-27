import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLayout, NAV } from "@/components/layout/app-layout";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useEmpresaMutations, useFormasPagamento } from "@/hooks/use-configuracoes";
import { useConvitesPendentes, useEquipeMutations, useMembros } from "@/hooks/use-equipe";
import { useMesaMutations, useMesas } from "@/hooks/use-mesas";
import { dateShort } from "@/lib/format";
import { MODULOS_POR_PAPEL, PAPEIS, PAPEL_LABEL, type Papel } from "@/lib/permissoes";
import { useEmpresaAtual } from "@/providers/empresa";
import { METODO_LABEL, type EntradaEmpresa } from "@/services/configuracoes";
import { linkDoConvite } from "@/services/equipe";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — ARVON FOOD" },
      {
        name: "description",
        content: "Dados da empresa, regras de operação, usuários e permissões.",
      },
      { property: "og:title", content: "Configurações — ARVON FOOD" },
      {
        property: "og:description",
        content: "Dados da empresa, regras de operação, usuários e permissões.",
      },
    ],
  }),
  component: () => (
    <AppLayout module="configuracoes">
      <Configuracoes />
    </AppLayout>
  ),
});

function Configuracoes() {
  const { papel } = useEmpresaAtual();
  const gestor = papel === "owner" || papel === "admin";

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Ajuste os dados e as regras do restaurante." />

      {gestor ? (
        <>
          <SecaoEmpresa />
          <SecaoOperacao />
          <SecaoMesas />
          <SecaoEquipe />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Somente o proprietário e os administradores podem alterar as configurações.
        </p>
      )}

      <SecaoPermissoes />
    </div>
  );
}

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="font-semibold">{titulo}</h2>
      {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Empresa e operação
// ---------------------------------------------------------------------------

function useFormularioEmpresa() {
  const { empresa } = useEmpresaAtual();

  const [form, setForm] = useState<EntradaEmpresa>(() => paraFormulario(empresa));

  // A empresa muda quando o usuário troca de restaurante no menu.
  useEffect(() => {
    setForm(paraFormulario(empresa));
  }, [empresa]);

  return [form, setForm] as const;
}

function paraFormulario(empresa: {
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  endereco: string | null;
  horarioFuncionamento: string | null;
  taxaServico: number;
  envioAutomaticoCozinha: boolean;
}): EntradaEmpresa {
  return {
    nome: empresa.nome,
    cnpj: empresa.cnpj ?? "",
    telefone: empresa.telefone ?? "",
    endereco: empresa.endereco ?? "",
    horarioFuncionamento: empresa.horarioFuncionamento ?? "",
    taxaServico: empresa.taxaServico,
    envioAutomaticoCozinha: empresa.envioAutomaticoCozinha,
  };
}

function SecaoEmpresa() {
  const [form, setForm] = useFormularioEmpresa();
  const { salvar } = useEmpresaMutations();

  const campo = (
    chave: "nome" | "cnpj" | "telefone" | "endereco" | "horarioFuncionamento",
    rotulo: string,
  ) => (
    <div className="grid gap-1">
      <Label htmlFor={`empresa-${chave}`}>{rotulo}</Label>
      <Input
        id={`empresa-${chave}`}
        value={form[chave]}
        onChange={(e) => setForm({ ...form, [chave]: e.target.value })}
      />
    </div>
  );

  return (
    <Secao titulo="Empresa">
      <div className="grid gap-4 md:grid-cols-2">
        {campo("nome", "Nome fantasia")}
        {campo("cnpj", "CNPJ")}
        {campo("telefone", "Telefone")}
        {campo("horarioFuncionamento", "Horário de funcionamento")}
        <div className="md:col-span-2">{campo("endereco", "Endereço")}</div>
      </div>
      <Button
        className="mt-4"
        disabled={salvar.isPending || form.nome.trim().length < 2}
        onClick={() => salvar.mutate(form)}
      >
        Salvar dados da empresa
      </Button>
    </Secao>
  );
}

function SecaoOperacao() {
  const [form, setForm] = useFormularioEmpresa();
  const { salvar, alternarFormaPagamento } = useEmpresaMutations();
  const formas = useFormasPagamento();

  return (
    <Secao titulo="Operação" descricao="A taxa de serviço entra no fechamento da conta das mesas.">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor="taxa-servico">Taxa de serviço (%)</Label>
          <Input
            id="taxa-servico"
            type="number"
            min={0}
            max={30}
            step="0.5"
            value={form.taxaServico}
            onChange={(e) => setForm({ ...form, taxaServico: Number(e.target.value) })}
          />
        </div>
        <label className="flex items-center justify-between gap-3 self-end rounded-md border p-3 text-sm">
          <span>Enviar pedidos automaticamente para a cozinha</span>
          <Switch
            checked={form.envioAutomaticoCozinha}
            onCheckedChange={(envioAutomaticoCozinha) =>
              setForm({ ...form, envioAutomaticoCozinha })
            }
          />
        </label>
      </div>

      <Button
        className="mt-4"
        disabled={salvar.isPending || form.taxaServico < 0 || form.taxaServico > 30}
        onClick={() => salvar.mutate(form)}
      >
        Salvar regras de operação
      </Button>

      <h3 className="mt-6 text-sm font-medium">Formas de pagamento aceitas</h3>
      {formas.error ? (
        <ErrorState
          className="mt-2"
          description="Não foi possível carregar as formas de pagamento."
          onRetry={() => void formas.refetch()}
        />
      ) : formas.isPending ? (
        <LoadingState className="mt-2" label="Carregando…" />
      ) : (
        <ul className="mt-2 divide-y rounded-md border">
          {(formas.data ?? []).map((forma) => (
            <li key={forma.metodo} className="flex items-center justify-between p-3 text-sm">
              <span>{METODO_LABEL[forma.metodo]}</span>
              <Switch
                checked={forma.ativa}
                onCheckedChange={(ativa) =>
                  alternarFormaPagamento.mutate({ metodo: forma.metodo, ativa })
                }
                aria-label={`Aceitar ${METODO_LABEL[forma.metodo]}`}
              />
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Mesas
// ---------------------------------------------------------------------------

function SecaoMesas() {
  const consulta = useMesas();
  const { salvar, alternarAtiva, excluir } = useMesaMutations();
  const [nome, setNome] = useState("");
  const [lugares, setLugares] = useState(4);

  const mesas = consulta.data ?? [];

  return (
    <Secao titulo="Mesas" descricao="Mesas desativadas saem do mapa, mas continuam no histórico.">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (nome.trim().length === 0) return;
          salvar.mutate(
            { nome, lugares, ordem: mesas.length + 1 },
            { onSuccess: () => setNome("") },
          );
        }}
      >
        <div className="grid gap-1">
          <Label htmlFor="mesa-nome">Nome</Label>
          <Input
            id="mesa-nome"
            className="w-40"
            placeholder="Mesa 1"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="mesa-lugares">Lugares</Label>
          <Input
            id="mesa-lugares"
            className="w-24"
            type="number"
            min={1}
            max={50}
            value={lugares}
            onChange={(e) => setLugares(Number(e.target.value))}
          />
        </div>
        <Button type="submit" disabled={salvar.isPending}>
          <Plus className="size-4" />
          Adicionar
        </Button>
      </form>

      {consulta.error ? (
        <ErrorState
          className="mt-4"
          description="Não foi possível carregar as mesas."
          onRetry={() => void consulta.refetch()}
        />
      ) : consulta.isPending ? (
        <LoadingState className="mt-4" label="Carregando mesas…" />
      ) : mesas.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhuma mesa cadastrada. Restaurantes que só atendem no balcão podem seguir sem mesas.
        </p>
      ) : (
        <ul className="mt-4 divide-y rounded-md border">
          {mesas.map((mesa) => (
            <li key={mesa.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span className={mesa.ativa ? "font-medium" : "font-medium opacity-60"}>
                {mesa.nome}
              </span>
              <span className="flex items-center gap-3 text-muted-foreground">
                {mesa.lugares} {mesa.lugares === 1 ? "lugar" : "lugares"}
                <Switch
                  checked={mesa.ativa}
                  onCheckedChange={(ativa) => alternarAtiva.mutate({ id: mesa.id, ativa })}
                  aria-label={`Mesa ${mesa.nome} ativa`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => excluir.mutate(mesa.id)}
                  aria-label={`Excluir ${mesa.nome}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Equipe
// ---------------------------------------------------------------------------

function SecaoEquipe() {
  const { papel } = useEmpresaAtual();
  const membros = useMembros();
  const convites = useConvitesPendentes();
  const { convidar, cancelarConvite, alterarPapel, alternarAtivo } = useEquipeMutations();

  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [papelConvite, setPapelConvite] = useState<Papel>("waiter");

  // Só o proprietário promove alguém a proprietário ou administrador.
  const papeisDisponiveis = papel === "owner" ? PAPEIS : PAPEIS.filter((p) => p !== "owner");

  return (
    <Secao
      titulo="Equipe"
      descricao="Convide a equipe por e-mail. O acesso vale apenas para este restaurante."
    >
      <form
        className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          convidar.mutate(
            { email, nomeExibicao: nome, papel: papelConvite },
            {
              onSuccess: async (token) => {
                setEmail("");
                setNome("");
                await navigator.clipboard
                  .writeText(linkDoConvite(token))
                  .then(() => toast.success("Convite criado. Link copiado."))
                  .catch(() => toast.success("Convite criado."));
              },
            },
          );
        }}
      >
        <div className="grid gap-1">
          <Label htmlFor="convite-nome">Nome</Label>
          <Input
            id="convite-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="convite-email">E-mail</Label>
          <Input
            id="convite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="convite-papel">Perfil</Label>
          <select
            id="convite-papel"
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={papelConvite}
            onChange={(e) => setPapelConvite(e.target.value as Papel)}
          >
            {papeisDisponiveis.map((p) => (
              <option key={p} value={p}>
                {PAPEL_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={convidar.isPending}>
          Convidar
        </Button>
      </form>

      {(convites.data ?? []).length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-medium">Convites pendentes</h3>
          <ul className="mt-2 divide-y rounded-md border">
            {(convites.data ?? []).map((convite) => (
              <li
                key={convite.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-medium">{convite.nomeExibicao}</span>
                  <span className="block text-muted-foreground">{convite.email}</span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge tone="info">{PAPEL_LABEL[convite.papel]}</StatusBadge>
                  <span className="text-xs text-muted-foreground">
                    expira {dateShort(convite.expiraEm)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => cancelarConvite.mutate(convite.id)}
                  >
                    Cancelar
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="mt-6 text-sm font-medium">Membros</h3>
      {membros.error ? (
        <ErrorState
          className="mt-2"
          description="Não foi possível carregar a equipe."
          onRetry={() => void membros.refetch()}
        />
      ) : membros.isPending ? (
        <LoadingState className="mt-2" label="Carregando equipe…" />
      ) : (
        <ul className="mt-2 divide-y rounded-md border">
          {(membros.data ?? []).map((membro) => {
            // Ninguém rebaixa nem suspende a própria conta: evita ficar sem acesso.
            const bloqueado = membro.souEu || (papel === "admin" && membro.papel === "owner");

            return (
              <li
                key={membro.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-medium">
                    {membro.nomeExibicao}
                    {membro.souEu && (
                      <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                    )}
                  </span>
                  <span className="block text-muted-foreground">{membro.email}</span>
                </span>
                <span className="flex items-center gap-3">
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    value={membro.papel}
                    disabled={bloqueado}
                    onChange={(e) =>
                      alterarPapel.mutate({
                        membroId: membro.id,
                        papel: e.target.value as Papel,
                      })
                    }
                    aria-label={`Perfil de ${membro.nomeExibicao}`}
                  >
                    {papeisDisponiveis.map((p) => (
                      <option key={p} value={p}>
                        {PAPEL_LABEL[p]}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Ativo
                    <Switch
                      checked={membro.ativo}
                      disabled={bloqueado}
                      onCheckedChange={(ativo) =>
                        alternarAtivo.mutate({ membroId: membro.id, ativo })
                      }
                      aria-label={`${membro.nomeExibicao} com acesso ativo`}
                    />
                  </label>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Secao>
  );
}

// ---------------------------------------------------------------------------
// Permissões
// ---------------------------------------------------------------------------

function SecaoPermissoes() {
  const { papel } = useEmpresaAtual();

  return (
    <Secao
      titulo="Permissões por perfil"
      descricao="Os perfis são fixos. Seu perfil atual está destacado."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2 pr-3">Módulo</th>
              {PAPEIS.map((p) => (
                <th
                  key={p}
                  className={
                    p === papel ? "px-2 py-2 text-center text-foreground" : "px-2 py-2 text-center"
                  }
                >
                  {PAPEL_LABEL[p]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {NAV.map((item) => (
              <tr key={item.key}>
                <td className="py-2 pr-3">{item.label}</td>
                {PAPEIS.map((p) => (
                  <td key={p} className="px-2 text-center">
                    {MODULOS_POR_PAPEL[p].includes(item.key) ? (
                      <span className="text-success" aria-label="Com acesso">
                        ●
                      </span>
                    ) : (
                      <span className="text-muted-foreground" aria-label="Sem acesso">
                        —
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Secao>
  );
}
