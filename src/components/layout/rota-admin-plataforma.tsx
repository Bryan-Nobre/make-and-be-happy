import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { LoadingScreen } from "@/components/shared/loading-state";
import { useSouAdminPlataforma } from "@/hooks/use-admin-plataforma";
import { mensagemDeErro } from "@/lib/erros";
import { useAuth } from "@/providers/auth";

/**
 * Exige sessão autenticada. A autorização real das ações fica nas RPCs
 * (exigir_admin_plataforma); aqui só evitamos renderizar a UI sem acesso.
 */
export function RotaAdminPlataforma({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { carregando: carregandoAuth, usuario } = useAuth();
  const admin = useSouAdminPlataforma();

  useEffect(() => {
    if (carregandoAuth || usuario) return;
    void navigate({ to: "/login", replace: true });
  }, [carregandoAuth, usuario, navigate]);

  if (carregandoAuth || !usuario) {
    return <LoadingScreen label="Verificando o seu acesso…" />;
  }

  if (admin.isLoading) {
    return <LoadingScreen label="Verificando permissão de plataforma…" />;
  }

  if (admin.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <ErrorState
          className="max-w-md"
          title="Não foi possível verificar o acesso"
          description={mensagemDeErro(admin.error)}
          onRetry={() => void admin.refetch()}
        />
      </div>
    );
  }

  return <>{children}</>;
}
