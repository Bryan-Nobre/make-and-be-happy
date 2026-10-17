import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoadingState } from "@/components/shared/loading-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  guardarConvitePendente,
  limparConvitePendente,
  lerConvitePendente,
} from "@/lib/convite-pendente";
import { mensagemDeErro } from "@/lib/erros";
import { MODULOS_POR_PAPEL, PAPEL_LABEL, type ModuloKey, type Papel } from "@/lib/permissoes";
import { useAuth } from "@/providers/auth";
import { useEmpresa } from "@/providers/empresa";
import { aceitarConvite, consultarConvite } from "@/services/convites";

const ROTA_POR_MODULO: Partial<Record<ModuloKey, "/mesas" | "/pedidos" | "/cozinha" | "/caixa" | "/">> =
  {
    dashboard: "/",
    pdv: "/pedidos",
    mesas: "/mesas",
    cozinha: "/cozinha",
    caixa: "/caixa",
  };

function destinoAposConvite(papel: Papel | undefined): "/" | "/mesas" | "/pedidos" | "/cozinha" | "/caixa" {
  if (!papel) return "/";
  for (const modulo of MODULOS_POR_PAPEL[papel]) {
    const rota = ROTA_POR_MODULO[modulo];
    if (rota) return rota;
  }
  return "/";
}

export const Route = createFileRoute("/aceitar-convite")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Convite — Arvon Food" },
      { name: "description", content: "Aceite o convite para participar de uma equipe." },
    ],
  }),
  component: AceitarConvite,
});

function AceitarConvite() {
  const search = Route.useSearch();
  const token = search.token || lerConvitePendente() || "";
  const navigate = useNavigate();
  const { usuario, carregando: carregandoAuth } = useAuth();
  const { selecionarEmpresa, recarregar } = useEmpresa();

  useEffect(() => {
    if (search.token) guardarConvitePendente(search.token);
  }, [search.token]);

  useEffect(() => {
    if (search.token || !token) return;
    void navigate({ to: "/aceitar-convite", search: { token }, replace: true });
  }, [search.token, token, navigate]);

  const convite = useQuery({
    queryKey: ["convite", token],
    queryFn: () => consultarConvite(token),
    enabled: token !== "" && usuario !== null,
    retry: false,
  });

  const aceitar = useMutation({
    mutationFn: () => aceitarConvite(token),
    onSuccess: (empresaId) => {
      limparConvitePendente();
      selecionarEmpresa(empresaId);
      recarregar();
      const papel = convite.data?.papel;
      toast.success(
        papel
          ? `Convite aceito. Você entrou como ${PAPEL_LABEL[papel]}.`
          : "Convite aceito. Bem-vindo à equipe.",
      );
      void navigate({ to: destinoAposConvite(papel), replace: true });
    },
    onError: (erro) => toast.error(mensagemDeErro(erro)),
  });

  if (!token) {
    return (
      <AuthShell titulo="Convite inválido" descricao="O link do convite está incompleto.">
        <Button asChild variant="outline" className="h-11 w-full">
          <Link to="/login">Ir para o login</Link>
        </Button>
      </AuthShell>
    );
  }

  if (carregandoAuth) {
    return (
      <AuthShell titulo="Convite">
        <LoadingState label="Verificando o seu acesso…" />
      </AuthShell>
    );
  }

  if (!usuario) {
    return (
      <AuthShell
        titulo="Você recebeu um convite"
        descricao="Entre ou crie a sua conta com o e-mail que recebeu o convite para continuar."
      >
        <div className="space-y-2">
          <Button asChild className="h-11 w-full">
            <Link to="/cadastro" search={{ convite: token }}>
              Criar conta
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 w-full">
            <Link to="/login" search={{ convite: token }}>
              Já tenho conta
            </Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (convite.isLoading) {
    return (
      <AuthShell titulo="Convite">
        <LoadingState label="Buscando o convite…" />
      </AuthShell>
    );
  }

  const dados = convite.data;

  if (convite.isError || !dados || !dados.valido) {
    return (
      <AuthShell
        titulo="Convite indisponível"
        descricao="Este convite não existe mais ou já expirou. Peça um novo ao administrador do restaurante."
      >
        <Button asChild variant="outline" className="h-11 w-full">
          <Link to="/">Ir para o início</Link>
        </Button>
      </AuthShell>
    );
  }

  const emailDiferente = usuario.email?.toLowerCase() !== dados.email;

  return (
    <AuthShell
      titulo="Você recebeu um convite"
      descricao={`Participe da operação de ${dados.empresaNome}.`}
    >
      <div className="space-y-4">
        <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Perfil</span>
            <StatusBadge tone="primary">{PAPEL_LABEL[dados.papel]}</StatusBadge>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Convite para</span>
            <span className="font-medium">{dados.email}</span>
          </div>
        </div>

        {emailDiferente ? (
          <p className="text-sm text-destructive">
            Você entrou como {usuario.email}. Saia e entre com {dados.email} para aceitar este
            convite.
          </p>
        ) : (
          <Button
            className="h-11 w-full"
            onClick={() => aceitar.mutate()}
            disabled={aceitar.isPending}
          >
            {aceitar.isPending ? "Aceitando…" : "Aceitar convite"}
          </Button>
        )}
      </div>
    </AuthShell>
  );
}
