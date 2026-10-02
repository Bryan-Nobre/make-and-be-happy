import { converterParaWebp } from "@/lib/imagem-webp";
import { supabase } from "@/lib/supabase";

export type Categoria = {
  id: string;
  nome: string;
  ordem: number;
  ativa: boolean;
};

export type Setor = {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
};

export type Produto = {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  codigo: string;
  imagemUrl: string | null;
  ativo: boolean;
  disponivel: boolean;
  categoriaId: string;
  setorId: string | null;
  grupoIds: string[];
};

export type OpcaoAdicional = {
  id: string;
  nome: string;
  preco: number;
  ordem: number;
  ativo: boolean;
};

export type GrupoAdicional = {
  id: string;
  nome: string;
  minimo: number;
  maximo: number;
  obrigatorio: boolean;
  ativo: boolean;
  opcoes: OpcaoAdicional[];
};

const BUCKET_PRODUTOS = "produtos";

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export async function listarCategorias(empresaId: string): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from("categorias")
    .select("id, nome, ordem, ativa")
    .eq("empresa_id", empresaId)
    .order("ordem")
    .order("nome");

  if (error) throw error;
  return data;
}

export async function salvarCategoria(
  empresaId: string,
  entrada: { id?: string; nome: string; ordem: number },
): Promise<void> {
  const valores = { nome: entrada.nome.trim(), ordem: entrada.ordem };

  const { error } = entrada.id
    ? await supabase.from("categorias").update(valores).eq("id", entrada.id)
    : await supabase.from("categorias").insert({ empresa_id: empresaId, ...valores });

  if (error) throw error;
}

export async function renomearCategoria(id: string, nome: string): Promise<void> {
  const { error } = await supabase.from("categorias").update({ nome: nome.trim() }).eq("id", id);
  if (error) throw error;
}

export async function definirCategoriaAtiva(id: string, ativa: boolean): Promise<void> {
  const { error } = await supabase.from("categorias").update({ ativa }).eq("id", id);
  if (error) throw error;
}

export async function excluirCategoria(id: string): Promise<void> {
  const { error } = await supabase.from("categorias").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Setores de produção
// ---------------------------------------------------------------------------

export async function listarSetores(empresaId: string): Promise<Setor[]> {
  const { data, error } = await supabase
    .from("setores_cozinha")
    .select("id, nome, ordem, ativo")
    .eq("empresa_id", empresaId)
    .order("ordem")
    .order("nome");

  if (error) throw error;
  return data;
}

export async function salvarSetor(
  empresaId: string,
  entrada: { id?: string; nome: string; ordem: number },
): Promise<void> {
  const valores = { nome: entrada.nome.trim(), ordem: entrada.ordem };

  const { error } = entrada.id
    ? await supabase.from("setores_cozinha").update(valores).eq("id", entrada.id)
    : await supabase.from("setores_cozinha").insert({ empresa_id: empresaId, ...valores });

  if (error) throw error;
}

/** Itens já lançados guardam `nome_setor`: renomear não altera o histórico. */
export async function renomearSetor(id: string, nome: string): Promise<void> {
  const { error } = await supabase
    .from("setores_cozinha")
    .update({ nome: nome.trim() })
    .eq("id", id);
  if (error) throw error;
}

export async function definirSetorAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from("setores_cozinha").update({ ativo }).eq("id", id);
  if (error) throw error;
}

export async function excluirSetor(id: string): Promise<void> {
  const { error } = await supabase.from("setores_cozinha").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------

type LinhaProduto = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  codigo: string | null;
  imagem_url: string | null;
  ativo: boolean;
  disponivel: boolean;
  categoria_id: string;
  setor_id: string | null;
  produto_grupo_adicional: { grupo_id: string; ordem: number }[];
};

function paraProduto(linha: LinhaProduto): Produto {
  return {
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao ?? "",
    preco: Number(linha.preco),
    codigo: linha.codigo ?? "",
    imagemUrl: linha.imagem_url,
    ativo: linha.ativo,
    disponivel: linha.disponivel,
    categoriaId: linha.categoria_id,
    setorId: linha.setor_id,
    grupoIds: [...linha.produto_grupo_adicional]
      .sort((a, b) => a.ordem - b.ordem)
      .map((v) => v.grupo_id),
  };
}

export async function listarProdutos(empresaId: string): Promise<Produto[]> {
  const { data, error } = await supabase
    .from("produtos")
    .select(
      `id, nome, descricao, preco, codigo, imagem_url, ativo, disponivel,
       categoria_id, setor_id,
       produto_grupo_adicional (grupo_id, ordem)`,
    )
    .eq("empresa_id", empresaId)
    .order("nome")
    .returns<LinhaProduto[]>();

  if (error) throw error;
  return (data ?? []).map(paraProduto);
}

export type EntradaProduto = {
  id?: string;
  nome: string;
  descricao: string;
  preco: number;
  codigo: string;
  categoriaId: string;
  setorId: string | null;
  grupoIds: string[];
};

/** Produto e vínculos com grupos são gravados juntos: se algo falhar, nada muda. */
export async function salvarProduto(empresaId: string, entrada: EntradaProduto): Promise<string> {
  const { data, error } = await supabase.rpc("salvar_produto", {
    p_empresa: empresaId,
    p_produto: entrada.id ?? null,
    p_nome: entrada.nome.trim(),
    p_descricao: entrada.descricao.trim(),
    p_preco: entrada.preco,
    p_codigo: entrada.codigo.trim(),
    p_categoria: entrada.categoriaId,
    p_setor: entrada.setorId,
    p_grupos: entrada.grupoIds,
  });

  if (error) throw error;
  return data;
}

/** Produto nunca é excluído: sai do cardápio com `ativo = false` (PRD 12). */
export async function definirProdutoAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from("produtos").update({ ativo }).eq("id", id);
  if (error) throw error;
}

export async function definirProdutoDisponivel(id: string, disponivel: boolean): Promise<void> {
  const { error } = await supabase.from("produtos").update({ disponivel }).eq("id", id);
  if (error) throw error;
}

/**
 * A cópia entra inativa e sem código, porque o código é único por empresa e a
 * intenção de quem duplica é ajustar o item antes de publicá-lo.
 */
export async function duplicarProduto(produtoId: string): Promise<string> {
  const { data, error } = await supabase.rpc("duplicar_produto", { p_produto: produtoId });
  if (error) throw error;
  return data;
}

export async function enviarImagemProduto(
  empresaId: string,
  produtoId: string,
  arquivo: File,
): Promise<string> {
  const webp = await converterParaWebp(arquivo);
  const caminho = `${empresaId}/${produtoId}-${Date.now()}.webp`;

  const { error: erroUpload } = await supabase.storage
    .from(BUCKET_PRODUTOS)
    .upload(caminho, webp, { contentType: "image/webp", upsert: true });

  if (erroUpload) throw erroUpload;

  const { data } = supabase.storage.from(BUCKET_PRODUTOS).getPublicUrl(caminho);

  const { error } = await supabase
    .from("produtos")
    .update({ imagem_url: data.publicUrl })
    .eq("id", produtoId);

  if (error) throw error;
  return data.publicUrl;
}

export async function removerImagemProduto(produtoId: string): Promise<void> {
  const { error } = await supabase
    .from("produtos")
    .update({ imagem_url: null })
    .eq("id", produtoId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Grupos de adicionais
// ---------------------------------------------------------------------------

type LinhaGrupo = {
  id: string;
  nome: string;
  minimo: number;
  maximo: number;
  obrigatorio: boolean | null;
  ativo: boolean;
  opcoes_adicionais: {
    id: string;
    nome: string;
    preco: number;
    ordem: number;
    ativo: boolean;
  }[];
};

export async function listarGruposAdicionais(empresaId: string): Promise<GrupoAdicional[]> {
  const { data, error } = await supabase
    .from("grupos_adicionais")
    .select(
      `id, nome, minimo, maximo, obrigatorio, ativo,
       opcoes_adicionais (id, nome, preco, ordem, ativo)`,
    )
    .eq("empresa_id", empresaId)
    .order("nome")
    .returns<LinhaGrupo[]>();

  if (error) throw error;

  return (data ?? []).map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    minimo: linha.minimo,
    maximo: linha.maximo,
    obrigatorio: linha.obrigatorio ?? linha.minimo >= 1,
    ativo: linha.ativo,
    opcoes: [...linha.opcoes_adicionais]
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
      .map((opcao) => ({ ...opcao, preco: Number(opcao.preco) })),
  }));
}

export async function salvarGrupoAdicional(
  empresaId: string,
  entrada: { id?: string; nome: string; minimo: number; maximo: number },
): Promise<void> {
  // `obrigatorio` é coluna gerada a partir de `minimo`: não se envia.
  const valores = {
    nome: entrada.nome.trim(),
    minimo: entrada.minimo,
    maximo: entrada.maximo,
  };

  const { error } = entrada.id
    ? await supabase.from("grupos_adicionais").update(valores).eq("id", entrada.id)
    : await supabase.from("grupos_adicionais").insert({ empresa_id: empresaId, ...valores });

  if (error) throw error;
}

export async function definirGrupoAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from("grupos_adicionais").update({ ativo }).eq("id", id);
  if (error) throw error;
}

export async function excluirGrupoAdicional(id: string): Promise<void> {
  const { error } = await supabase.from("grupos_adicionais").delete().eq("id", id);
  if (error) throw error;
}

export async function salvarOpcaoAdicional(
  empresaId: string,
  grupoId: string,
  entrada: { id?: string; nome: string; preco: number; ordem: number },
): Promise<void> {
  const valores = { nome: entrada.nome.trim(), preco: entrada.preco, ordem: entrada.ordem };

  const { error } = entrada.id
    ? await supabase.from("opcoes_adicionais").update(valores).eq("id", entrada.id)
    : await supabase
        .from("opcoes_adicionais")
        .insert({ empresa_id: empresaId, grupo_id: grupoId, ...valores });

  if (error) throw error;
}

/** Itens já lançados guardam `nome_opcao`: renomear não altera o histórico. */
export async function renomearOpcaoAdicional(id: string, nome: string): Promise<void> {
  const { error } = await supabase
    .from("opcoes_adicionais")
    .update({ nome: nome.trim() })
    .eq("id", id);
  if (error) throw error;
}

export async function definirOpcaoAtiva(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from("opcoes_adicionais").update({ ativo }).eq("id", id);
  if (error) throw error;
}

/** Só funciona enquanto a opção não tiver sido vendida (FK com RESTRICT). */
export async function excluirOpcaoAdicional(id: string): Promise<void> {
  const { error } = await supabase.from("opcoes_adicionais").delete().eq("id", id);
  if (error) throw error;
}
