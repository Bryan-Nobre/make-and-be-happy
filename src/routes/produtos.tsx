import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Copy, ImageOff, Package, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { DialogoFichaTecnica } from "@/components/shared/dialogo-ficha-tecnica";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { MoneyInput } from "@/components/shared/money-input";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdicionalMutations,
  useCategoriaMutations,
  useCategorias,
  useGruposAdicionais,
  useProdutoMutations,
  useProdutos,
  useSetorMutations,
  useSetores,
} from "@/hooks/use-catalogo";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Categoria, GrupoAdicional, Produto, Setor } from "@/services/catalogo";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — ARVON FOOD" },
      { name: "description", content: "Cardápio, categorias e grupos de adicionais." },
      { property: "og:title", content: "Produtos — ARVON FOOD" },
      { property: "og:description", content: "Cardápio, categorias e grupos de adicionais." },
    ],
  }),
  component: () => (
    <AppLayout module="produtos">
      <Produtos />
    </AppLayout>
  ),
});

type Formulario = {
  id?: string;
  nome: string;
  codigo: string;
  preco: number;
  descricao: string;
  categoriaId: string;
  setorId: string;
  grupoIds: string[];
};

function Produtos() {
  const produtos = useProdutos();
  const categorias = useCategorias();
  const setores = useSetores();
  const grupos = useGruposAdicionais();

  const carregando =
    produtos.isPending || categorias.isPending || setores.isPending || grupos.isPending;
  const erro = produtos.error ?? categorias.error ?? setores.error ?? grupos.error;

  return (
    <div className="space-y-6">
      <PageHeader title="Produtos" description="Gerencie o cardápio." />

      {erro ? (
        <ErrorState
          description="Não foi possível carregar o cardápio."
          onRetry={() => {
            void produtos.refetch();
            void categorias.refetch();
            void setores.refetch();
            void grupos.refetch();
          }}
        />
      ) : carregando ? (
        <LoadingState label="Carregando cardápio…" />
      ) : (
        <Tabs defaultValue="produtos">
          <TabsList>
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="adicionais">Adicionais</TabsTrigger>
            <TabsTrigger value="setores">Setores</TabsTrigger>
          </TabsList>

          <TabsContent value="produtos">
            <AbaProdutos
              produtos={produtos.data ?? []}
              categorias={categorias.data ?? []}
              setores={setores.data ?? []}
              grupos={grupos.data ?? []}
            />
          </TabsContent>
          <TabsContent value="categorias">
            <AbaCategorias categorias={categorias.data ?? []} produtos={produtos.data ?? []} />
          </TabsContent>
          <TabsContent value="adicionais">
            <AbaAdicionais grupos={grupos.data ?? []} />
          </TabsContent>
          <TabsContent value="setores">
            <AbaSetores setores={setores.data ?? []} produtos={produtos.data ?? []} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------

function AbaProdutos({
  produtos,
  categorias,
  setores,
  grupos,
}: {
  produtos: Produto[];
  categorias: Categoria[];
  setores: Setor[];
  grupos: GrupoAdicional[];
}) {
  const { salvar, alternarAtivo, alternarDisponivel, duplicar, enviarImagem, removerImagem } =
    useProdutoMutations();
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<Formulario | null>(null);
  const seletorImagem = useRef<HTMLInputElement>(null);
  const [produtoDaImagem, setProdutoDaImagem] = useState<string | null>(null);
  const [produtoDaFicha, setProdutoDaFicha] = useState<{ id: string; nome: string } | null>(null);

  const categoriaDe = (p: Produto) => categorias.find((c) => c.id === p.categoriaId);
  const setorDe = (p: Produto) => setores.find((s) => s.id === p.setorId);

  const termo = busca.trim().toLowerCase();
  const lista = produtos.filter(
    (p) => p.nome.toLowerCase().includes(termo) || p.codigo.toLowerCase().includes(termo),
  );

  const novo = (): Formulario => ({
    nome: "",
    codigo: "",
    preco: 0,
    descricao: "",
    categoriaId: categorias[0]?.id ?? "",
    setorId: setores[0]?.id ?? "",
    grupoIds: [],
  });

  const editar = (produto: Produto): Formulario => ({
    id: produto.id,
    nome: produto.nome,
    codigo: produto.codigo,
    preco: produto.preco,
    descricao: produto.descricao,
    categoriaId: produto.categoriaId,
    setorId: produto.setorId ?? "",
    grupoIds: produto.grupoIds,
  });

  if (categorias.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Crie uma categoria primeiro"
        description="Todo produto pertence a uma categoria. Use a aba Categorias para criar a primeira."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="h-11 max-w-sm"
          placeholder="Buscar por nome ou código"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Button className="h-11" onClick={() => setForm(novo())}>
          <Plus className="size-4" />
          Novo produto
        </Button>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum produto"
          description="Ajuste a busca ou cadastre o primeiro item do cardápio."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Nome</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Setor</th>
                <th className="p-3 text-right">Preço</th>
                <th className="p-3">No cardápio</th>
                <th className="p-3">Disponível</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {lista.map((produto) => (
                <tr key={produto.id} className={produto.ativo ? "" : "opacity-60"}>
                  <td className="p-3 text-muted-foreground">{produto.codigo || "—"}</td>
                  <td className="p-3 font-medium">{produto.nome}</td>
                  <td className="p-3">
                    {categoriaDe(produto)?.nome ?? "—"}
                    {categoriaDe(produto)?.ativa === false && (
                      <StatusBadge tone="danger" className="ml-2">
                        Inativa
                      </StatusBadge>
                    )}
                  </td>
                  <td className="p-3">
                    {setorDe(produto)?.nome ?? "—"}
                    {setorDe(produto)?.ativo === false && (
                      <StatusBadge tone="danger" className="ml-2">
                        Inativo
                      </StatusBadge>
                    )}
                  </td>
                  <td className="p-3 text-right tabular-nums">{brl(produto.preco)}</td>
                  <td className="p-3">
                    <Switch
                      checked={produto.ativo}
                      onCheckedChange={(ativo) => alternarAtivo.mutate({ id: produto.id, ativo })}
                      aria-label={`${produto.nome} no cardápio`}
                    />
                  </td>
                  <td className="p-3">
                    <Switch
                      checked={produto.disponivel}
                      disabled={!produto.ativo}
                      onCheckedChange={(disponivel) =>
                        alternarDisponivel.mutate({ id: produto.id, disponivel })
                      }
                      aria-label={`${produto.nome} disponível para venda`}
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setProdutoDaImagem(produto.id);
                          seletorImagem.current?.click();
                        }}
                        aria-label={`Enviar imagem de ${produto.nome}`}
                      >
                        <Upload className="size-4" />
                      </Button>
                      {produto.imagemUrl && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removerImagem.mutate(produto.id)}
                          aria-label={`Remover imagem de ${produto.nome}`}
                        >
                          <ImageOff className="size-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setForm(editar(produto))}
                        aria-label={`Editar ${produto.nome}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setProdutoDaFicha({ id: produto.id, nome: produto.nome })}
                        aria-label={`Ficha técnica de ${produto.nome}`}
                        title="Ficha técnica"
                      >
                        <ClipboardList className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => duplicar.mutate(produto)}
                        aria-label={`Duplicar ${produto.nome}`}
                      >
                        <Copy className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <input
        ref={seletorImagem}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = "";
          if (arquivo && produtoDaImagem) {
            enviarImagem.mutate({ produtoId: produtoDaImagem, arquivo });
          }
        }}
      />

      <DialogoFichaTecnica produto={produtoDaFicha} aoFechar={() => setProdutoDaFicha(null)} />

      <Dialog open={form !== null} onOpenChange={(aberto) => !aberto && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar produto" : "Novo produto"}</DialogTitle>
            <DialogDescription>
              O preço aqui vale para as próximas vendas. Pedidos já lançados mantêm o preço do
              momento em que foram feitos.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label htmlFor="produto-nome">Nome</Label>
                <Input
                  id="produto-nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label htmlFor="produto-codigo">Código</Label>
                  <Input
                    id="produto-codigo"
                    placeholder="Opcional"
                    value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="produto-preco">Preço</Label>
                  <MoneyInput
                    id="produto-preco"
                    value={form.preco}
                    onChange={(preco) => setForm({ ...form, preco })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label htmlFor="produto-categoria">Categoria</Label>
                  <select
                    id="produto-categoria"
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={form.categoriaId}
                    onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
                  >
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="produto-setor">Setor de produção</Label>
                  <select
                    id="produto-setor"
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={form.setorId}
                    onChange={(e) => setForm({ ...form, setorId: e.target.value })}
                  >
                    <option value="">Não envia para a cozinha</option>
                    {setores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-1">
                <Label htmlFor="produto-descricao">Descrição</Label>
                <Textarea
                  id="produto-descricao"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>

              {grupos.length > 0 && (
                <fieldset className="grid gap-2 rounded-md border p-3">
                  <legend className="px-1 text-sm font-medium">Grupos de adicionais</legend>
                  {grupos.map((grupo) => (
                    <label key={grupo.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.grupoIds.includes(grupo.id)}
                        onCheckedChange={(marcado) =>
                          setForm({
                            ...form,
                            grupoIds: marcado
                              ? [...form.grupoIds, grupo.id]
                              : form.grupoIds.filter((id) => id !== grupo.id),
                          })
                        }
                      />
                      {grupo.nome}
                      <span className="text-muted-foreground">
                        ({grupo.obrigatorio ? "obrigatório" : "opcional"} · {grupo.minimo}–
                        {grupo.maximo})
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button
              disabled={salvar.isPending || !form || form.nome.trim().length < 2 || form.preco <= 0}
              onClick={() => {
                if (!form) return;
                salvar.mutate(
                  {
                    ...form,
                    setorId: form.setorId || null,
                  },
                  { onSuccess: () => setForm(null) },
                );
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

function AbaCategorias({ categorias, produtos }: { categorias: Categoria[]; produtos: Produto[] }) {
  const { salvar, renomear, alternarAtiva, excluir } = useCategoriaMutations();
  const [nome, setNome] = useState("");
  const [renomeando, setRenomeando] = useState<Categoria | null>(null);

  return (
    <div className="space-y-3">
      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (nome.trim().length === 0) return;
          salvar.mutate({ nome, ordem: categorias.length + 1 }, { onSuccess: () => setNome("") });
        }}
      >
        <Input
          placeholder="Nova categoria"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-label="Nome da nova categoria"
        />
        <Button type="submit" disabled={salvar.isPending}>
          Adicionar
        </Button>
      </form>

      <ul className="divide-y rounded-lg border bg-card">
        {categorias.map((categoria) => {
          const usos = produtos.filter((p) => p.categoriaId === categoria.id).length;

          return (
            <li key={categoria.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span className="font-medium">{categoria.nome}</span>
              <span className="flex items-center gap-3 text-muted-foreground">
                {usos} {usos === 1 ? "produto" : "produtos"}
                <Switch
                  checked={categoria.ativa}
                  onCheckedChange={(ativa) => alternarAtiva.mutate({ id: categoria.id, ativa })}
                  aria-label={`Categoria ${categoria.nome} ativa`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setRenomeando(categoria)}
                  aria-label={`Renomear ${categoria.nome}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={usos > 0}
                  onClick={() => excluir.mutate(categoria.id)}
                  aria-label={`Excluir ${categoria.nome}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </span>
            </li>
          );
        })}
      </ul>

      <DialogoRenomear
        titulo="Renomear categoria"
        descricao="O novo nome vale para todos os produtos desta categoria."
        nomeAtual={renomeando?.nome ?? null}
        maximo={60}
        salvando={renomear.isPending}
        aoFechar={() => setRenomeando(null)}
        aoSalvar={(novoNome) =>
          renomeando &&
          renomear.mutate(
            { id: renomeando.id, nome: novoNome },
            { onSuccess: () => setRenomeando(null) },
          )
        }
      />
    </div>
  );
}

function DialogoRenomear({
  titulo,
  descricao,
  nomeAtual,
  maximo,
  salvando,
  aoFechar,
  aoSalvar,
}: {
  titulo: string;
  descricao?: string;
  nomeAtual: string | null;
  maximo: number;
  salvando: boolean;
  aoFechar: () => void;
  aoSalvar: (nome: string) => void;
}) {
  return (
    <Dialog open={nomeAtual !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {descricao ?? "Pedidos já lançados continuam com o nome antigo."}
          </DialogDescription>
        </DialogHeader>
        {nomeAtual !== null && (
          <FormularioRenomear
            nomeAtual={nomeAtual}
            maximo={maximo}
            salvando={salvando}
            aoFechar={aoFechar}
            aoSalvar={aoSalvar}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormularioRenomear({
  nomeAtual,
  maximo,
  salvando,
  aoFechar,
  aoSalvar,
}: {
  nomeAtual: string;
  maximo: number;
  salvando: boolean;
  aoFechar: () => void;
  aoSalvar: (nome: string) => void;
}) {
  const [nome, setNome] = useState(nomeAtual);
  const limpo = nome.trim();
  const valido = limpo.length > 0 && limpo !== nomeAtual;

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valido) aoSalvar(limpo);
      }}
    >
      <div className="grid gap-1">
        <Label htmlFor="renomear-nome">Nome</Label>
        <Input
          id="renomear-nome"
          value={nome}
          maxLength={maximo}
          autoFocus
          onChange={(e) => setNome(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={aoFechar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!valido || salvando}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Setores
// ---------------------------------------------------------------------------

function AbaSetores({ setores, produtos }: { setores: Setor[]; produtos: Produto[] }) {
  const { salvar, renomear, alternarAtivo, excluir } = useSetorMutations();
  const [nome, setNome] = useState("");
  const [renomeando, setRenomeando] = useState<Setor | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        O setor define em qual tela da cozinha o item aparece.
      </p>

      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (nome.trim().length === 0) return;
          salvar.mutate({ nome, ordem: setores.length + 1 }, { onSuccess: () => setNome("") });
        }}
      >
        <Input
          placeholder="Novo setor (ex.: Bar, Chapa, Pizza)"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-label="Nome do novo setor"
        />
        <Button type="submit" disabled={salvar.isPending}>
          Adicionar
        </Button>
      </form>

      <ul className="divide-y rounded-lg border bg-card">
        {setores.map((setor) => {
          const usos = produtos.filter((p) => p.setorId === setor.id).length;

          return (
            <li key={setor.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span className="font-medium">{setor.nome}</span>
              <span className="flex items-center gap-3 text-muted-foreground">
                {usos} {usos === 1 ? "produto" : "produtos"}
                <Switch
                  checked={setor.ativo}
                  onCheckedChange={(ativo) => alternarAtivo.mutate({ id: setor.id, ativo })}
                  aria-label={`Setor ${setor.nome} ativo`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setRenomeando(setor)}
                  aria-label={`Renomear ${setor.nome}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={usos > 0}
                  onClick={() => excluir.mutate(setor.id)}
                  aria-label={`Excluir ${setor.nome}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </span>
            </li>
          );
        })}
      </ul>

      <DialogoRenomear
        titulo="Renomear setor"
        nomeAtual={renomeando?.nome ?? null}
        maximo={40}
        salvando={renomear.isPending}
        aoFechar={() => setRenomeando(null)}
        aoSalvar={(novoNome) =>
          renomeando &&
          renomear.mutate(
            { id: renomeando.id, nome: novoNome },
            { onSuccess: () => setRenomeando(null) },
          )
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Adicionais
// ---------------------------------------------------------------------------

function AbaAdicionais({ grupos }: { grupos: GrupoAdicional[] }) {
  const { salvarGrupo, alternarGrupoAtivo, excluirGrupo } = useAdicionalMutations();
  const [form, setForm] = useState<{
    id?: string;
    nome: string;
    minimo: number;
    maximo: number;
  } | null>(null);

  return (
    <div className="space-y-3">
      <Button onClick={() => setForm({ nome: "", minimo: 0, maximo: 1 })}>
        <Plus className="size-4" />
        Novo grupo
      </Button>

      {grupos.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum grupo de adicionais"
          description="Grupos servem para ponto da carne, acompanhamentos, extras e afins."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {grupos.map((grupo) => (
            <CartaoGrupo
              key={grupo.id}
              grupo={grupo}
              onEditar={() =>
                setForm({
                  id: grupo.id,
                  nome: grupo.nome,
                  minimo: grupo.minimo,
                  maximo: grupo.maximo,
                })
              }
              onAlternar={(ativo) => alternarGrupoAtivo.mutate({ id: grupo.id, ativo })}
              onExcluir={() => excluirGrupo.mutate(grupo.id)}
            />
          ))}
        </div>
      )}

      <Dialog open={form !== null} onOpenChange={(aberto) => !aberto && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar grupo" : "Novo grupo"}</DialogTitle>
            <DialogDescription>
              Mínimo 1 ou mais torna o grupo obrigatório na hora do pedido.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label htmlFor="grupo-nome">Nome</Label>
                <Input
                  id="grupo-nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label htmlFor="grupo-minimo">Mínimo</Label>
                  <Input
                    id="grupo-minimo"
                    type="number"
                    min={0}
                    max={form.maximo}
                    value={form.minimo}
                    onChange={(e) => setForm({ ...form, minimo: Number(e.target.value) })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="grupo-maximo">Máximo</Label>
                  <Input
                    id="grupo-maximo"
                    type="number"
                    min={1}
                    value={form.maximo}
                    onChange={(e) => setForm({ ...form, maximo: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                salvarGrupo.isPending ||
                !form ||
                form.nome.trim().length === 0 ||
                form.minimo > form.maximo
              }
              onClick={() => {
                if (!form) return;
                salvarGrupo.mutate(form, { onSuccess: () => setForm(null) });
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CartaoGrupo({
  grupo,
  onEditar,
  onAlternar,
  onExcluir,
}: {
  grupo: GrupoAdicional;
  onEditar: () => void;
  onAlternar: (ativo: boolean) => void;
  onExcluir: () => void;
}) {
  const { salvarOpcao, renomearOpcao, alternarOpcaoAtiva, excluirOpcao } = useAdicionalMutations();
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState(0);
  const [renomeando, setRenomeando] = useState<{ id: string; nome: string } | null>(null);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{grupo.nome}</h3>
          <StatusBadge tone={grupo.obrigatorio ? "warning" : "neutral"} className="mt-1">
            {grupo.obrigatorio ? "Obrigatório" : "Opcional"} · {grupo.minimo}–{grupo.maximo}
          </StatusBadge>
        </div>
        <div className="flex items-center gap-1">
          <Switch
            checked={grupo.ativo}
            onCheckedChange={onAlternar}
            aria-label={`Grupo ${grupo.nome} ativo`}
          />
          <Button size="icon" variant="ghost" onClick={onEditar} aria-label="Editar grupo">
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onExcluir}
            aria-label={`Excluir grupo ${grupo.nome}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <ul className="mt-3 divide-y text-sm">
        {grupo.opcoes.length === 0 && (
          <li className="py-1 text-muted-foreground">Nenhuma opção cadastrada.</li>
        )}
        {grupo.opcoes.map((opcao) => (
          <li key={opcao.id} className="flex items-center justify-between gap-2 py-1">
            <span className={cn(!opcao.ativo && "text-muted-foreground line-through")}>
              {opcao.nome}
            </span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums text-muted-foreground">{brl(opcao.preco)}</span>
              <Switch
                checked={opcao.ativo}
                onCheckedChange={(ativo) => alternarOpcaoAtiva.mutate({ id: opcao.id, ativo })}
                aria-label={`Opção ${opcao.nome} ativa`}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setRenomeando({ id: opcao.id, nome: opcao.nome })}
                aria-label={`Renomear ${opcao.nome}`}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => excluirOpcao.mutate(opcao.id)}
                aria-label={`Excluir ${opcao.nome}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </span>
          </li>
        ))}
      </ul>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (nome.trim().length === 0) return;
          salvarOpcao.mutate(
            { grupoId: grupo.id, nome, preco, ordem: grupo.opcoes.length + 1 },
            {
              onSuccess: () => {
                setNome("");
                setPreco(0);
              },
            },
          );
        }}
      >
        <Input
          className="h-9"
          placeholder="Nova opção"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-label={`Nova opção em ${grupo.nome}`}
        />
        <div className="w-28">
          <MoneyInput value={preco} onChange={setPreco} />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={salvarOpcao.isPending}>
          Add
        </Button>
      </form>

      <DialogoRenomear
        titulo="Renomear opção"
        nomeAtual={renomeando?.nome ?? null}
        maximo={60}
        salvando={renomearOpcao.isPending}
        aoFechar={() => setRenomeando(null)}
        aoSalvar={(novoNome) =>
          renomeando &&
          renomearOpcao.mutate(
            { id: renomeando.id, nome: novoNome },
            { onSuccess: () => setRenomeando(null) },
          )
        }
      />
    </div>
  );
}
