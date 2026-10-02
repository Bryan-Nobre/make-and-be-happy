import { createFileRoute } from "@tanstack/react-router";
import {
  ClipboardList,
  Copy,
  ImageOff,
  ImagePlus,
  LayoutGrid,
  Loader2,
  List,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
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
import { iconeDaCategoria } from "@/lib/icone-categoria";
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
      <PageHeader
        title="Produtos"
        description="Cardápio, categorias, adicionais e setores de produção."
      />

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
        <Tabs defaultValue="produtos" className="gap-5">
          <TabsList className="max-w-full overflow-x-auto">
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
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

type Visao = "grade" | "lista";
type FiltroDisponibilidade = "todos" | "disponiveis" | "indisponiveis" | "fora";

const FILTROS_DISPONIBILIDADE: { id: FiltroDisponibilidade; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos os produtos" },
  { id: "disponiveis", rotulo: "Disponíveis" },
  { id: "indisponiveis", rotulo: "Indisponíveis" },
  { id: "fora", rotulo: "Fora do cardápio" },
];

const passaNoFiltro = (p: Produto, filtro: FiltroDisponibilidade) =>
  filtro === "todos" ||
  (filtro === "disponiveis" && p.ativo && p.disponivel) ||
  (filtro === "indisponiveis" && p.ativo && !p.disponivel) ||
  (filtro === "fora" && !p.ativo);

type AcoesProduto = {
  editar: (p: Produto) => void;
  fichaTecnica: (p: Produto) => void;
  duplicar: (p: Produto) => void;
  enviarImagem: (p: Produto) => void;
  removerImagem: (p: Produto) => void;
  alternarAtivo: (p: Produto, ativo: boolean) => void;
  alternarDisponivel: (p: Produto, disponivel: boolean) => void;
};

/** URL temporária para pré-visualizar um arquivo local, liberada ao trocar ou desmontar. */
function useUrlDoArquivo(arquivo: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!arquivo) {
      setUrl(null);
      return;
    }
    const criada = URL.createObjectURL(arquivo);
    setUrl(criada);
    return () => URL.revokeObjectURL(criada);
  }, [arquivo]);
  return url;
}

function situacaoDo(produto: Produto) {
  if (!produto.ativo) return { rotulo: "Fora do cardápio", ponto: "bg-muted-foreground/50" };
  return produto.disponivel
    ? { rotulo: "Disponível", ponto: "bg-success" }
    : { rotulo: "Indisponível", ponto: "bg-warning" };
}

function MiniaturaProduto({ produto, categoria }: { produto: Produto; categoria?: Categoria }) {
  const Icone = iconeDaCategoria(categoria?.nome ?? "");
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
      {produto.imagemUrl ? (
        <img src={produto.imagemUrl} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <Icone className="size-4 text-muted-foreground/60" aria-hidden="true" />
      )}
    </span>
  );
}

function MenuProduto({
  produto,
  acoes,
  comAlternancias = true,
  className,
}: {
  produto: Produto;
  acoes: AcoesProduto;
  comAlternancias?: boolean;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Ações de ${produto.nome}`}
          className={cn(
            "inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            className,
          )}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => acoes.editar(produto)}>
          <Pencil className="size-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => acoes.fichaTecnica(produto)}>
          <ClipboardList className="size-4" />
          Ficha técnica
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => acoes.duplicar(produto)}>
          <Copy className="size-4" />
          Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => acoes.enviarImagem(produto)}>
          <Upload className="size-4" />
          {produto.imagemUrl ? "Trocar imagem" : "Enviar imagem"}
        </DropdownMenuItem>
        {produto.imagemUrl && (
          <DropdownMenuItem onSelect={() => acoes.removerImagem(produto)}>
            <ImageOff className="size-4" />
            Remover imagem
          </DropdownMenuItem>
        )}
        {comAlternancias && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={produto.ativo}
              onCheckedChange={(ativo) => acoes.alternarAtivo(produto, ativo)}
            >
              No cardápio
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={produto.disponivel}
              disabled={!produto.ativo}
              onCheckedChange={(disponivel) => acoes.alternarDisponivel(produto, disponivel)}
            >
              Disponível para venda
            </DropdownMenuCheckboxItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CartaoProduto({
  produto,
  categoria,
  acoes,
  enviandoFoto = false,
}: {
  produto: Produto;
  categoria?: Categoria;
  acoes: AcoesProduto;
  enviandoFoto?: boolean;
}) {
  const Icone = iconeDaCategoria(categoria?.nome ?? "");
  const situacao = situacaoDo(produto);

  return (
    <article
      className={cn(
        "relative flex flex-col rounded-xl border border-border bg-card p-3 shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-primary/30 hover:shadow-sm",
        !produto.ativo && "opacity-70",
      )}
    >
      <button
        type="button"
        onClick={() => acoes.editar(produto)}
        aria-label={`Editar ${produto.nome}`}
        className="absolute inset-0 z-[1] cursor-pointer rounded-xl focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      />
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-muted/60">
        {produto.imagemUrl ? (
          <img src={produto.imagemUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <Icone className="size-9 text-muted-foreground/35" aria-hidden="true" />
        )}
        {enviandoFoto && (
          <span
            role="status"
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-card/80 text-xs font-medium text-muted-foreground"
          >
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            Enviando foto…
          </span>
        )}
      </div>
      <MenuProduto produto={produto} acoes={acoes} className="absolute top-5 right-5 z-10" />

      <div className="mt-3 flex flex-1 flex-col px-0.5">
        <p className="truncate text-xs text-muted-foreground">
          {categoria?.nome ?? "—"}
          {produto.codigo && ` · ${produto.codigo}`}
        </p>
        <h3 className="mt-0.5 line-clamp-1 text-sm font-semibold text-foreground">
          {produto.nome}
        </h3>
        {produto.descricao.trim() && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{produto.descricao}</p>
        )}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-1 pt-3">
          <span className="text-base font-bold text-foreground tabular-nums">
            {brl(produto.preco)}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", situacao.ponto)} />
            {situacao.rotulo}
          </span>
        </div>
      </div>
    </article>
  );
}

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
  const {
    salvar: salvarCategoria,
    renomear: renomearCategoria,
    alternarAtiva: alternarCategoriaAtiva,
    excluir: excluirCategoria,
  } = useCategoriaMutations();
  const [renomeandoCategoria, setRenomeandoCategoria] = useState<Categoria | null>(null);
  const [busca, setBusca] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [visao, setVisao] = useState<Visao>("grade");
  const [filtro, setFiltro] = useState<FiltroDisponibilidade>("todos");
  const [criandoCategoria, setCriandoCategoria] = useState(false);
  const [form, setForm] = useState<Formulario | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const previaFoto = useUrlDoArquivo(foto);
  const seletorImagem = useRef<HTMLInputElement>(null);
  const seletorFotoDoFormulario = useRef<HTMLInputElement>(null);

  const abrirFormulario = (dados: Formulario) => {
    setFoto(null);
    setForm(dados);
  };
  const imagemAtual = produtos.find((p) => p.id === form?.id)?.imagemUrl ?? null;
  const [produtoDaImagem, setProdutoDaImagem] = useState<string | null>(null);
  const [produtoDaFicha, setProdutoDaFicha] = useState<{ id: string; nome: string } | null>(null);

  const categoriaDe = (p: Produto) => categorias.find((c) => c.id === p.categoriaId);
  const setorDe = (p: Produto) => setores.find((s) => s.id === p.setorId);
  const categoriaSelecionada = categorias.find((c) => c.id === categoriaId) ?? null;
  const quantidadeNa = (id: string) => produtos.filter((p) => p.categoriaId === id).length;

  const termo = busca.trim().toLowerCase();
  const lista = produtos.filter(
    (p) =>
      (!categoriaSelecionada || p.categoriaId === categoriaSelecionada.id) &&
      passaNoFiltro(p, filtro) &&
      (p.nome.toLowerCase().includes(termo) || p.codigo.toLowerCase().includes(termo)),
  );
  const refinando = termo !== "" || filtro !== "todos";

  const novo = (): Formulario => ({
    nome: "",
    codigo: "",
    preco: 0,
    descricao: "",
    categoriaId: categoriaSelecionada?.id ?? categorias[0]?.id ?? "",
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

  const acoes: AcoesProduto = {
    editar: (p) => abrirFormulario(editar(p)),
    fichaTecnica: (p) => setProdutoDaFicha({ id: p.id, nome: p.nome }),
    duplicar: (p) => duplicar.mutate(p),
    enviarImagem: (p) => {
      setProdutoDaImagem(p.id);
      seletorImagem.current?.click();
    },
    removerImagem: (p) => removerImagem.mutate(p.id),
    alternarAtivo: (p, ativo) => alternarAtivo.mutate({ id: p.id, ativo }),
    alternarDisponivel: (p, disponivel) => alternarDisponivel.mutate({ id: p.id, disponivel }),
  };

  const dialogoCategoria = (
    <DialogoRenomear
      titulo="Nova categoria"
      descricao="Todo produto pertence a uma categoria do cardápio."
      nomeAtual={criandoCategoria ? "" : null}
      maximo={60}
      salvando={salvarCategoria.isPending}
      aoFechar={() => setCriandoCategoria(false)}
      aoSalvar={(nome) =>
        salvarCategoria.mutate(
          { nome, ordem: categorias.length + 1 },
          { onSuccess: () => setCriandoCategoria(false) },
        )
      }
    />
  );

  if (categorias.length === 0) {
    return (
      <>
        <EmptyState
          icon={Package}
          title="Crie uma categoria primeiro"
          description="Todo produto pertence a uma categoria."
          action={
            <Button onClick={() => setCriandoCategoria(true)}>
              <Plus className="size-4" />
              Nova categoria
            </Button>
          }
        />
        {dialogoCategoria}
      </>
    );
  }

  const opcoesCategoria = [
    { id: null, nome: "Todos", quantidade: produtos.length, ativa: true },
    ...categorias.map((c) => ({
      id: c.id,
      nome: c.nome,
      quantidade: quantidadeNa(c.id),
      ativa: c.ativa,
    })),
  ];

  return (
    <div className="grid items-start gap-5 md:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside
        aria-label="Categorias"
        className="hidden flex-col rounded-xl border border-border bg-card p-3 shadow-xs md:sticky md:top-20 md:flex md:max-h-[calc(100dvh-7rem)]"
      >
        <h2 className="px-2 pt-1 pb-3 text-base font-semibold text-foreground">Categorias</h2>
        <nav className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1 pb-1">
          {opcoesCategoria.map((c) => {
            const ativo = categoriaSelecionada?.id === c.id || (!categoriaSelecionada && !c.id);
            const Icone = c.id ? iconeDaCategoria(c.nome) : LayoutGrid;
            return (
              <button
                key={c.id ?? "todos"}
                type="button"
                aria-pressed={ativo}
                onClick={() => setCategoriaId(c.id)}
                className={cn(
                  "flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg border px-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                  ativo
                    ? "border-primary/40 bg-primary-soft font-semibold text-primary-strong"
                    : "border-transparent text-foreground hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md",
                    ativo ? "bg-card" : "bg-muted",
                  )}
                >
                  <Icone className="size-4" aria-hidden="true" />
                </span>
                <span
                  className={cn("min-w-0 flex-1 truncate", !c.ativa && "text-muted-foreground")}
                >
                  {c.nome}
                  {!c.ativa && <span className="sr-only"> (inativa)</span>}
                </span>
                <span
                  className={cn(
                    "flex h-5 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums",
                    ativo ? "bg-card text-primary-strong" : "bg-muted text-muted-foreground",
                  )}
                >
                  {c.quantidade}
                </span>
              </button>
            );
          })}
        </nav>
        <Button variant="outline" className="mt-3 w-full" onClick={() => setCriandoCategoria(true)}>
          <Plus className="size-4" />
          Nova categoria
        </Button>
      </aside>

      <div className="min-w-0 space-y-4">
        <div
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden"
          role="group"
          aria-label="Categorias"
        >
          {opcoesCategoria.map((c) => {
            const ativo = categoriaSelecionada?.id === c.id || (!categoriaSelecionada && !c.id);
            return (
              <button
                key={c.id ?? "todos"}
                type="button"
                aria-pressed={ativo}
                onClick={() => setCategoriaId(c.id)}
                className={cn(
                  "flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
                  ativo
                    ? "border-primary/30 bg-primary-soft text-primary-strong"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {c.nome}
                <span className="text-xs tabular-nums opacity-80">{c.quantidade}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setCriandoCategoria(true)}
            className="flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-dashed border-border px-3.5 text-sm font-medium whitespace-nowrap text-muted-foreground"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Categoria
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              placeholder="Buscar produto..."
              aria-label="Buscar produto por nome ou código"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <div
              className="flex rounded-lg border border-border bg-card p-0.5"
              role="group"
              aria-label="Visualização"
            >
              {(
                [
                  { id: "grade", rotulo: "Grade", Icone: LayoutGrid },
                  { id: "lista", rotulo: "Lista", Icone: List },
                ] as const
              ).map(({ id, rotulo, Icone }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={visao === id}
                  aria-label={rotulo}
                  title={rotulo}
                  onClick={() => setVisao(id)}
                  className={cn(
                    "flex size-8.5 cursor-pointer items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                    visao === id
                      ? "bg-primary-soft text-primary-strong"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icone className="size-4" aria-hidden="true" />
                </button>
              ))}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="relative">
                  <SlidersHorizontal className="size-4" />
                  Filtros
                  {filtro !== "todos" && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-card bg-primary"
                    />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Mostrar</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={filtro}
                  onValueChange={(v) => setFiltro(v as FiltroDisponibilidade)}
                >
                  {FILTROS_DISPONIBILIDADE.map((f) => (
                    <DropdownMenuRadioItem key={f.id} value={f.id}>
                      {f.rotulo}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button className="flex-1 sm:flex-none" onClick={() => abrirFormulario(novo())}>
              <Plus className="size-4" />
              Novo produto
            </Button>
          </div>
        </div>

        <section
          aria-label={categoriaSelecionada?.nome ?? "Todos os produtos"}
          className="rounded-xl bg-muted/40 p-3 sm:p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-2 px-1">
            <h2 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold text-foreground">
              <span className="truncate">{categoriaSelecionada?.nome ?? "Todos os produtos"}</span>
              <span className="text-sm font-normal text-muted-foreground tabular-nums">
                ({lista.length})
              </span>
              {categoriaSelecionada && !categoriaSelecionada.ativa && (
                <StatusBadge tone="neutral" className="self-center">
                  Inativa
                </StatusBadge>
              )}
            </h2>
            {categoriaSelecionada && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Ações da categoria ${categoriaSelecionada.nome}`}
                    className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <MoreHorizontal className="size-4" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onSelect={() => setRenomeandoCategoria(categoriaSelecionada)}>
                    <Pencil className="size-4" />
                    Renomear categoria
                  </DropdownMenuItem>
                  <DropdownMenuCheckboxItem
                    checked={categoriaSelecionada.ativa}
                    onCheckedChange={(ativa) =>
                      alternarCategoriaAtiva.mutate({ id: categoriaSelecionada.id, ativa })
                    }
                  >
                    Categoria ativa
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={quantidadeNa(categoriaSelecionada.id) > 0}
                    onSelect={() =>
                      excluirCategoria.mutate(categoriaSelecionada.id, {
                        onSuccess: () => setCategoriaId(null),
                      })
                    }
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    Excluir categoria
                  </DropdownMenuItem>
                  {quantidadeNa(categoriaSelecionada.id) > 0 && (
                    <p className="px-2 pb-1.5 text-xs text-muted-foreground">
                      Só é possível excluir categorias sem produtos.
                    </p>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {lista.length === 0 && refinando ? (
            <EmptyState
              icon={Search}
              title="Nenhum produto encontrado"
              description="Ajuste a busca ou os filtros."
              className="border-0 bg-transparent py-10"
            />
          ) : visao === "grade" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
              <button
                type="button"
                onClick={() => abrirFormulario(novo())}
                className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary/30 bg-card/60 p-4 text-center text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-card focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Plus className="size-5" aria-hidden="true" />
                </span>
                <span>
                  Adicionar produto
                  {categoriaSelecionada && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      em {categoriaSelecionada.nome}
                    </span>
                  )}
                </span>
              </button>
              {lista.map((produto) => (
                <CartaoProduto
                  key={produto.id}
                  produto={produto}
                  categoria={categoriaDe(produto)}
                  acoes={acoes}
                  enviandoFoto={
                    enviarImagem.isPending && enviarImagem.variables?.produtoId === produto.id
                  }
                />
              ))}
            </div>
          ) : lista.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum produto nesta categoria"
              description="Cadastre o primeiro item."
              className="border-0 bg-transparent py-10"
              action={
                <Button onClick={() => abrirFormulario(novo())}>
                  <Plus className="size-4" />
                  Novo produto
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
              <table className="w-full min-w-[46rem] text-sm">
                <thead className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Produto</th>
                    <th className="px-4 py-3 font-medium">Categoria</th>
                    <th className="px-4 py-3 font-medium">Setor</th>
                    <th className="px-4 py-3 text-right font-medium">Preço</th>
                    <th className="px-4 py-3 font-medium">No cardápio</th>
                    <th className="px-4 py-3 font-medium">Disponível</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lista.map((produto) => (
                    <tr
                      key={produto.id}
                      className={cn("hover:bg-muted/40", !produto.ativo && "opacity-60")}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <MiniaturaProduto produto={produto} categoria={categoriaDe(produto)} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{produto.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {produto.codigo || "Sem código"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {categoriaDe(produto)?.nome ?? "—"}
                        {categoriaDe(produto)?.ativa === false && (
                          <StatusBadge tone="danger" className="ml-2">
                            Inativa
                          </StatusBadge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {setorDe(produto)?.nome ?? "—"}
                        {setorDe(produto)?.ativo === false && (
                          <StatusBadge tone="danger" className="ml-2">
                            Inativo
                          </StatusBadge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        {brl(produto.preco)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Switch
                          checked={produto.ativo}
                          onCheckedChange={(ativo) => acoes.alternarAtivo(produto, ativo)}
                          aria-label={`${produto.nome} no cardápio`}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <Switch
                          checked={produto.disponivel}
                          disabled={!produto.ativo}
                          onCheckedChange={(disponivel) =>
                            acoes.alternarDisponivel(produto, disponivel)
                          }
                          aria-label={`${produto.nome} disponível para venda`}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <MenuProduto produto={produto} acoes={acoes} comAlternancias={false} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {dialogoCategoria}
      <DialogoRenomear
        titulo="Renomear categoria"
        descricao="O novo nome vale para todos os produtos desta categoria."
        nomeAtual={renomeandoCategoria?.nome ?? null}
        maximo={60}
        salvando={renomearCategoria.isPending}
        aoFechar={() => setRenomeandoCategoria(null)}
        aoSalvar={(novoNome) =>
          renomeandoCategoria &&
          renomearCategoria.mutate(
            { id: renomeandoCategoria.id, nome: novoNome },
            { onSuccess: () => setRenomeandoCategoria(null) },
          )
        }
      />

      <input
        ref={seletorImagem}
        type="file"
        accept="image/*"
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
              <div className="flex items-center gap-4">
                <div className="flex aspect-[4/3] w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/60">
                  {(previaFoto ?? imagemAtual) ? (
                    <img
                      src={previaFoto ?? imagemAtual ?? undefined}
                      alt="Foto do produto"
                      className="size-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="size-6 text-muted-foreground/50" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => seletorFotoDoFormulario.current?.click()}
                    >
                      <Upload className="size-4" />
                      {(previaFoto ?? imagemAtual) ? "Trocar foto" : "Escolher foto"}
                    </Button>
                    {foto && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setFoto(null)}>
                        Desfazer
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG ou WebP. A foto é convertida para WebP automaticamente.
                  </p>
                </div>
                <input
                  ref={seletorFotoDoFormulario}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0];
                    e.target.value = "";
                    if (arquivo) setFoto(arquivo);
                  }}
                />
              </div>

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
                  <NativeSelect
                    id="produto-categoria"
                    value={form.categoriaId}
                    onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
                  >
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="produto-setor">Setor de produção</Label>
                  <NativeSelect
                    id="produto-setor"
                    value={form.setorId}
                    onChange={(e) => setForm({ ...form, setorId: e.target.value })}
                  >
                    <option value="">Não envia para a cozinha</option>
                    {setores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </NativeSelect>
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
                  {
                    onSuccess: (produtoId) => {
                      if (foto) enviarImagem.mutate({ produtoId, arquivo: foto });
                      setForm(null);
                    },
                  },
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
