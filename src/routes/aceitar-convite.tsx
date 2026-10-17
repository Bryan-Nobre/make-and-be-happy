import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoadingState } from "@/components/shared/loading-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  extrairTokenConviteDaBusca,
  guardarConvitePendente,
  limparConvitePendente,
  lerConvitePendente,
} from "@/lib/convite-pendente";
import { mensagemDeErro } from "@/lib/erros";
import { MODULOS_POR_PAPEL, PAPEL_LABEL, type ModuloKey, type Papel } from "@/lib/permissoes";
import { useAuth } from "@/providers/auth";
import { useEmpresa } from "@/providers/empresa";
import { sair } from "@/services/auth";
import { aceitarConvite, consultarConvite } from "@/services/convites";

const ROTA_POR_MODULO: Partial<
  Record<ModuloKey, "/mesas" | "/pedidos" | "/cozinha" | "/caixa" | "/">
> = {
  dashboard: "/",
  pdv: "/pedidos",
  mesas: "/mesas",
  cozinha: "/cozinha",
  caixa: "/caixa",
};

function destinoAposConvite(
  papel: Papel | undefined,
): "/" | "/mesas" | "/pedidos" | "/cozinha" | "/caixa" {
  if (!papel) return "/";
  for (const modulo of MODULOS_POR_PAPEL[papel]) {
    const rota = ROTA_POR_MODULO[modulo];
    if (rota) return rota;
  }
  return "/";
}

export const Route = createFileRoute("/aceitar-convite")({
  validateSearch: (search: Record<string, unknown>) => ({
    // Aceita `convite` (atual) e `token` (links antigos), ignorando JWT do Auth.
    convite: extrairTokenConviteDaBusca(search),
  }),
  head: () => ({
    meta: [
      { title: "Convite — Arvon Food" },
      { name: "description", content: "Aceite o convite para participar de uma equipe." },
    ],
  }),
  component: AceitarConvite,
});

function BotaoSair({ rotulo = "Sair desta conta" }: { rotulo?: string }) {
  const navigate = useNavigate();
  const [saindo, setSaindo] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full"
      disabled={saindo}
      onClick={() => {
        setSaindo(true);
        void sair()
          .then(() => {
            limparConvitePendente();
            void navigate({ to: "/login", replace: true });
          })
          .catch((erro) => {
            setSaindo(false);
            toast.error(mensagemDeErro(erro));
          });
      }}
    >
      {saindo ? "Saindo…" : rotulo}
    </Button>
  );
}

function AceitarConvite() {
  const search = Route.useSearch();
  const token = search.convite || lerConvitePendente() || "";
  const navigate = useNavigate();
  const { usuario, carregando: carregandoAuth } = useAuth();
  const { selecionarEmpresa, recarregar } = useEmpresa();

  useEffect(() => {
    if (search.convite) guardarConvitePendente(search.convite);
  }, [search.convite]);

  useEffect(() => {
    if (search.convite || !token) return;
    void navigate({ to: "/aceitar-convite", search: { convite: token }, replace: true });
  }, [search.convite, token, navigate]);

  const convite = useQuery({
    queryKey: ["convite", token],
    queryFn: () => consultarConvite(token),
    enabled: token !== "" && usuario !== null && !carregandoAuth,
    retry: 2,
    retryDelay: 600,
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
      <AuthShell
        titulo="Convite inválido"
        descricao="O link do convite está incompleto. Peça um novo link ao administrador ou abra o link que foi copiado/WhatsApp (não o e-mail de confirmação sozinho)."
      >
        <div className="space-y-2">
          <Button asChild variant="outline" className="h-11 w-full">
            <Link to="/login">Ir para o login</Link>
          </Button>
          {usuario && <BotaoSair />}
        </div>
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

  if (convite.isLoading || convite.isFetching) {
    return (
      <AuthShell titulo="Convite">
        <LoadingState label="Buscando o convite…" />
      </AuthShell>
    );
  }

  const dados = convite.data;

  if (convite.isError) {
    return (
      <AuthShell
        titulo="Não foi possível abrir o convite"
        descricao="A sessão ainda pode estar sincronizando após o e-mail. Tente de novo ou saia e entre com o e-mail do convite."
      >
        <div className="space-y-2">
          <Button
            className="h-11 w-full"
            onClick={() => void convite.refetch()}
          >
            Tentar de novo
          </Button>
          <BotaoSair rotulo="Sair e usar outra conta" />
        </div>
      </AuthShell>
    );
  }

  if (!dados || !dados.valido) {
    return (
      <AuthShell
        titulo="Convite indisponível"
        descricao="Este convite já foi usado, expirou ou foi cancelado. Peça um novo link em Configurações → Usuários. Se quiser criar outra conta, saia desta sessão primeiro."
      >
        <div className="space-y-2">
          <Button asChild variant="outline" className="h-11 w-full">
            <Link to="/">Ir para o início</Link>
          </Button>
          <BotaoSair rotulo="Sair e usar outra conta" />
        </div>
      </AuthShell>
    );
  }

  const emailDiferente = usuario.email?.toLowerCase() !== dados.email.toLowerCase();

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
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              Você entrou como {usuario.email}. Saia e entre com {dados.email} para aceitar este
              convite.
            </p>
            <BotaoSair rotulo="Sair e trocar de conta" />
          </div>
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
