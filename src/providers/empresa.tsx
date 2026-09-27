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

import { podeVerModulo, type ModuloKey, type Papel } from "@/lib/permissoes";
import { useAuth } from "@/providers/auth";
import { listarVinculos, type Empresa, type Vinculo } from "@/services/empresas";

const CHAVE_PREFERENCIA = "arvon:empresa";

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

  // A empresa escolhida é só uma preferência de navegação. O vínculo em si é
  // sempre validado contra o banco, nunca contra o que veio do navegador.
  useEffect(() => {
    setPreferencia(window.localStorage.getItem(CHAVE_PREFERENCIA));
  }, []);

  const consulta = useQuery({
    queryKey: chaveVinculos(usuario?.id),
    queryFn: () => listarVinculos(usuario!.id),
    enabled: usuario !== null,
    staleTime: 5 * 60 * 1000,
  });

  const vinculos = useMemo(() => consulta.data ?? [], [consulta.data]);

  const vinculo = useMemo(
    () => vinculos.find((v) => v.empresa.id === preferencia) ?? vinculos[0] ?? null,
    [vinculos, preferencia],
  );

  const selecionarEmpresa = useCallback((empresaId: string) => {
    window.localStorage.setItem(CHAVE_PREFERENCIA, empresaId);
    setPreferencia(empresaId);
  }, []);

  const recarregar = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["vinculos"] });
  }, [queryClient]);

  const valor = useMemo<EstadoEmpresa>(
    () => ({
      carregando: carregandoAuth || (usuario !== null && consulta.isLoading),
      erro: consulta.error,
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
      consulta.isLoading,
      consulta.error,
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
