import { supabase } from "@/lib/supabase";

const normalizar = (email: string) => email.trim().toLowerCase();

export async function entrar(email: string, senha: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: normalizar(email),
    password: senha,
  });

  if (error) throw error;
}

/**
 * Cria a conta. Retorna `true` quando o Supabase já devolve sessão ativa e
 * `false` quando o projeto exige confirmação de e-mail antes do primeiro acesso.
 */
export async function cadastrar(email: string, senha: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({
    email: normalizar(email),
    password: senha,
  });

  if (error) throw error;

  return data.session !== null;
}

export async function sair(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
