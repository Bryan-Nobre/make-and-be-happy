import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { CHAVE_PREFERENCIA_EMPRESA, lerContexto, salvarContexto } from "@/lib/offline/contexto";
import { podeVerModulo, type ModuloKey, type Papel } from "@/lib/permissoes";
import { useAuth } from "@/providers/auth";
import { listarVinculos, type Empresa, type Vinculo } from "@/services/empresas";

export const chaveVinculos = (usuarioId?: string) => ["vinculos", usuarioId ?? null] as const;

type EstadoEmpresa = {
  carregando: boolean;
  erro: unknown;
  vinculos: Vinculo[];
  empresa: Empresa | null;
  papel: Papel | null;
  membroId: string | null;
  nomeUsuario: string;
  selecionarEmpresa: (empresaId: string) => void;
  podeVer: (modulo: ModuloKey) => boolean;
  recarregar: () => void;
};

const EmpresaContext = createContext<EstadoEmpresa | null>(null);

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { usuario, carregando: carregandoAuth } = useAuth();
  const queryClient = useQueryClient();
  const [preferencia, setPreferencia] = useState<string | null>(null);
  const [local, setLocal] = useState<{ usuarioId: string; vinculos: Vinculo[] | null } | null>(
    null,
  );
  const usuarioId = usuario?.id ?? null;

  // A empresa escolhida é só uma preferência de navegação. O vínculo em si é
  // sempre validado contra o banco, nunca contra o que veio do navegador.
  useEffect(() => {
    setPreferencia(window.localStorage.getItem(CHAVE_PREFERENCIA_EMPRESA));
  }, [usuarioId]);

  const consulta = useQuery({
    queryKey: chaveVinculos(usuario?.id),
    queryFn: () => listarVinculos(usuario!.id),
    enabled: usuario !== null,
    staleTime: 5 * 60 * 1000,
  });

  // Vínculos salvos no aparelho: deixam o app abrir sem internet. Assim que o
  // servidor responde, a resposta dele substitui o que estava salvo.
  useEffect(() => {
    if (!usuarioId) {
      setLocal(null);
      return;
    }
    let ativo = true;
    void lerContexto(usuarioId).then((vinculos) => {
      if (ativo) setLocal({ usuarioId, vinculos });
    });
    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  useEffect(() => {
    if (usuarioId && consulta.data) void salvarContexto(usuarioId, consulta.data);
  }, [usuarioId, consulta.data]);

  const localPronto = usuarioId !== null && local?.usuarioId === usuarioId;
  const vinculosLocais = localPronto ? local.vinculos : null;
  const usandoLocal = consulta.data === undefined && vinculosLocais !== null;

  const vinculos = useMemo(
    () => consulta.data ?? vinculosLocais ?? [],
    [consulta.data, vinculosLocais],
  );

  const vinculo = useMemo(
    () => vinculos.find((v) => v.empresa.id === preferencia) ?? vinculos[0] ?? null,
    [vinculos, preferencia],
  );

  const selecionarEmpresa = useCallback((empresaId: string) => {
    window.localStorage.setItem(CHAVE_PREFERENCIA_EMPRESA, empresaId);
    setPreferencia(empresaId);
  }, []);

  const recarregar = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["vinculos"] });
  }, [queryClient]);

  const valor = useMemo<EstadoEmpresa>(
    () => ({
      // Sem resposta do servidor nem contexto salvo, segue carregando: uma
      // consulta pausada por falta de rede não pode virar "sem empresa".
      carregando:
        carregandoAuth ||
        (usuario !== null &&
          consulta.data === undefined &&
          (!localPronto || (vinculosLocais === null && consulta.error === null))),
      erro: usandoLocal ? null : consulta.error,
      vinculos,
      empresa: vinculo?.empresa ?? null,
      papel: vinculo?.papel ?? null,
      membroId: vinculo?.membroId ?? null,
      nomeUsuario: vinculo?.nomeExibicao ?? usuario?.email ?? "",
      selecionarEmpresa,
      podeVer: (modulo) => podeVerModulo(vinculo?.papel ?? null, modulo),
      recarregar,
    }),
    [
      carregandoAuth,
      usuario,
      consulta.data,
      consulta.error,
      localPronto,
      vinculosLocais,
      usandoLocal,
      vinculos,
      vinculo,
      selecionarEmpresa,
      recarregar,
    ],
  );

  return <EmpresaContext value={valor}>{children}</EmpresaContext>;
}

export function useEmpresa() {
  const contexto = useContext(EmpresaContext);
  if (!contexto) throw new Error("useEmpresa deve ser usado dentro de EmpresaProvider");
  return contexto;
}

/** Empresa atual garantida. Use dentro de telas já protegidas por RotaProtegida. */
export function useEmpresaAtual() {
  const { empresa, papel } = useEmpresa();
  if (!empresa || !papel) {
    throw new Error("Nenhuma empresa ativa no contexto");
  }
  return { empresa, papel };
}
