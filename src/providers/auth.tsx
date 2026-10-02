import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { limparTudo } from "@/lib/offline/banco";
import { CHAVE_PREFERENCIA_EMPRESA } from "@/lib/offline/contexto";
import { supabase } from "@/lib/supabase";

type EstadoAuth = {
  carregando: boolean;
  sessao: Session | null;
  usuario: User | null;
};

const AuthContext = createContext<EstadoAuth | null>(null);

const CHAVE_SESSAO_SUPABASE = `sb-${new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

/**
 * Offline e com o token expirado, o Supabase não consegue renovar a sessão e
 * `getSession` devolve `null`, mas mantém a sessão guardada (ele a apaga quando
 * a renovação é recusada de fato). Nesse caso usamos só a identidade guardada
 * para o app abrir com os dados locais. Nenhum token é usado: sem sessão
 * válida, toda chamada ao servidor falha e a RLS continua valendo. Ao
 * reconectar, o próprio Supabase renova ou encerra a sessão.
 */
function usuarioGuardado(): User | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE_SESSAO_SUPABASE);
    if (!bruto) return null;
    const salvo = JSON.parse(bruto) as { user?: Partial<User> };
    return typeof salvo.user?.id === "string" ? (salvo.user as User) : null;
  } catch {
    return null;
  }
}

function resolver(sessao: Session | null): EstadoAuth {
  if (sessao) return { carregando: false, sessao, usuario: sessao.user };
  return { carregando: false, sessao: null, usuario: usuarioGuardado() };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoAuth>({
    carregando: true,
    sessao: null,
    usuario: null,
  });

  useEffect(() => {
    let ativo = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      setEstado(resolver(data.session));
    });

    const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "SIGNED_OUT") {
        // Logout em qualquer caminho (botão, sessão revogada, outra aba) apaga os
        // dados locais para não deixar nada de uma empresa no aparelho.
        queryClient.clear();
        void limparTudo();
        window.localStorage.removeItem(CHAVE_PREFERENCIA_EMPRESA);
        setEstado({ carregando: false, sessao: null, usuario: null });
        return;
      }
      setEstado(resolver(sessao));
    });

    return () => {
      ativo = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  return <AuthContext value={estado}>{children}</AuthContext>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return contexto;
}
