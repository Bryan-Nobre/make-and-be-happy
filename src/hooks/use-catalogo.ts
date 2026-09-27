import { useQuery } from "@tanstack/react-query";

import { chaves } from "@/lib/chaves";
import { ERRO } from "@/lib/erros";
import { useEmpresaAtual } from "@/providers/empresa";
import * as catalogo from "@/services/catalogo";

import { useMutacao } from "./use-mutacao";

export function useCategorias() {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.categorias(empresa.id),
    queryFn: () => catalogo.listarCategorias(empresa.id),
  });
}

export function useSetores() {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.setores(empresa.id),
    queryFn: () => catalogo.listarSetores(empresa.id),
  });
}

export function useProdutos() {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.produtos(empresa.id),
    queryFn: () => catalogo.listarProdutos(empresa.id),
  });
}

export function useGruposAdicionais() {
  const { empresa } = useEmpresaAtual();

  return useQuery({
    queryKey: chaves.gruposAdicionais(empresa.id),
    queryFn: () => catalogo.listarGruposAdicionais(empresa.id),
  });
}

export function useCategoriaMutations() {
  const { empresa } = useEmpresaAtual();
  const invalidar = [chaves.categorias(empresa.id), chaves.produtos(empresa.id)];

  const salvar = useMutacao({
    executar: (entrada: { id?: string; nome: string; ordem: number }) =>
      catalogo.salvarCategoria(empresa.id, entrada),
    sucesso: "Categoria salva.",
    erros: { [ERRO.duplicado]: "Já existe uma categoria com esse nome." },
    invalidar,
  });

  const alternarAtiva = useMutacao({
    executar: ({ id, ativa }: { id: string; ativa: boolean }) =>
      catalogo.definirCategoriaAtiva(id, ativa),
    invalidar,
  });

  const excluir = useMutacao({
    executar: (id: string) => catalogo.excluirCategoria(id),
    sucesso: "Categoria excluída.",
    erros: { [ERRO.emUso]: "Esta categoria tem produtos e não pode ser excluída." },
    invalidar,
  });

  return { salvar, alternarAtiva, excluir };
}

export function useSetorMutations() {
  const { empresa } = useEmpresaAtual();
  const invalidar = [chaves.setores(empresa.id), chaves.produtos(empresa.id)];

  const salvar = useMutacao({
    executar: (entrada: { id?: string; nome: string; ordem: number }) =>
      catalogo.salvarSetor(empresa.id, entrada),
    sucesso: "Setor salvo.",
    erros: { [ERRO.duplicado]: "Já existe um setor com esse nome." },
    invalidar,
  });

  const alternarAtivo = useMutacao({
    executar: ({ id, ativo }: { id: string; ativo: boolean }) =>
      catalogo.definirSetorAtivo(id, ativo),
    invalidar,
  });

  const excluir = useMutacao({
    executar: (id: string) => catalogo.excluirSetor(id),
    sucesso: "Setor excluído.",
    erros: { [ERRO.emUso]: "Este setor está vinculado a produtos e não pode ser excluído." },
    invalidar,
  });

  return { salvar, alternarAtivo, excluir };
}

export function useProdutoMutations() {
  const { empresa } = useEmpresaAtual();
  const invalidar = [chaves.produtos(empresa.id)];

  const salvar = useMutacao({
    executar: (entrada: catalogo.EntradaProduto) => catalogo.salvarProduto(empresa.id, entrada),
    sucesso: "Produto salvo.",
    erros: { [ERRO.duplicado]: "Este código já está em uso por outro produto." },
    invalidar,
  });

  const alternarAtivo = useMutacao({
    executar: ({ id, ativo }: { id: string; ativo: boolean }) =>
      catalogo.definirProdutoAtivo(id, ativo),
    invalidar,
  });

  const alternarDisponivel = useMutacao({
    executar: ({ id, disponivel }: { id: string; disponivel: boolean }) =>
      catalogo.definirProdutoDisponivel(id, disponivel),
    invalidar,
  });

  const duplicar = useMutacao({
    executar: (produto: catalogo.Produto) => catalogo.duplicarProduto(empresa.id, produto),
    sucesso: "Cópia criada como inativa. Ajuste e ative quando quiser.",
    invalidar,
  });

  const enviarImagem = useMutacao({
    executar: ({ produtoId, arquivo }: { produtoId: string; arquivo: File }) =>
      catalogo.enviarImagemProduto(empresa.id, produtoId, arquivo),
    sucesso: "Imagem atualizada.",
    invalidar,
  });

  const removerImagem = useMutacao({
    executar: (produtoId: string) => catalogo.removerImagemProduto(produtoId),
    sucesso: "Imagem removida.",
    invalidar,
  });

  return { salvar, alternarAtivo, alternarDisponivel, duplicar, enviarImagem, removerImagem };
}

export function useAdicionalMutations() {
  const { empresa } = useEmpresaAtual();
  const invalidar = [chaves.gruposAdicionais(empresa.id), chaves.produtos(empresa.id)];

  const salvarGrupo = useMutacao({
    executar: (entrada: { id?: string; nome: string; minimo: number; maximo: number }) =>
      catalogo.salvarGrupoAdicional(empresa.id, entrada),
    sucesso: "Grupo salvo.",
    erros: { [ERRO.duplicado]: "Já existe um grupo com esse nome." },
    invalidar,
  });

  const alternarGrupoAtivo = useMutacao({
    executar: ({ id, ativo }: { id: string; ativo: boolean }) =>
      catalogo.definirGrupoAtivo(id, ativo),
    invalidar,
  });

  const excluirGrupo = useMutacao({
    executar: (id: string) => catalogo.excluirGrupoAdicional(id),
    sucesso: "Grupo excluído.",
    invalidar,
  });

  const salvarOpcao = useMutacao({
    executar: ({
      grupoId,
      ...entrada
    }: {
      grupoId: string;
      id?: string;
      nome: string;
      preco: number;
      ordem: number;
    }) => catalogo.salvarOpcaoAdicional(empresa.id, grupoId, entrada),
    sucesso: "Opção salva.",
    invalidar,
  });

  const excluirOpcao = useMutacao({
    executar: (id: string) => catalogo.excluirOpcaoAdicional(id),
    invalidar,
  });

  return {
    salvarGrupo,
    alternarGrupoAtivo,
    excluirGrupo,
    salvarOpcao,
    excluirOpcao,
  };
}
