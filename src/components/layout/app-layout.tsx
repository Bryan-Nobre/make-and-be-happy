import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Boxes,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  Sun,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSouAdminPlataforma } from "@/hooks/use-admin-plataforma";
import { useSessaoAberta } from "@/hooks/use-caixa";
import { mensagemDeErro } from "@/lib/erros";
import { MODULOS_DE_GESTAO, PAPEL_LABEL, type ModuloKey } from "@/lib/permissoes";
import { cn } from "@/lib/utils";
import { useEmpresa } from "@/providers/empresa";
import { useFilaOffline } from "@/providers/fila-offline";
import { useMenuLayout } from "@/providers/menu-layout";
import { useTema } from "@/providers/tema";
import { sair } from "@/services/auth";

const LARGURA_EXPANDIDO = "w-[280px]";
const LARGURA_RECOLHIDO = "w-[72px]";
const PADDING_EXPANDIDO = "lg:pl-[280px]";
const PADDING_RECOLHIDO = "lg:pl-[72px]";

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
  { label: "Estoque", to: "/estoque", icon: Boxes, modulos: ["estoque"] },
];

const SISTEMA: NavItem[] = [
  {
    label: "Configurações",
    to: "/configuracoes",
    icon: Settings,
    modulos: MODULOS_DE_GESTAO,
    ativoEm: ["/produtos", "/clientes", "/relatorios"],
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
  "/estoque": { titulo: "Estoque" },
  "/estoque/historico": { titulo: "Histórico", pai: { titulo: "Estoque", to: "/estoque" } },
  "/clientes": { titulo: "Clientes", pai: PAI_CONFIGURACOES },
  "/relatorios": { titulo: "Relatórios", pai: PAI_CONFIGURACOES },
  "/ajuda": { titulo: "Central de ajuda" },
  "/admin": { titulo: "Admin da plataforma" },
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

function NavLinkItem({
  item,
  pathname,
  onNavigate,
  compacto,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
  compacto?: boolean;
}) {
  const { podeVer, noMenu } = useEmpresa();
  // Nota: controla apenas a interface; a RLS bloqueia o acesso real aos dados.
  const noMenuEmpresa = item.modulos.length === 0 || item.modulos.some((m) => noMenu(m));
  const allowed = item.modulos.length === 0 || item.modulos.some(podeVer);
  const active = estaAtivo(item, pathname);

  if (!noMenuEmpresa) return null;

  const link = (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={compacto ? item.label : undefined}
      className={cn(
        ITEM,
        ITEM_ESTADO(active),
        !allowed && "opacity-55",
        compacto && "justify-center px-0",
      )}
    >
      <item.icon className={ICONE_ESTADO(active)} aria-hidden="true" />
      {!compacto && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {!allowed && (
            <Lock
              className="size-3.5 text-muted-foreground"
              aria-label="Sem permissão para este módulo"
            />
          )}
        </>
      )}
    </Link>
  );

  return (
    <li>
      {compacto ? (
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      ) : (
        link
      )}
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

function Grupo({
  titulo,
  compacto,
  children,
}: {
  titulo: string;
  compacto?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      {!compacto && (
        <p className="px-3 pb-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
          {titulo}
        </p>
      )}
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </div>
  );
}

function LinkAdminPlataforma({
  pathname,
  onNavigate,
  compacto,
}: {
  pathname: string;
  onNavigate?: () => void;
  compacto?: boolean;
}) {
  const admin = useSouAdminPlataforma();
  // Nota: só controla a interface; as RPCs exigem admin_plataforma de verdade.
  if (admin.data !== true) return null;

  const active = pathname === "/admin" || pathname.startsWith("/admin/");
  const link = (
    <Link
      to="/admin"
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={compacto ? "Admin da plataforma" : undefined}
      className={cn(
        ITEM,
        ITEM_ESTADO(active),
        compacto && "justify-center px-0",
      )}
    >
      <Shield className={ICONE_ESTADO(active)} aria-hidden="true" />
      {!compacto && <span className="flex-1 truncate">Admin da plataforma</span>}
    </Link>
  );

  return (
    <li>
      {compacto ? (
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">Admin da plataforma</TooltipContent>
        </Tooltip>
      ) : (
        link
      )}
    </li>
  );
}

function SidebarContent({
  onNavigate,
  compacto = false,
  onAlternarCompacto,
}: {
  onNavigate?: () => void;
  compacto?: boolean;
  onAlternarCompacto?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav aria-label="Navegação principal" className="flex h-full min-h-0 flex-col bg-sidebar">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-1 border-b border-border/60",
          compacto ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        <Link to="/" className="min-w-0 rounded-lg px-1 py-1" onClick={onNavigate}>
          <LogoMarca className="gap-3" tamanho="md" mostrarNome={!compacto} />
        </Link>
        {onAlternarCompacto && !compacto && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            onClick={onAlternarCompacto}
            aria-label="Recolher menu"
          >
            <PanelLeftClose className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      {compacto && onAlternarCompacto && (
        <div className="flex justify-center px-2 pt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10"
                onClick={onAlternarCompacto}
                aria-label="Expandir menu"
              >
                <PanelLeftOpen className="size-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Expandir menu</TooltipContent>
          </Tooltip>
        </div>
      )}

      <div
        className={cn("min-h-0 flex-1 overflow-y-auto pb-4", compacto ? "px-2 pt-3" : "px-3 pt-5")}
      >
        <Grupo titulo="Operação" compacto={compacto}>
          {OPERACAO.map((item) => (
            <NavLinkItem
              key={item.to}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
              compacto={compacto}
            />
          ))}
        </Grupo>

        <div className={cn(compacto ? "mt-4" : "mt-6", "lg:hidden")}>
          <Grupo titulo="Sistema" compacto={compacto}>
            {SISTEMA.map((item) => (
              <NavLinkItem
                key={item.to}
                item={item}
                pathname={pathname}
                onNavigate={onNavigate}
                compacto={compacto}
              />
            ))}
            <LinkAdminPlataforma
              pathname={pathname}
              onNavigate={onNavigate}
              compacto={compacto}
            />
          </Grupo>
          <ContaLateral onNavigate={onNavigate} compacto={false} />
        </div>
      </div>

      <div
        className={cn(
          "hidden shrink-0 border-t border-border/60 lg:block",
          compacto ? "p-2" : "px-3 pt-3 pb-4",
        )}
      >
        <Grupo titulo="Sistema" compacto={compacto}>
          {SISTEMA.map((item) => (
            <NavLinkItem
              key={item.to}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
              compacto={compacto}
            />
          ))}
          <LinkAdminPlataforma
            pathname={pathname}
            onNavigate={onNavigate}
            compacto={compacto}
          />
        </Grupo>
        <ContaLateral compacto={compacto} />
      </div>
    </nav>
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

function BotaoTema({ compacto }: { compacto?: boolean }) {
  const { escuro, alternar } = useTema();
  const rotulo = escuro ? "Modo claro" : "Modo escuro";

  if (compacto) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10"
            onClick={alternar}
            aria-label={rotulo}
            aria-pressed={escuro}
          >
            {escuro ? (
              <Sun className="size-4" aria-hidden="true" />
            ) : (
              <Moon className="size-4" aria-hidden="true" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{rotulo}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={escuro}
      className={cn(ITEM, ITEM_ESTADO(false), "cursor-pointer")}
    >
      {escuro ? (
        <Sun className={ICONE_ESTADO(false)} aria-hidden="true" />
      ) : (
        <Moon className={ICONE_ESTADO(false)} aria-hidden="true" />
      )}
      <span className="flex-1 truncate text-left">{rotulo}</span>
    </button>
  );
}

/** Conta do usuário no rodapé da lateral (desktop e drawer mobile). */
function ContaLateral({ onNavigate, compacto }: { onNavigate?: () => void; compacto?: boolean }) {
  const { nomeUsuario, papel, empresa, vinculos, selecionarEmpresa } = useEmpresa();
  const { saindo, sairDaConta } = useSair();

  if (compacto) {
    return (
      <div className="mt-2 flex flex-col items-center gap-1.5">
        <BotaoTema compacto />
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-full"
                  aria-label={`${nomeUsuario}${papel ? ` · ${PAPEL_LABEL[papel]}` : ""}`}
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-strong">
                    {iniciais(nomeUsuario)}
                  </span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">{nomeUsuario}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" align="end" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm font-medium">{nomeUsuario}</span>
              <span className="block text-xs text-muted-foreground">
                {papel ? PAPEL_LABEL[papel] : ""}
                {empresa ? ` · ${empresa.nome}` : ""}
              </span>
            </DropdownMenuLabel>
            {vinculos.length > 1 && (
              <>
                <DropdownMenuSeparator />
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
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={saindo} onSelect={() => void sairDaConta()}>
              <LogOut className="size-4" aria-hidden="true" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-1 border-t border-border/60 pt-3">
      <BotaoTema />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={cn(ITEM, ITEM_ESTADO(false), "cursor-pointer")}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-strong">
              {iniciais(nomeUsuario)}
            </span>
            <span className="min-w-0 flex-1 text-left leading-tight">
              <span className="block truncate text-sm font-medium text-foreground">
                {nomeUsuario}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {papel ? PAPEL_LABEL[papel] : ""}
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-64">
          {empresa && (
            <DropdownMenuLabel className="font-normal">
              <span className="flex items-center gap-2">
                <LogoEmpresa nome={empresa.nome} logoUrl={empresa.logoUrl} className="size-7" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{empresa.nome}</span>
                  <span className="block text-xs text-muted-foreground">Restaurante atual</span>
                </span>
              </span>
            </DropdownMenuLabel>
          )}
          {vinculos.length > 1 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Trocar restaurante</DropdownMenuLabel>
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
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={saindo}
            onSelect={() => {
              onNavigate?.();
              void sairDaConta();
            }}
          >
            <LogOut className="size-4" aria-hidden="true" />
            {saindo ? "Saindo…" : "Sair"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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

function AvisoEmpresaPausada() {
  const { empresa } = useEmpresa();
  if (!empresa || empresa.ativa) return null;

  return (
    <div
      role="status"
      className="border-b border-warning/30 bg-warning-soft px-3 py-2 text-center text-sm text-warning-foreground sm:px-4"
    >
      Esta empresa está pausada. Membros comuns não a veem; você está acessando como admin da
      plataforma.
    </div>
  );
}

function Chrome({ modulos, children }: { modulos: readonly ModuloKey[]; children: ReactNode }) {
  const { podeVer } = useEmpresa();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { recolhido, animar, alternar } = useMenuLayout();
  const allowed = modulos.length === 0 || modulos.some(podeVer);
  const pagina = PAGINAS[pathname] ?? { titulo: "Arvon Food" };
  const label = pagina.titulo;
  const classeAnimacao = animar ? "transition-[width,padding] duration-200" : undefined;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-dvh overflow-x-hidden bg-background">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-sidebar lg:flex",
            classeAnimacao,
            recolhido ? LARGURA_RECOLHIDO : LARGURA_EXPANDIDO,
          )}
        >
          <SidebarContent compacto={recolhido} onAlternarCompacto={alternar} />
        </aside>

        <div
          className={cn(
            "min-w-0",
            classeAnimacao,
            recolhido ? PADDING_RECOLHIDO : PADDING_EXPANDIDO,
          )}
        >
          <AvisoEmpresaPausada />
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

            <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {pagina.pai ? (
                <>
                  <Link
                    to={pagina.pai.to}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {pagina.pai.titulo}
                  </Link>
                  <span aria-hidden="true" className="mx-1.5 text-border">
                    /
                  </span>
                </>
              ) : null}
              {label}
            </p>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <IndicadorConexao />
              <PainelPendencias />
              {podeVer("caixa") && <SeloCaixa />}
            </div>
          </header>

          <main className="mx-auto w-full max-w-full min-w-0 overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:w-[90%] lg:px-0">
            {allowed ? children : <PermissionDenied label={label} />}
          </main>
        </div>
      </div>
    </TooltipProvider>
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
