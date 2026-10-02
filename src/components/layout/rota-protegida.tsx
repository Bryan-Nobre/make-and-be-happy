import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { LoadingScreen } from "@/components/shared/loading-state";
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

  useEffect(() => {
    if (carregandoAuth || usuario) return;
    void navigate({ to: "/login", replace: true });
  }, [carregandoAuth, usuario, navigate]);

  useEffect(() => {
    if (carregando || !usuario || erro || vinculos.length > 0) return;
    void navigate({ to: "/onboarding", replace: true });
  }, [carregando, usuario, erro, vinculos.length, navigate]);

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
