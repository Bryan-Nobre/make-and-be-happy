import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoadingScreen } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { useSouAdminPlataforma } from "@/hooks/use-admin-plataforma";
import { lerConvitePendente } from "@/lib/convite-pendente";
import { mensagemDeErro } from "@/lib/erros";
import { useAuth } from "@/providers/auth";
import { useEmpresa } from "@/providers/empresa";
import { sair } from "@/services/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Aguardando acesso — Arvon Food" },
      {
        name: "description",
        content: "O acesso ao restaurante é liberado pelo administrador da plataforma.",
      },
    ],
  }),
  component: Onboarding,
});

/**
 * Self-service de criação de empresa foi desligado no MVP.
 * Contas e restaurantes nascem no /admin.
 */
function Onboarding() {
  const navigate = useNavigate();
  const { usuario, carregando: carregandoAuth } = useAuth();
  const { carregando, vinculos } = useEmpresa();
  const admin = useSouAdminPlataforma();

  useEffect(() => {
    if (carregandoAuth || usuario) return;
    void navigate({ to: "/login", replace: true });
  }, [carregandoAuth, usuario, navigate]);

  useEffect(() => {
    if (carregandoAuth || !usuario || carregando) return;
    if (vinculos.length > 0) {
      void navigate({ to: "/", replace: true });
      return;
    }
    const convite = lerConvitePendente();
    if (convite) {
      void navigate({ to: "/aceitar-convite", search: { convite }, replace: true });
      return;
    }
    if (admin.data === true) {
      void navigate({ to: "/admin", replace: true });
    }
  }, [carregandoAuth, usuario, carregando, vinculos.length, navigate, admin.data]);

  if (carregandoAuth || !usuario || carregando || admin.isLoading) {
    return <LoadingScreen label="Verificando o seu acesso…" />;
  }

  if (vinculos.length === 0 && lerConvitePendente()) {
    return <LoadingScreen label="Abrindo o seu convite…" />;
  }

  return (
    <AuthShell
      titulo="Acesso ainda não liberado"
      descricao="Novos restaurantes são cadastrados pelo administrador da Arvon Food. Se você já recebeu e-mail e senha, volte ao login. Se foi convidado para uma equipe, use o link do convite."
      rodape={
        <button
          type="button"
          onClick={() =>
            void sair()
              .then(() => navigate({ to: "/login", replace: true }))
              .catch((erro) => toast.error(mensagemDeErro(erro)))
          }
          className="font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          Sair desta conta
        </button>
      }
    >
      <div className="space-y-2">
        <Button asChild className="h-11 w-full">
          <Link to="/login">Ir para o login</Link>
        </Button>
        {admin.data === true && (
          <Button asChild variant="outline" className="h-11 w-full">
            <Link to="/admin">Abrir admin da plataforma</Link>
          </Button>
        )}
      </div>
    </AuthShell>
  );
}
