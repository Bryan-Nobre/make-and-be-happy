import { supabase } from "@/lib/supabase";
import type { Enums } from "@/types/db";

export type MetodoPagamento = Enums<"metodo_pagamento">;

export const METODO_LABEL: Record<MetodoPagamento, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  DEBITO: "Cartão de débito",
  CREDITO: "Cartão de crédito",
};

export type FormaPagamento = {
  metodo: MetodoPagamento;
  ativa: boolean;
  ordem: number;
};

export type EntradaEmpresa = {
  nome: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  horarioFuncionamento: string;
  taxaServico: number;
  envioAutomaticoCozinha: boolean;
};

export async function atualizarEmpresa(empresaId: string, entrada: EntradaEmpresa): Promise<void> {
  const { error } = await supabase
    .from("empresas")
    .update({
      nome: entrada.nome.trim(),
      cnpj: entrada.cnpj.trim() || null,
      telefone: entrada.telefone.trim() || null,
      endereco: entrada.endereco.trim() || null,
      horario_funcionamento: entrada.horarioFuncionamento.trim() || null,
      taxa_servico: entrada.taxaServico,
      envio_automatico_cozinha: entrada.envioAutomaticoCozinha,
    })
    .eq("id", empresaId);

  if (error) throw error;
}

export async function listarFormasPagamento(empresaId: string): Promise<FormaPagamento[]> {
  const { data, error } = await supabase
    .from("formas_pagamento")
    .select("metodo, ativa, ordem")
    .eq("empresa_id", empresaId)
    .order("ordem");

  if (error) throw error;
  return data;
}

export async function definirFormaPagamentoAtiva(
  empresaId: string,
  metodo: MetodoPagamento,
  ativa: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("formas_pagamento")
    .update({ ativa })
    .eq("empresa_id", empresaId)
    .eq("metodo", metodo);

  if (error) throw error;
}
