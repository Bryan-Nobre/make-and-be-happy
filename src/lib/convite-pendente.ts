/**
 * Guarda o token do convite no aparelho enquanto a pessoa confirma o e-mail
 * ou troca de aba. O e-mail de confirmação do Auth também deve apontar para
 * `/aceitar-convite?token=…` via `emailRedirectTo`.
 */
const CHAVE = "arvon_convite_pendente";

export function guardarConvitePendente(token: string): void {
  const limpo = token.trim();
  if (!limpo || typeof window === "undefined") return;
  window.localStorage.setItem(CHAVE, limpo);
}

export function lerConvitePendente(): string | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(CHAVE);
  return token && token.trim() !== "" ? token.trim() : null;
}

export function limparConvitePendente(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CHAVE);
}

/** URL para o Auth redirecionar após confirmar o e-mail, já com o token do convite. */
export function urlRedirectConvite(token: string): string {
  const url = new URL("/aceitar-convite", window.location.origin);
  url.searchParams.set("token", token.trim());
  return url.toString();
}
