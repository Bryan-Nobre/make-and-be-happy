import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChefHat,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  LogOut,
  Menu,
  Settings,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { IndicadorConexao } from "@/components/layout/indicador-conexao";
import { PainelPendencias } from "@/components/layout/painel-pendencias";
import { RotaProtegida } from "@/components/layout/rota-protegida";
import { EmptyState } from "@/components/shared/empty-state";
import { LogoEmpresa } from "@/components/shared/logo-empresa";
import { LogoMarca } from "@/components/shared/logo-marca";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSessaoAberta } from "@/hooks/use-caixa";
import { mensagemDeErro } from "@/lib/erros";
import { MODULOS_DE_GESTAO, PAPEL_LABEL, type ModuloKey } from "@/lib/permissoes";
import { cn } from "@/lib/utils";
import { useEmpresa } from "@/providers/empresa";
import { useFilaOffline } from "@/providers/fila-offline";
import { sair } from "@/services/auth";

type NavItem = {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  /** Liberado se o perfil puder ver ao menos um destes módulos; vazio = todos os membros. */
  modulos: readonly ModuloKey[];
  /** Rotas, além de `to`, em que o item aparece como ativo. */
  ativoEm?: readonly string[];
};

const OPERACAO: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, modulos: ["dashboard"] },
  { label: "Pedidos", to: "/pedidos", icon: ClipboardList, modulos: ["pdv"] },
  { label: "Mesas", to: "/mesas", icon: UtensilsCrossed, modulos: ["mesas"] },
  { label: "Cozinha", to: "/cozinha", icon: ChefHat, modulos: ["cozinha"] },
  { label: "Caixa", to: "/caixa", icon: Wallet, modulos: ["caixa"] },
];

const SISTEMA: NavItem[] = [
  {
    label: "Configurações",
    to: "/configuracoes",
    icon: Settings,
    modulos: MODULOS_DE_GESTAO,
    ativoEm: ["/produtos", "/estoque", "/clientes", "/relatorios"],
  },
  { label: "Central de ajuda", to: "/ajuda", icon: LifeBuoy, modulos: [] },
];

type Pagina = { titulo: string; pai?: { titulo: string; to: string } };

const PAI_CONFIGURACOES = { titulo: "Configurações", to: "/configuracoes" };

const PAGINAS: Record<string, Pagina> = {
  "/": { titulo: "Dashboard" },
  "/pedidos": { titulo: "Pedidos" },
  "/mesas": { titulo: "Mesas" },
  "/cozinha": { titulo: "Cozinha" },
  "/caixa": { titulo: "Caixa" },
  "/configuracoes": { titulo: "Configurações" },
  "/produtos": { titulo: "Produtos", pai: PAI_CONFIGURACOES },
  "/estoque": { titulo: "Estoque", pai: PAI_CONFIGURACOES },
  "/estoque/historico": { titulo: "Histórico", pai: { titulo: "Estoque", to: "/estoque" } },
  "/clientes": { titulo: "Clientes", pai: PAI_CONFIGURACOES },
  "/relatorios": { titulo: "Relatórios", pai: PAI_CONFIGURACOES },
  "/ajuda": { titulo: "Central de ajuda" },
};

const estaAtivo = (item: NavItem, pathname: string) =>
  [item.to, ...(item.ativoEm ?? [])].some((rota) =>
    rota === "/" ? pathname === "/" : pathname === rota || pathname.startsWith(`${rota}/`),
  );

function useSair() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saindo, setSaindo] = useState(false);
  const { pendentes } = useFilaOffline();

  const sairDaConta = async () => {
    // Sair apaga os dados locais, e com eles os pedidos ainda não enviados.
    if (pendentes > 0) {
      toast.error(
        `Há ${pendentes} ${pendentes > 1 ? "ações feitas" : "ação feita"} offline ainda não ${pendentes > 1 ? "enviadas" : "enviada"}.`,
        { description: "Sincronize ou descarte em Pendências antes de sair." },
      );
      return;
    }
    setSaindo(true);
    try {
      await sair();
      // Limpa o cache para não deixar dados de uma empresa visíveis na próxima sessão.
      queryClient.clear();
      void navigate({ to: "/login", replace: true });
    } catch (erro) {
      toast.error(mensagemDeErro(erro));
    } finally {
      setSaindo(false);
    }
  };

  return { saindo, sairDaConta };
}

function Brand() {
  return (
    <Link to="/" className="rounded-lg px-1 py-1">
      <LogoMarca className="gap-3" tamanho="md" />
    </Link>
  );
}

function NavLinkItem({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const { podeVer } = useEmpresa();
  // Nota: controla apenas a interface; a RLS bloqueia o acesso real aos dados.
  const allowed = item.modulos.length === 0 || item.modulos.some(podeVer);
  const active = estaAtivo(item, pathname);

  return (
    <li>
      <Link
        to={item.to}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(ITEM, ITEM_ESTADO(active), !allowed && "opacity-55")}
      >
        <item.icon className={ICONE_ESTADO(active)} aria-hidden="true" />
        <span className="flex-1 truncate">{item.label}</span>
        {!allowed && (
          <Lock
            className="size-3.5 text-muted-foreground"
            aria-label="Sem permissão para este módulo"
          />
        )}
      </Link>
    </li>
  );
}

const ITEM =
  "group flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors lg:min-h-10";
const ITEM_ESTADO = (active: boolean) =>
  active
    ? "bg-primary-soft text-primary-strong"
    : "text-foreground/75 hover:bg-muted/70 hover:text-foreground";
const ICONE_ESTADO = (active: boolean) =>
  cn(
    "size-4 shrink-0",
    active ? "text-primary-strong" : "text-muted-foreground group-hover:text-foreground",
  );

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="px-3 pb-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
        {titulo}
      </p>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav aria-label="Navegação principal" className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Brand />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-6 pb-4">
        <Grupo titulo="Operação">
          {OPERACAO.map((item) => (
            <NavLinkItem key={item.to} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </Grupo>

        {/* No desktop o rodapé de sistema fica abaixo; no mobile tudo entra neste scroll. */}
        <div className="mt-6 lg:hidden">
          <Grupo titulo="Sistema">
            {SISTEMA.map((item) => (
              <NavLinkItem key={item.to} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </Grupo>
          <ContaMobile onNavigate={onNavigate} />
        </div>
      </div>

      <div className="hidden shrink-0 px-3 pt-4 pb-5 lg:block">
        <Grupo titulo="Sistema">
          {SISTEMA.map((item) => (
            <NavLinkItem key={item.to} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
          <li>
            <SairBotao />
          </li>
        </Grupo>
      </div>
    </nav>
  );
}

function SairBotao() {
  const { saindo, sairDaConta } = useSair();
  return (
    <button
      type="button"
      disabled={saindo}
      onClick={() => void sairDaConta()}
      className={cn(ITEM, ITEM_ESTADO(false), "cursor-pointer disabled:opacity-60")}
    >
      <LogOut className={ICONE_ESTADO(false)} aria-hidden="true" />
      <span className="flex-1 truncate text-left">{saindo ? "Saindo…" : "Sair"}</span>
    </button>
  );
}

/** Conta, caixa e troca de restaurante — só no drawer mobile. */
function ContaMobile({ onNavigate }: { onNavigate?: () => void }) {
  const { nomeUsuario, papel, empresa, vinculos, selecionarEmpresa, podeVer } = useEmpresa();
  const { saindo, sairDaConta } = useSair();

  return (
    <div className="mt-6 space-y-3 border-t border-border/60 pt-4">
      {empresa && (
        <div className="flex items-center gap-2.5 px-3">
          <LogoEmpresa nome={empresa.nome} logoUrl={empresa.logoUrl} className="size-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{empresa.nome}</p>
            <p className="truncate text-xs text-muted-foreground">
              {nomeUsuario}
              {papel ? ` · ${PAPEL_LABEL[papel]}` : ""}
            </p>
          </div>
        </div>
      )}

      {podeVer("caixa") && (
        <div className="px-3" onClick={onNavigate}>
          <SeloCaixa />
        </div>
      )}

      {vinculos.length > 1 && (
        <div className="space-y-1.5">
          <p className="px-3 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
            Restaurante
          </p>
          <ul className="flex flex-col gap-1">
            {vinculos.map((vinculo) => {
              const ativo = vinculo.empresa.id === empresa?.id;
              return (
                <li key={vinculo.empresa.id}>
                  <button
                    type="button"
                    onClick={() => {
                      selecionarEmpresa(vinculo.empresa.id);
                      onNavigate?.();
                    }}
                    className={cn(
                      ITEM,
                      ativo
                        ? "bg-primary-soft text-primary-strong"
                        : "text-foreground/75 hover:bg-muted/70",
                      "cursor-pointer",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-left">
                      {vinculo.empresa.nome}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {PAPEL_LABEL[vinculo.papel]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        <li>
          <button
            type="button"
            disabled={saindo}
            onClick={() => void sairDaConta()}
            className={cn(ITEM, ITEM_ESTADO(false), "cursor-pointer disabled:opacity-60")}
          >
            <LogOut className={ICONE_ESTADO(false)} aria-hidden="true" />
            <span className="flex-1 truncate text-left">{saindo ? "Saindo…" : "Sair"}</span>
          </button>
        </li>
      </ul>
    </div>
  );
}

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .map((parte) => parte[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function UserMenu() {
  const { nomeUsuario, papel, empresa, vinculos, selecionarEmpresa } = useEmpresa();
  const { saindo, sairDaConta } = useSair();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-11 gap-2 px-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-strong">
            {iniciais(nomeUsuario)}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-medium">{nomeUsuario}</span>
            <span className="block text-xs text-muted-foreground">
              {papel ? PAPEL_LABEL[papel] : ""}
            </span>
          </span>
          <ChevronDown
            className="hidden size-4 text-muted-foreground sm:block"
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {vinculos.length > 1 && (
          <>
            <DropdownMenuLabel>Restaurante</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={empresa?.id ?? ""} onValueChange={selecionarEmpresa}>
              {vinculos.map((vinculo) => (
                <DropdownMenuRadioItem key={vinculo.empresa.id} value={vinculo.empresa.id}>
                  <span className="flex flex-col">
                    <span className="text-sm">{vinculo.empresa.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {PAPEL_LABEL[vinculo.papel]}
                    </span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem disabled={saindo} onSelect={() => void sairDaConta()}>
          <LogOut className="size-4" aria-hidden="true" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PermissionDenied({ label }: { label: string }) {
  return (
    <EmptyState
      icon={Lock}
      title="Acesso não permitido"
      description={`Seu perfil atual não tem acesso ao módulo ${label}. Peça a um administrador para liberar.`}
    />
  );
}

function SeloCaixa() {
  const sessao = useSessaoAberta();
  if (!sessao.isSuccess) return null;

  return (
    <Link
      to="/caixa"
      aria-label="Ir para o Caixa"
      className="rounded-md transition-opacity hover:opacity-80"
    >
      <StatusBadge tone={sessao.data ? "success" : "neutral"} className="py-1">
        {sessao.data ? "Caixa aberto" : "Caixa fechado"}
      </StatusBadge>
    </Link>
  );
}

function Chrome({ modulos, children }: { modulos: readonly ModuloKey[]; children: ReactNode }) {
  const { empresa, podeVer } = useEmpresa();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const allowed = modulos.length === 0 || modulos.some(podeVer);
  const pagina = PAGINAS[pathname] ?? { titulo: "Arvon Food" };
  const label = pagina.titulo;

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-[280px] flex-col border-r bg-sidebar lg:flex">
        <SidebarContent />
      </aside>

      <div className="min-w-0 lg:pl-[280px]">
        <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center gap-2 border-b bg-card px-3 sm:h-16 sm:gap-3 sm:px-4 md:px-6 lg:px-8">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-1 size-11 shrink-0 lg:hidden">
                <Menu className="size-5" aria-hidden="true" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[min(280px,100vw)] max-w-full gap-0 overflow-x-hidden bg-sidebar p-0"
            >
              <SheetTitle className="sr-only">Navegação</SheetTitle>
              <SidebarContent onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* No mobile o título fica só no menu; no desktop mostra o caminho da página. */}
          <p className="hidden min-w-0 flex-1 items-center gap-2 text-sm lg:flex">
            {empresa && (
              <>
                <LogoEmpresa nome={empresa.nome} logoUrl={empresa.logoUrl} className="size-7" />
                <span className="truncate text-muted-foreground">{empresa.nome}</span>
                <span aria-hidden="true" className="text-border">
                  /
                </span>
              </>
            )}
            {pagina.pai && (
              <>
                <Link
                  to={pagina.pai.to}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {pagina.pai.titulo}
                </Link>
                <span aria-hidden="true" className="text-border">
                  /
                </span>
              </>
            )}
            <span className="truncate font-medium text-foreground">{label}</span>
          </p>

          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
            <IndicadorConexao />
            <PainelPendencias />
            {/* Caixa e conta só no header do desktop; no celular ficam no hamburger. */}
            <div className="hidden items-center gap-2 lg:flex">
              {empresa && podeVer("caixa") && <SeloCaixa />}
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-full min-w-0 overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:w-[90%] lg:px-0">
          {allowed ? children : <PermissionDenied label={label} />}
        </main>
      </div>
    </div>
  );
}

/**
 * `module` define quais perfis veem a página (basta um dos módulos);
 * sem `module`, a página é aberta a todos os membros.
 */
export function AppLayout({
  module,
  children,
}: {
  module?: ModuloKey | readonly ModuloKey[];
  children: ReactNode;
}) {
  const modulos = module === undefined ? [] : typeof module === "string" ? [module] : module;
  return (
    <RotaProtegida>
      <Chrome modulos={modulos}>{children}</Chrome>
    </RotaProtegida>
  );
}
