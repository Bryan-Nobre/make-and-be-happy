import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { supabase } from "@/lib/supabase";
import { novoUuid } from "@/lib/uuid";

/** Eventos que chegam juntos (ex.: um pagamento que mexe em vários pedidos) viram uma recarga só. */
const ESPERA_MS = 300;

/**
 * Assina as mudanças das tabelas da empresa e recarrega as consultas informadas.
 *
 * - O filtro por empresa reduz o tráfego; quem garante o isolamento é a RLS,
 *   que o Realtime aplica antes de entregar cada evento.
 * - O nome do canal é único por montagem: o supabase-js reaproveita um canal
 *   de mesmo nome, e ao trocar de tela rápido a tela nova pegaria o canal que
 *   a anterior está fechando.
 * - Quando o canal volta depois de cair, recarrega na hora o que pode ter
 *   mudado no intervalo, sem esperar a consulta de reserva.
 */
export function useRealtime({
  nome,
  empresaId,
  tabelas,
  invalidar,
}: {
  nome: string;
  empresaId: string;
  tabelas: readonly string[];
  invalidar: readonly QueryKey[];
}) {
  const queryClient = useQueryClient();
  const invalidarRef = useRef(invalidar);
  invalidarRef.current = invalidar;
  const listaTabelas = tabelas.join(",");

  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | undefined;
    let jaInscrito = false;

    const recarregar = () => {
      clearTimeout(espera);
      espera = setTimeout(() => {
        for (const queryKey of invalidarRef.current) {
          void queryClient.invalidateQueries({ queryKey });
        }
      }, ESPERA_MS);
    };

    let canal = supabase.channel(`${nome}:${empresaId}:${novoUuid()}`);
    for (const tabela of listaTabelas.split(",")) {
      canal = canal.on(
        "postgres_changes",
        { event: "*", schema: "public", table: tabela, filter: `empresa_id=eq.${empresaId}` },
        recarregar,
      );
    }
    canal.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      if (jaInscrito) recarregar();
      jaInscrito = true;
    });

    return () => {
      clearTimeout(espera);
      void supabase.removeChannel(canal);
    };
  }, [nome, empresaId, listaTabelas, queryClient]);
}
