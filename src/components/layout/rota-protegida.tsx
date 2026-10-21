import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { LoadingScreen } from "@/components/shared/loading-state";
import { useSouAdminPlataforma } from "@/hooks/use-admin-plataforma";
import { lerConvitePendente } from "@/lib/convite-pendente";
import { mensagemDeErro } from "@/lib/erros";
import { useConexao } from "@/lib/offline/conectividade";
import { useAuth } from "@/providers/auth";
import { useEmpresa } from "@/providers/empresa";
import { useCacheOffline } from "@/providers/offline";

/**
 * Impede que a interface autenticada apareça sem sessão ou sem vínculo com uma
 * empresa. É conveniência de navegação: o isolamento real dos dados vem da RLS.
 */
export function RotaProtegida({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { carregando: carregandoAuth, usuario } = useAuth();
  const { carregando, erro, vinculos, empresa, recarregar } = useEmpresa();
  const { restaurado } = useCacheOffline();
  const conexao = useConexao();
  const adminPlataforma = useSouAdminPlataforma();

  useEffect(() => {
    if (carregandoAuth || usuario) return;
    void navigate({ to: "/login", replace: true });
  }, [carregandoAuth, usuario, navigate]);

  useEffect(() => {
    if (carregando || !usuario || erro || vinculos.length > 0) return;
    // Admin da plataforma sem vínculo vai para o painel SaaS, não para onboarding.
    if (adminPlataforma.isLoading || adminPlataforma.data === true) {
      if (adminPlataforma.data === true) {
        void navigate({ to: "/admin", replace: true });
      }
      return;
    }

    // Convite pendente: não manda criar restaurante novo (vira dono com tudo liberado).
    const convite = lerConvitePendente();
    if (convite) {
      void navigate({ to: "/aceitar-convite", search: { convite }, replace: true });
      return;
    }

    // Sem vínculo: não abre criação de empresa (só admin cria no /admin).
    void navigate({ to: "/onboarding", replace: true });
  }, [
    carregando,
    usuario,
    erro,
    vinculos.length,
    navigate,
    adminPlataforma.isLoading,
    adminPlataforma.data,
  ]);

  if (carregandoAuth || !usuario) {
    return <LoadingScreen label="Verificando o seu acesso…" />;
  }

  if (carregando && conexao === "OFFLINE") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <ErrorState
          className="max-w-md"
          title="Sem conexão"
          description="Ainda não há dados salvos deste acesso neste aparelho. Conecte-se à internet uma vez para usar o modo offline."
          onRetry={recarregar}
        />
      </div>
    );
  }

  if (carregando) {
    return <LoadingScreen label="Carregando a sua empresa…" />;
  }

  if (erro) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <ErrorState
          className="max-w-md"
          title="Não foi possível carregar a sua empresa"
          description={mensagemDeErro(erro)}
          onRetry={recarregar}
        />
      </div>
    );
  }

  if (!empresa) {
    return <LoadingScreen label="Redirecionando…" />;
  }

  if (!restaurado) {
    return <LoadingScreen label="Carregando a sua empresa…" />;
  }

  return <>{children}</>;
}
