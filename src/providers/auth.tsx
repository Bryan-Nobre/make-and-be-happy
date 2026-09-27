import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/lib/supabase";

type EstadoAuth = {
  carregando: boolean;
  sessao: Session | null;
  usuario: User | null;
};

const AuthContext = createContext<EstadoAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoAuth>({
    carregando: true,
    sessao: null,
    usuario: null,
  });

  useEffect(() => {
    let ativo = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      setEstado({ carregando: false, sessao: data.session, usuario: data.session?.user ?? null });
    });

    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setEstado({ carregando: false, sessao, usuario: sessao?.user ?? null });
    });

    return () => {
      ativo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext value={estado}>{children}</AuthContext>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return contexto;
}
