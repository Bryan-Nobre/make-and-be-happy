import { createFileRoute } from "@tanstack/react-router";
import { Check, Minus, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AppLayout, NAV } from "@/components/layout/app-layout";
import { ErrorState } from "@/components/shared/error-state";
import { LogoEmpresa } from "@/components/shared/logo-empresa";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmpresaMutations, useFormasPagamento } from "@/hooks/use-configuracoes";
import { useConvitesPendentes, useEquipeMutations, useMembros } from "@/hooks/use-equipe";
import { useMesaMutations, useMesas } from "@/hooks/use-mesas";
import { dateShort } from "@/lib/format";
import { MODULOS_POR_PAPEL, PAPEIS, PAPEL_LABEL, type Papel } from "@/lib/permissoes";
import { cn } from "@/lib/utils";
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

const GATILHO_ABA =
  "h-8 px-4 data-[state=active]:bg-primary-soft data-[state=active]:text-primary-strong data-[state=active]:shadow-none";

function Configuracoes() {
  const { papel } = useEmpresaAtual();
  // Nota: controla apenas a interface; a RLS e as RPCs bloqueiam a escrita de quem não é gestor.
  const gestor = papel === "owner" || papel === "admin";

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Dados e regras do restaurante." />

      <Tabs defaultValue={gestor ? "empresa" : "permissoes"}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="h-10 border border-border bg-card">
            {gestor && (
              <>
                <TabsTrigger value="empresa" className={GATILHO_ABA}>
                  Empresa
                </TabsTrigger>
                <TabsTrigger value="operacao" className={GATILHO_ABA}>
                  Operação
                </TabsTrigger>
                <TabsTrigger value="mesas" className={GATILHO_ABA}>
                  Mesas
                </TabsTrigger>
                <TabsTrigger value="equipe" className={GATILHO_ABA}>
                  Equipe
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="permissoes" className={GATILHO_ABA}>
              Permissões
            </TabsTrigger>
          </TabsList>
        </div>

        {gestor && (
          <>
            <TabsContent value="empresa" className="mt-4">
              <SecaoEmpresa />
            </TabsContent>
            <TabsContent value="operacao" className="mt-4">
              <SecaoOperacao />
            </TabsContent>
            <TabsContent value="mesas" className="mt-4">
              <SecaoMesas />
            </TabsContent>
            <TabsContent value="equipe" className="mt-4">
              <SecaoEquipe />
            </TabsContent>
          </>
        )}
        <TabsContent value="permissoes" className="mt-4 space-y-4">
          {!gestor && (
            <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-xs">
              Somente o proprietário e os administradores podem alterar as configurações.
            </p>
          )}
          <SecaoPermissoes />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blocos comuns
// ---------------------------------------------------------------------------

function Secao({
  titulo,
  descricao,
  rodape,
  children,
}: {
  titulo: string;
  descricao?: string;
  rodape?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={titulo}
      className="max-w-4xl rounded-xl border border-border bg-card shadow-xs"
    >
      <div className="px-5 pt-5">
        <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>}
      </div>
      <div className="p-5">{children}</div>
      {rodape && <div className="flex justify-end border-t border-border px-5 py-3">{rodape}</div>}
    </section>
  );
}

function Subtitulo({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-sm font-semibold text-foreground">{children}</h3>;
}

const LISTA = "divide-y divide-border rounded-lg border border-border";

function LinhasCarregando() {
  return (
    <div className={LISTA} aria-busy="true">
      {[0, 1, 2].map((n) => (
        <div key={n} className="flex items-center justify-between gap-3 px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
      ))}
    </div>
  );
}

const iniciais = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

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
    placeholder?: string,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`empresa-${chave}`}>{rotulo}</Label>
      <Input
        id={`empresa-${chave}`}
        value={form[chave]}
        placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [chave]: e.target.value })}
      />
    </div>
  );

  return (
    <Secao
      titulo="Empresa"
      descricao="Dados exibidos no sistema e nos comprovantes."
      rodape={
        <Button
          disabled={salvar.isPending || form.nome.trim().length < 2}
          onClick={() => salvar.mutate(form)}
        >
          {salvar.isPending ? "Salvando…" : "Salvar"}
        </Button>
      }
    >
      <BlocoLogo />
      <div className="grid gap-4 md:grid-cols-2">
        {campo("nome", "Nome fantasia")}
        {campo("cnpj", "CNPJ", "00.000.000/0000-00")}
        {campo("telefone", "Telefone", "(00) 00000-0000")}
        {campo("horarioFuncionamento", "Horário de funcionamento", "Ex.: 11h às 23h")}
        <div className="md:col-span-2">{campo("endereco", "Endereço")}</div>
      </div>
    </Secao>
  );
}

function BlocoLogo() {
  const { empresa } = useEmpresaAtual();
  const { enviarLogo, removerLogo } = useEmpresaMutations();
  const seletor = useRef<HTMLInputElement>(null);
  const ocupado = enviarLogo.isPending || removerLogo.isPending;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-4 border-b border-border pb-5">
      <div className="flex min-w-0 flex-1 basis-60 items-center gap-4">
        <LogoEmpresa nome={empresa.nome} logoUrl={empresa.logoUrl} className="size-16 text-lg" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Logo</p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG ou WebP. Fundo transparente fica melhor.
          </p>
        </div>
      </div>
      <div className="flex gap-2 max-sm:w-full max-sm:justify-end">
        {empresa.logoUrl && (
          <Button variant="ghost" disabled={ocupado} onClick={() => removerLogo.mutate()}>
            Remover
          </Button>
        )}
        <Button variant="outline" disabled={ocupado} onClick={() => seletor.current?.click()}>
          <Upload className="size-4" aria-hidden="true" />
          {enviarLogo.isPending ? "Enviando…" : empresa.logoUrl ? "Trocar" : "Enviar logo"}
        </Button>
      </div>
      <input
        ref={seletor}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Arquivo do logo"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = "";
          if (arquivo) enviarLogo.mutate(arquivo);
        }}
      />
    </div>
  );
}

function SecaoOperacao() {
  const [form, setForm] = useFormularioEmpresa();
  const { salvar, alternarFormaPagamento } = useEmpresaMutations();
  const formas = useFormasPagamento();

  return (
    <div className="space-y-4">
      <Secao
        titulo="Regras de operação"
        rodape={
          <Button
            disabled={salvar.isPending || form.taxaServico < 0 || form.taxaServico > 30}
            onClick={() => salvar.mutate(form)}
          >
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        }
      >
        <div className="divide-y divide-border">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <div className="min-w-0">
              <Label htmlFor="taxa-servico">Taxa de serviço</Label>
              <p className="text-xs text-muted-foreground">
                Entra no fechamento da conta das mesas.
              </p>
            </div>
            <div className="relative w-28">
              <Input
                id="taxa-servico"
                type="number"
                min={0}
                max={30}
                step="0.5"
                className="pr-8 text-right tabular-nums"
                value={form.taxaServico}
                onChange={(e) => setForm({ ...form, taxaServico: Number(e.target.value) })}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-3 pt-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Envio automático para a cozinha</p>
              <p className="text-xs text-muted-foreground">
                Pedidos vão direto para o KDS ao serem lançados.
              </p>
            </div>
            <Switch
              checked={form.envioAutomaticoCozinha}
              onCheckedChange={(envioAutomaticoCozinha) =>
                setForm({ ...form, envioAutomaticoCozinha })
              }
            />
          </label>
        </div>
      </Secao>

      <Secao titulo="Formas de pagamento" descricao="Desative as que o restaurante não aceita.">
        {formas.error ? (
          <ErrorState
            description="Não foi possível carregar as formas de pagamento."
            onRetry={() => void formas.refetch()}
          />
        ) : formas.isPending ? (
          <LinhasCarregando />
        ) : (
          <ul className={LISTA}>
            {(formas.data ?? []).map((forma) => (
              <li
                key={forma.metodo}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className={cn("font-medium", !forma.ativa && "text-muted-foreground")}>
                  {METODO_LABEL[forma.metodo]}
                </span>
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
    </div>
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
        <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-56 sm:flex-none">
          <Label htmlFor="mesa-nome">Nome</Label>
          <Input
            id="mesa-nome"
            placeholder="Mesa 1"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
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
        <Button type="submit" disabled={salvar.isPending || nome.trim().length === 0}>
          <Plus className="size-4" aria-hidden="true" />
          Adicionar
        </Button>
      </form>

      <div className="mt-4">
        {consulta.error ? (
          <ErrorState
            description="Não foi possível carregar as mesas."
            onRetry={() => void consulta.refetch()}
          />
        ) : consulta.isPending ? (
          <LinhasCarregando />
        ) : mesas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma mesa cadastrada. Restaurantes que só atendem no balcão podem seguir sem mesas.
          </p>
        ) : (
          <ul className={LISTA}>
            {mesas.map((mesa) => (
              <li key={mesa.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className={cn("min-w-0 flex-1", !mesa.ativa && "opacity-60")}>
                  <p className="truncate font-medium">{mesa.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {mesa.lugares} {mesa.lugares === 1 ? "lugar" : "lugares"}
                  </p>
                </div>
                <Switch
                  checked={mesa.ativa}
                  onCheckedChange={(ativa) => alternarAtiva.mutate({ id: mesa.id, ativa })}
                  aria-label={`Mesa ${mesa.nome} ativa`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => excluir.mutate(mesa.id)}
                  aria-label={`Excluir ${mesa.nome}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
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
    <div className="space-y-4">
      <Secao
        titulo="Convidar pessoa"
        descricao="O link do convite é copiado ao enviar. O acesso vale só para este restaurante."
      >
        <form
          className="grid gap-3 md:grid-cols-[1fr_1fr_10rem_auto] md:items-end"
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
          <div className="space-y-1.5">
            <Label htmlFor="convite-nome">Nome</Label>
            <Input
              id="convite-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="convite-email">E-mail</Label>
            <Input
              id="convite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="convite-papel">Perfil</Label>
            <NativeSelect
              id="convite-papel"
              value={papelConvite}
              onChange={(e) => setPapelConvite(e.target.value as Papel)}
            >
              {papeisDisponiveis.map((p) => (
                <option key={p} value={p}>
                  {PAPEL_LABEL[p]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" disabled={convidar.isPending}>
            {convidar.isPending ? "Enviando…" : "Convidar"}
          </Button>
        </form>

        {(convites.data ?? []).length > 0 && (
          <div className="mt-5">
            <Subtitulo>Convites pendentes</Subtitulo>
            <ul className={LISTA}>
              {(convites.data ?? []).map((convite) => (
                <li
                  key={convite.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{convite.nomeExibicao}</p>
                    <p className="truncate text-xs text-muted-foreground">{convite.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
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
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Secao>

      <Secao titulo="Membros">
        {membros.error ? (
          <ErrorState
            description="Não foi possível carregar a equipe."
            onRetry={() => void membros.refetch()}
          />
        ) : membros.isPending ? (
          <LinhasCarregando />
        ) : (
          <ul className={LISTA}>
            {(membros.data ?? []).map((membro) => {
              // Ninguém rebaixa nem suspende a própria conta: evita ficar sem acesso.
              const bloqueado = membro.souEu || (papel === "admin" && membro.papel === "owner");

              return (
                <li key={membro.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <Avatar nome={membro.nomeExibicao} />
                  <div className={cn("min-w-0 flex-1", !membro.ativo && "opacity-60")}>
                    <p className="truncate font-medium">
                      {membro.nomeExibicao}
                      {membro.souEu && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (você)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{membro.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <NativeSelect
                      className="h-9 w-36"
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
                    </NativeSelect>
                    <Switch
                      checked={membro.ativo}
                      disabled={bloqueado}
                      onCheckedChange={(ativo) =>
                        alternarAtivo.mutate({ membroId: membro.id, ativo })
                      }
                      aria-label={`${membro.nomeExibicao} com acesso ativo`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Secao>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Permissões
// ---------------------------------------------------------------------------

function SecaoPermissoes() {
  const { papel } = useEmpresaAtual();

  return (
    <Secao titulo="Permissões por perfil" descricao="Os perfis são fixos. O seu está destacado.">
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-y border-border bg-muted/40 text-xs font-medium text-muted-foreground">
              <th className="px-5 py-3 text-left font-medium">Módulo</th>
              {PAPEIS.map((p) => (
                <th
                  key={p}
                  className={cn(
                    "px-2 py-3 text-center font-medium",
                    p === papel && "bg-primary-soft text-primary-strong",
                  )}
                >
                  {PAPEL_LABEL[p]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {NAV.map((item) => (
              <tr key={item.key}>
                <td className="px-5 py-2.5 font-medium">{item.label}</td>
                {PAPEIS.map((p) => (
                  <td
                    key={p}
                    className={cn("px-2 py-2.5 text-center", p === papel && "bg-primary-soft/40")}
                  >
                    {MODULOS_POR_PAPEL[p].includes(item.key) ? (
                      <Check
                        className="mx-auto size-4 text-success"
                        aria-label="Com acesso"
                        role="img"
                      />
                    ) : (
                      <Minus
                        className="mx-auto size-4 text-muted-foreground/50"
                        aria-label="Sem acesso"
                        role="img"
                      />
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
