/**
 * Guarda o token do convite no aparelho enquanto a pessoa confirma o e-mail
 * ou troca de aba. O e-mail de confirmação do Auth deve apontar para
 * `/aceitar-convite?convite=…` via `emailRedirectTo`.
 *
 * Usamos o parâmetro `convite` (não `token`) para não colidir com o `token`
 * que o Supabase Auth coloca nas URLs de confirmação.
 */

const CHAVE = "arvon_convite_pendente";

/** Tokens nossos vêm de `encode(gen_random_bytes(24), 'hex')` — só hex. */
export function ehTokenConvite(valor: string): boolean {
  return /^[a-f0-9]{32,64}$/i.test(valor.trim());
}

export function extrairTokenConviteDaBusca(search: Record<string, unknown>): string {
  for (const chave of ["convite", "token"] as const) {
    const bruto = search[chave];
    if (typeof bruto === "string" && ehTokenConvite(bruto)) return bruto.trim();
  }
  return "";
}

export function guardarConvitePendente(token: string): void {
  const limpo = token.trim();
  if (!ehTokenConvite(limpo) || typeof window === "undefined") return;
  window.localStorage.setItem(CHAVE, limpo);
}

export function lerConvitePendente(): string | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(CHAVE);
  return token && ehTokenConvite(token) ? token.trim() : null;
}

export function limparConvitePendente(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CHAVE);
}

/** URL para o Auth redirecionar após confirmar o e-mail, já com o token do convite. */
export function urlRedirectConvite(token: string): string {
  const url = new URL("/aceitar-convite", window.location.origin);
  url.searchParams.set("convite", token.trim());
  return url.toString();
}
