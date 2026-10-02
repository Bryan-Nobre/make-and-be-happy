import { PAPEIS, type Papel } from "@/lib/permissoes";
import type { Vinculo } from "@/services/empresas";

import { gravar, ler, SCHEMA_VERSION } from "./banco";

/** Última empresa escolhida no aparelho. É só preferência de navegação, não autoriza nada. */
export const CHAVE_PREFERENCIA_EMPRESA = "arvon:empresa";

type RegistroContexto = {
  schemaVersion: number;
  salvoEm: number;
  vinculos: Vinculo[];
};

/** Descarta o contexto salvo depois deste tempo sem confirmação do servidor. */
const IDADE_MAXIMA_MS = 7 * 24 * 60 * 60 * 1000;

const ehPapel = (valor: unknown): valor is Papel => PAPEIS.includes(valor as Papel);

function ehVinculo(valor: unknown): valor is Vinculo {
  if (typeof valor !== "object" || valor === null) return false;
  const v = valor as Partial<Vinculo>;
  return (
    typeof v.membroId === "string" &&
    ehPapel(v.papel) &&
    typeof v.nomeExibicao === "string" &&
    typeof v.empresa?.id === "string" &&
    typeof v.empresa.nome === "string"
  );
}

/**
 * Guarda os vínculos do usuário para o app conseguir abrir sem internet. Só
 * serve para a interface: ao reconectar, o vínculo é revalidado no servidor.
 */
export function salvarContexto(usuarioId: string, vinculos: Vinculo[]): Promise<void> {
  const registro: RegistroContexto = {
    schemaVersion: SCHEMA_VERSION,
    salvoEm: Date.now(),
    vinculos,
  };
  return gravar("contexto", usuarioId, registro);
}

export async function lerContexto(usuarioId: string): Promise<Vinculo[] | null> {
  const registro = await ler<RegistroContexto>("contexto", usuarioId);
  if (
    !registro ||
    registro.schemaVersion !== SCHEMA_VERSION ||
    Date.now() - registro.salvoEm > IDADE_MAXIMA_MS ||
    !Array.isArray(registro.vinculos) ||
    !registro.vinculos.every(ehVinculo)
  ) {
    return null;
  }
  return registro.vinculos;
}
