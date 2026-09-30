import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Boxes,
  ChefHat,
  ChevronsUpDown,
  ClipboardList,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { RotaProtegida } from "@/components/layout/rota-protegida";
import { EmptyState } from "@/components/shared/empty-state";
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
import { PAPEL_LABEL, type ModuloKey } from "@/lib/permissoes";
import { cn } from "@/lib/utils";
import { useEmpresa } from "@/providers/empresa";
import { sair } from "@/services/auth";

type NavItem = {
  key: ModuloKey;
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  group: "Operação" | "Gestão";
};

export const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", to: "/", icon: LayoutDashboard, group: "Operação" },
  { key: "pdv", label: "PDV", to: "/pdv", icon: ShoppingCart, group: "Operação" },
  { key: "mesas", label: "Mesas", to: "/mesas", icon: UtensilsCrossed, group: "Operação" },
  { key: "cozinha", label: "Cozinha", to: "/cozinha", icon: ChefHat, group: "Operação" },
  { key: "caixa", label: "Caixa", to: "/caixa", icon: Wallet, group: "Operação" },
  { key: "produtos", label: "Produtos", to: "/produtos", icon: Package, group: "Gestão" },
  { key: "estoque", label: "Estoque", to: "/estoque", icon: Boxes, group: "Gestão" },
  { key: "clientes", label: "Clientes", to: "/clientes", icon: Users, group: "Gestão" },
  {
    key: "relatorios",
    label: "Relatórios",
    to: "/relatorios",
    icon: ClipboardList,
    group: "Gestão",
  },
  {
    key: "configuracoes",
    label: "Configurações",
    to: "/configuracoes",
    icon: Settings,
    group: "Gestão",
  },
];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3 rounded-lg px-1 py-1">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground shadow-xs">
        A
      </span>
      <span className="leading-none">
        <span className="block text-base font-bold tracking-tight text-foreground">ARVON</span>
        <span className="mt-1 block text-xs font-medium tracking-widest text-muted-foreground">
          FOOD
        </span>
      </span>
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
  const allowed = podeVer(item.key);
  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);

  return (
    <li>
      <Link
        to={item.to}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors lg:min-h-10",
          active
            ? "bg-primary-soft text-primary-strong"
            : "text-foreground/80 hover:bg-muted hover:text-foreground",
          !allowed && "opacity-55",
        )}
      >
        <item.icon
          className={cn(
            "size-4.5 shrink-0",
            active ? "text-primary-strong" : "text-muted-foreground group-hover:text-foreground",
          )}
          aria-hidden="true"
        />
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

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const groups: NavItem["group"][] = ["Operação", "Gestão"];
  const destacados = NAV.filter((item) => item.key === "configuracoes");

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-6">
      {groups.map((group) => {
        const items = NAV.filter((item) => item.group === group && !destacados.includes(item));
        return (
          <div key={group}>
            <p className="px-3 pb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {group}
            </p>
            <ul className="flex flex-col gap-1">
              {items.map((item) => (
                <NavLinkItem
                  key={item.key}
                  item={item}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        );
      })}
      {destacados.length > 0 && (
        <ul className="flex flex-col gap-1 border-t pt-4">
          {destacados.map((item) => (
            <NavLinkItem key={item.key} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </nav>
  );
}

function SidebarContent({
  onNavigate,
  mostrarUsuario = true,
}: {
  onNavigate?: () => void;
  mostrarUsuario?: boolean;
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 shrink-0 items-center px-4">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <NavList onNavigate={onNavigate} />
      </div>
      {mostrarUsuario && (
        <div className="shrink-0 border-t p-3">
          <UserMenu variant="sidebar" />
        </div>
      )}
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

function UserMenu({ variant = "header" }: { variant?: "header" | "sidebar" }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { nomeUsuario, papel, empresa, vinculos, selecionarEmpresa } = useEmpresa();
  const [saindo, setSaindo] = useState(false);

  const sairDaConta = async () => {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "sidebar" ? (
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg bg-muted/60 px-3 py-2.5 text-left transition-colors hover:bg-muted"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-strong">
              {iniciais(nomeUsuario)}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-foreground">
                {nomeUsuario}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {papel ? PAPEL_LABEL[papel] : ""}
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        ) : (
          <Button variant="ghost" className="h-11 gap-2 px-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
              {iniciais(nomeUsuario)}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-medium">{nomeUsuario}</span>
              <span className="block text-xs text-muted-foreground">
                {papel ? PAPEL_LABEL[papel] : ""}
              </span>
            </span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={variant === "sidebar" ? "start" : "end"}
        side={variant === "sidebar" ? "top" : "bottom"}
        className="w-64"
      >
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

function Chrome({ modulo, children }: { modulo: ModuloKey; children: ReactNode }) {
  const { empresa, podeVer } = useEmpresa();
  const [open, setOpen] = useState(false);
  const allowed = podeVer(modulo);
  const label = NAV.find((n) => n.key === modulo)?.label ?? modulo;

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-[280px] flex-col border-r bg-sidebar lg:flex">
        <SidebarContent />
      </aside>

      <div className="lg:pl-[280px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card px-4 md:px-6 lg:px-8">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-2 size-11 lg:hidden">
                <Menu className="size-5" aria-hidden="true" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] gap-0 bg-sidebar p-0">
              <SheetTitle className="sr-only">Navegação</SheetTitle>
              <SidebarContent onNavigate={() => setOpen(false)} mostrarUsuario={false} />
            </SheetContent>
          </Sheet>

          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            {empresa && (
              <>
                <span className="hidden truncate text-muted-foreground sm:inline">
                  {empresa.nome}
                </span>
                <span aria-hidden="true" className="hidden text-border sm:inline">
                  /
                </span>
              </>
            )}
            <span className="truncate font-medium text-foreground">{label}</span>
          </p>

          <div className="flex shrink-0 items-center gap-2">
            {empresa && podeVer("caixa") && <SeloCaixa />}
            <div className="lg:hidden">
              <UserMenu />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 lg:px-8">
          {allowed ? children : <PermissionDenied label={label} />}
        </main>
      </div>
    </div>
  );
}

export function AppLayout({ module, children }: { module: ModuloKey; children: ReactNode }) {
  return (
    <RotaProtegida>
      <Chrome modulo={module}>{children}</Chrome>
    </RotaProtegida>
  );
}
