import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const CHAVE_MENU_RECOLHIDO = "arvon:menu-recolhido";

type EstadoMenuLayout = {
  recolhido: boolean;
  /** Só true no clique do usuário — evita animar ao trocar de página. */
  animar: boolean;
  alternar: () => void;
};

const MenuLayoutContext = createContext<EstadoMenuLayout | null>(null);

function lerRecolhido(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_MENU_RECOLHIDO) === "1";
  } catch {
    return false;
  }
}

function gravarRecolhido(recolhido: boolean) {
  try {
    window.localStorage.setItem(CHAVE_MENU_RECOLHIDO, recolhido ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/**
 * Estado do menu lateral (expandido/recolhido). Vive acima das rotas para
 * não “piscar” ao trocar de página (cada tela remonta o AppLayout).
 */
export function MenuLayoutProvider({ children }: { children: ReactNode }) {
  const [recolhido, setRecolhido] = useState(false);
  const [animar, setAnimar] = useState(false);

  useEffect(() => {
    setRecolhido(lerRecolhido());
  }, []);

  const alternar = useCallback(() => {
    setAnimar(true);
    setRecolhido((atual) => {
      const proximo = !atual;
      gravarRecolhido(proximo);
      return proximo;
    });
  }, []);

  const valor = useMemo(() => ({ recolhido, animar, alternar }), [recolhido, animar, alternar]);

  return <MenuLayoutContext.Provider value={valor}>{children}</MenuLayoutContext.Provider>;
}

export function useMenuLayout() {
  const ctx = useContext(MenuLayoutContext);
  if (!ctx) throw new Error("useMenuLayout deve ser usado dentro de MenuLayoutProvider");
  return ctx;
}
