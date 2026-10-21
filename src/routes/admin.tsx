import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Copy,
  Headset,
  PauseCircle,
  PlayCircle,
  Plus,
  Shield,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { RotaAdminPlataforma } from "@/components/layout/rota-admin-plataforma";
import { useConfirmacao } from "@/components/shared/confirmacao";
import { ErrorState } from "@/components/shared/error-state";
import { LogoMarca } from "@/components/shared/logo-marca";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAdminPlataformaMutations,
  useEmpresasPlataforma,
  useMetricasPlataforma,
  useSouAdminPlataforma,
  useSuportesAbertos,
} from "@/hooks/use-admin-plataforma";
import { brl, dateShort } from "@/lib/format";
import { mensagemDeErro } from "@/lib/erros";
import { cn } from "@/lib/utils";
import type { EmpresaPlataforma } from "@/services/admin-plataforma";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin da plataforma — Arvon Food" },
      {
        name: "description",
        content: "Criar empresas, métricas leves e acesso de suporte.",
      },
    ],
  }),
  component: () => (
    <RotaAdminPlataforma>
      <AdminPlataforma />
    </RotaAdminPlataforma>
  ),
});

function AdminPlataforma() {
  const admin = useSouAdminPlataforma();
  const ehAdmin = admin.data === true;
  const metricas = useMetricasPlataforma(ehAdmin);
  const empresas = useEmpresasPlataforma(ehAdmin);
  const suportes = useSuportesAbertos(ehAdmin);
  const { reclamar, definirAtiva, iniciarSuporte, encerrarSuporte, criarEmpresa } =
    useAdminPlataformaMutations();
  const { confirmar, dialogo } = useConfirmacao();
  const navigate = useNavigate();

  const suporteAberto = new Set(suportes.data ?? []);

  const pausarOuReativar = (empresa: EmpresaPlataforma) => {
    if (empresa.ativa) {
      confirmar({
        titulo: `Pausar ${empresa.nome}?`,
        descricao:
          "Membros comuns deixam de ver esta empresa até ela ser reativada. O histórico permanece intacto.",
        acao: "Pausar empresa",
        aoConfirmar: () => definirAtiva.mutate({ empresaId: empresa.id, ativa: false }),
      });
      return;
    }

    definirAtiva.mutate({ empresaId: empresa.id, ativa: true });
  };

  const entrarSuporte = (empresaId: string) => {
    iniciarSuporte.mutate(empresaId, {
      onSuccess: () => {
        void navigate({ to: "/", replace: true });
      },
    });
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-card px-4 sm:h-16 sm:px-6">
        <LogoMarca className="gap-3" tamanho="md" />
        <Button asChild variant="outline" size="sm">
          <Link to="/">Voltar ao app</Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6">
        {dialogo}
        <PageHeader
          title="Admin da plataforma"
          description="Crie o restaurante e o login do dono, acompanhe métricas e entre em suporte."
        />

        {!ehAdmin ? (
          <section className="rounded-xl border border-dashed border-border bg-card px-5 py-8 text-center">
            <Shield className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-semibold text-foreground">Acesso restrito</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Se ainda não existe administrador cadastrado, você pode reclamar o acesso uma única
              vez. Depois disso, só quem já for admin consegue entrar aqui.
            </p>
            <Button
              className="mt-5"
              disabled={reclamar.isPending}
              onClick={() => reclamar.mutate()}
            >
              {reclamar.isPending ? "Reivindicando…" : "Tornar-me admin da plataforma"}
            </Button>
          </section>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {metricas.isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))
              ) : metricas.isError ? (
                <ErrorState
                  className="sm:col-span-2 lg:col-span-3"
                  title="Não foi possível carregar as métricas"
                  description={mensagemDeErro(metricas.error)}
                  onRetry={() => void metricas.refetch()}
                />
              ) : (
                <>
                  <Kpi
                    icone={Building2}
                    rotulo="Empresas"
                    valor={String(metricas.data?.empresas ?? 0)}
                    detalhe={`${metricas.data?.empresasAtivas ?? 0} ativas · ${metricas.data?.empresasPausadas ?? 0} pausadas`}
                  />
                  <Kpi
                    icone={Headset}
                    rotulo="Membros ativos"
                    valor={String(metricas.data?.membrosAtivos ?? 0)}
                  />
                  <Kpi
                    icone={Wallet}
                    rotulo="Vendas hoje"
                    valor={brl(metricas.data?.vendasHoje ?? 0)}
                    detalhe={`${metricas.data?.caixasAbertos ?? 0} caixas abertos`}
                  />
                </>
              )}
            </section>

            <FormNovaEmpresa
              pending={criarEmpresa.isPending}
              onCriar={(entrada, aoSucesso) =>
                criarEmpresa.mutate(entrada, {
                  onSuccess: (criada) => {
                    aoSucesso({ email: criada.email, senha: entrada.senha, nome: entrada.nome });
                    void navigator.clipboard
                      ?.writeText(`E-mail: ${criada.email}\nSenha: ${entrada.senha}`)
                      .then(() => toast.success("E-mail e senha copiados."))
                      .catch(() => undefined);
                  },
                })
              }
            />

            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Empresas
              </h2>

              {empresas.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                  ))}
                </div>
              ) : empresas.isError ? (
                <ErrorState
                  title="Não foi possível listar as empresas"
                  description={mensagemDeErro(empresas.error)}
                  onRetry={() => void empresas.refetch()}
                />
              ) : (empresas.data?.length ?? 0) === 0 ? (
                <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma empresa cadastrada ainda.
                </p>
              ) : (
                <ul className="space-y-2">
                  {empresas.data!.map((empresa) => {
                    const emSuporte = suporteAberto.has(empresa.id);
                    return (
                      <li
                        key={empresa.id}
                        className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium text-foreground">{empresa.nome}</p>
                            <StatusBadge tone={empresa.ativa ? "success" : "neutral"}>
                              {empresa.ativa ? "Ativa" : "Pausada"}
                            </StatusBadge>
                            {emSuporte && (
                              <StatusBadge tone="warning">Suporte aberto</StatusBadge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Desde {dateShort(empresa.criadoEm)} · {empresa.membros} membros ·{" "}
                            {empresa.caixasAbertos} caixas abertos · {brl(empresa.vendasHoje)} hoje
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={definirAtiva.isPending}
                            onClick={() => pausarOuReativar(empresa)}
                          >
                            {empresa.ativa ? (
                              <>
                                <PauseCircle className="size-4" aria-hidden="true" />
                                Pausar
                              </>
                            ) : (
                              <>
                                <PlayCircle className="size-4" aria-hidden="true" />
                                Reativar
                              </>
                            )}
                          </Button>

                          {emSuporte ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={encerrarSuporte.isPending}
                              onClick={() => encerrarSuporte.mutate(empresa.id)}
                            >
                              Encerrar suporte
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              disabled={iniciarSuporte.isPending}
                              onClick={() => entrarSuporte(empresa.id)}
                            >
                              <Headset className="size-4" aria-hidden="true" />
                              Entrar como suporte
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function FormNovaEmpresa({
  pending,
  onCriar,
}: {
  pending: boolean;
  onCriar: (
    entrada: {
      nome: string;
      nomeResponsavel: string;
      email: string;
      senha: string;
      telefone?: string;
    },
    aoSucesso: (credenciais: { email: string; senha: string; nome: string }) => void,
  ) => void;
}) {
  const [nome, setNome] = useState("");
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [ultimo, setUltimo] = useState<{ email: string; senha: string; nome: string } | null>(
    null,
  );

  const gerarSenha = () => {
    const gerada = `Arvon${Math.random().toString(36).slice(2, 8)}!`;
    setSenha(gerada);
  };

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Nova empresa
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cria o restaurante e a conta do dono. Depois envie e-mail e senha para a pessoa.
        </p>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const entrada = {
            nome: nome.trim(),
            nomeResponsavel: nomeResponsavel.trim(),
            email: email.trim(),
            senha,
            telefone: telefone.trim() || undefined,
          };
          onCriar(entrada, (credenciais) => {
            setUltimo(credenciais);
            setNome("");
            setNomeResponsavel("");
            setEmail("");
            setSenha("");
            setTelefone("");
          });
        }}
      >
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="admin-nome">Nome do restaurante</Label>
          <Input
            id="admin-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Cantina do Centro"
            required
            minLength={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-resp">Nome do responsável</Label>
          <Input
            id="admin-resp"
            value={nomeResponsavel}
            onChange={(e) => setNomeResponsavel(e.target.value)}
            placeholder="Ex.: Maria Silva"
            required
            minLength={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-tel">Telefone (opcional)</Label>
          <Input
            id="admin-tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(11) 99999-0000"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-email">E-mail de login</Label>
          <Input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dono@restaurante.com.br"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-senha">Senha inicial</Label>
          <div className="flex gap-2">
            <Input
              id="admin-senha"
              type="text"
              autoComplete="off"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
              minLength={8}
            />
            <Button type="button" variant="outline" onClick={gerarSenha}>
              Gerar
            </Button>
          </div>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending || nome.trim().length < 2 || senha.length < 8}>
            <Plus className="size-4" aria-hidden="true" />
            {pending ? "Criando…" : "Criar empresa e login"}
          </Button>
        </div>
      </form>

      {ultimo && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">
            Último acesso criado para <span className="font-medium">{ultimo.nome}</span>:{" "}
            <span className="font-medium">{ultimo.email}</span>
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              void navigator.clipboard
                ?.writeText(`E-mail: ${ultimo.email}\nSenha: ${ultimo.senha}`)
                .then(() => toast.success("Credenciais copiadas."))
                .catch(() => toast.error("Não foi possível copiar."))
            }
          >
            <Copy className="size-4" aria-hidden="true" />
            Copiar e-mail e senha
          </Button>
        </div>
      )}
    </section>
  );
}

function Kpi({
  icone: Icone,
  rotulo,
  valor,
  detalhe,
}: {
  icone: typeof Building2;
  rotulo: string;
  valor: string;
  detalhe?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card px-4 py-3")}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icone className="size-4" aria-hidden="true" />
        <span className="text-xs font-medium tracking-wide uppercase">{rotulo}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}
