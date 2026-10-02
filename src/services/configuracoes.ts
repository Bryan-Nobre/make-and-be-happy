import { exigirAlteracao } from "@/lib/erros";
import { converterParaWebp } from "@/lib/imagem-webp";
import { supabase } from "@/lib/supabase";
import type { Enums } from "@/types/db";

const BUCKET_LOGOS = "logos";
/** Suficiente para o cabeçalho e para o futuro cardápio digital. */
const LADO_MAXIMO_LOGO = 512;

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
  await exigirAlteracao(
    supabase
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
      .eq("id", empresaId)
      .select("id"),
  );
}

/** Caminho do arquivo dentro do bucket, extraído da URL pública. */
function caminhoDoLogo(url: string | null): string | null {
  const marcador = `/object/public/${BUCKET_LOGOS}/`;
  const posicao = url?.indexOf(marcador) ?? -1;
  return url && posicao >= 0 ? decodeURIComponent(url.slice(posicao + marcador.length)) : null;
}

/** A limpeza do arquivo antigo é só economia de espaço: se falhar, o logo novo já vale. */
async function apagarArquivoLogo(urlAnterior: string | null) {
  const caminho = caminhoDoLogo(urlAnterior);
  if (caminho) await supabase.storage.from(BUCKET_LOGOS).remove([caminho]);
}

export async function enviarLogo(
  empresaId: string,
  arquivo: File,
  urlAnterior: string | null,
): Promise<void> {
  const webp = await converterParaWebp(arquivo, { ladoMaximo: LADO_MAXIMO_LOGO });
  const caminho = `${empresaId}/logo-${Date.now()}.webp`;

  const { error: erroUpload } = await supabase.storage
    .from(BUCKET_LOGOS)
    .upload(caminho, webp, { contentType: "image/webp" });

  if (erroUpload) throw erroUpload;

  const { data } = supabase.storage.from(BUCKET_LOGOS).getPublicUrl(caminho);

  await exigirAlteracao(
    supabase.from("empresas").update({ logo_url: data.publicUrl }).eq("id", empresaId).select("id"),
  );
  await apagarArquivoLogo(urlAnterior);
}

export async function removerLogo(empresaId: string, urlAtual: string | null): Promise<void> {
  await exigirAlteracao(
    supabase.from("empresas").update({ logo_url: null }).eq("id", empresaId).select("id"),
  );
  await apagarArquivoLogo(urlAtual);
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
  await exigirAlteracao(
    supabase
      .from("formas_pagamento")
      .update({ ativa })
      .eq("empresa_id", empresaId)
      .eq("metodo", metodo)
      .select("metodo"),
  );
}
