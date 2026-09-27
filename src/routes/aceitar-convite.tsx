import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoadingState } from "@/components/shared/loading-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { mensagemDeErro } from "@/lib/erros";
import { PAPEL_LABEL } from "@/lib/permissoes";
import { useAuth } from "@/providers/auth";
import { useEmpresa } from "@/providers/empresa";
import { aceitarConvite, consultarConvite } from "@/services/convites";

export const Route = createFileRoute("/aceitar-convite")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Convite — ARVON FOOD" },
      { name: "description", content: "Aceite o convite para participar de uma equipe." },
    ],
  }),
  component: AceitarConvite,
});

function AceitarConvite() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const { usuario, carregando: carregandoAuth } = useAuth();
  const { selecionarEmpresa, recarregar } = useEmpresa();

  const convite = useQuery({
    queryKey: ["convite", token],
    queryFn: () => consultarConvite(token),
    enabled: token !== "" && usuario !== null,
    retry: false,
  });

  const aceitar = useMutation({
    mutationFn: () => aceitarConvite(token),
    onSuccess: (empresaId) => {
      selecionarEmpresa(empresaId);
      recarregar();
      toast.success("Convite aceito. Bem-vindo à equipe.");
      void navigate({ to: "/", replace: true });
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
