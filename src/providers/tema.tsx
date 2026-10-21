import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const CHAVE_TEMA = "arvon:tema";

type EstadoTema = {
  escuro: boolean;
  alternar: () => void;
};

const TemaContext = createContext<EstadoTema | null>(null);

function aplicar(escuro: boolean) {
  document.documentElement.classList.toggle("dark", escuro);
  try {
    window.localStorage.setItem(CHAVE_TEMA, escuro ? "dark" : "light");
  } catch {
    /* ignore */
  }
}

function lerEscuro(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_TEMA) === "dark";
  } catch {
    return false;
  }
}

/** Script inline no `<head>` para aplicar o tema antes do React hidratar. */
export const SCRIPT_TEMA = `(function(){try{if(localStorage.getItem("${CHAVE_TEMA}")==="dark")document.documentElement.classList.add("dark")}catch(e){}})();`;

export function TemaProvider({ children }: { children: ReactNode }) {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    const salvo = lerEscuro();
    setEscuro(salvo);
    document.documentElement.classList.toggle("dark", salvo);
  }, []);

  const alternar = useCallback(() => {
    setEscuro((atual) => {
      const proximo = !atual;
      aplicar(proximo);
      return proximo;
    });
  }, []);

  const valor = useMemo(() => ({ escuro, alternar }), [escuro, alternar]);

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

export function useTema() {
  const ctx = useContext(TemaContext);
  if (!ctx) throw new Error("useTema deve ser usado dentro de TemaProvider");
  return ctx;
}
