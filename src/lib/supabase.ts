import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/db";

const url = import.meta.env.VITE_SUPABASE_URL;
const chavePublica = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !chavePublica) {
  throw new Error(
    "Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local antes de iniciar a aplicação.",
  );
}

/**
 * Cliente único do Supabase. A chave publicável é pública por definição: o
 * isolamento entre empresas e a autorização vivem em RLS e nas funções do
 * Postgres, nunca neste arquivo.
 */
export const supabase = createClient<Database>(url, chavePublica, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
