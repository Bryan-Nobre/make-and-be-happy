import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Boxes,
  ChefHat,
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
import { mensagemDeErro } from "@/lib/erros";
import { PAPEL_LABEL, type ModuloKey } from "@/lib/permissoes";
import { cn } from "@/lib/utils";
import { useEmpresa } from "@/providers/empresa";
import { sair } from "@/services/auth";
import { useArvon } from "@/store/arvon";

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
    <Link to="/" className="flex items-center gap-2.5 rounded-md px-1 py-1">
      <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
        A
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold tracking-tight">ARVON FOOD</span>
        <span className="block text-xs text-muted-foreground">Gestão para restaurantes</span>
      </span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { podeVer } = useEmpresa();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const groups: NavItem["group"][] = ["Operação", "Gestão"];

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-5">
      {groups.map((group) => {
        const items = NAV.filter((item) => item.group === group);
        return (
          <div key={group}>
            <p className="px-3 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {group}
            </p>
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const allowed = podeVer(item.key);
                const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                return (
                  <li key={item.key}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                        !allowed && "opacity-55",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                      {!allowed && (
                        <Lock
                          className="size-3.5 text-muted-foreground"
                          aria-label="Sem permissão para este módulo"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
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

function UserMenu() {
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
    <div className="flex flex-col items-center justify-center rounded-lg border bg-card px-6 py-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted">
        <Lock className="size-5 text-muted-foreground" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">Acesso não permitido</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Seu perfil atual não tem acesso ao módulo {label}. Peça a um administrador para liberar.
      </p>
    </div>
  );
}

function Chrome({ modulo, children }: { modulo: ModuloKey; children: ReactNode }) {
  const { empresa, podeVer } = useEmpresa();
  const { cash } = useArvon();
  const [open, setOpen] = useState(false);
  const allowed = podeVer(modulo);
  const label = NAV.find((n) => n.key === modulo)?.label ?? modulo;

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-[280px] flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b px-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavList />
        </div>
        <div className="border-t px-4 py-3 text-xs text-muted-foreground">
          Módulos em migração ainda usam dados de exemplo.
        </div>
      </aside>

      <div className="lg:pl-[280px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur md:px-6 lg:px-8">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="size-11 lg:hidden">
                <Menu className="size-5" aria-hidden="true" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetTitle className="sr-only">Navegação</SheetTitle>
              <div className="flex h-16 items-center border-b px-4">
                <Brand />
              </div>
              <div className="overflow-y-auto px-3 py-4">
                <NavList onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{empresa?.nome}</p>
            <p className="hidden text-xs text-muted-foreground sm:block">{label}</p>
          </div>

          <StatusBadge tone={cash.status === "OPEN" ? "success" : "neutral"}>
            {cash.status === "OPEN" ? "Caixa aberto" : "Caixa fechado"}
          </StatusBadge>

          <UserMenu />
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
