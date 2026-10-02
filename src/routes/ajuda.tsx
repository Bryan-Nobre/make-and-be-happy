import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChefHat,
  ChevronRight,
  ClipboardList,
  Package,
  ShieldCheck,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import type { ModuloKey } from "@/lib/permissoes";
import { useEmpresa } from "@/providers/empresa";

export const Route = createFileRoute("/ajuda")({
  head: () => ({
    meta: [
      { title: "Central de ajuda — ARVON FOOD" },
      { name: "description", content: "Guia rápido das rotinas do ARVON FOOD." },
      { property: "og:title", content: "Central de ajuda — ARVON FOOD" },
      { property: "og:description", content: "Guia rápido das rotinas do ARVON FOOD." },
    ],
  }),
  component: () => (
    <AppLayout>
      <Ajuda />
    </AppLayout>
  ),
});

type Guia = {
  titulo: string;
  icone: LucideIcon;
  passos: string[];
  link: {
    rotulo: string;
    to: "/pedidos" | "/mesas" | "/cozinha" | "/caixa" | "/configuracoes";
    modulos: readonly ModuloKey[];
  };
};

const GUIAS: Guia[] = [
  {
    titulo: "Lançar um pedido no balcão",
    icone: ClipboardList,
    passos: [
      "Em Pedidos, toque em Novo pedido.",
      "Escolha os produtos, os adicionais e, se quiser, o cliente.",
      "Envie para a cozinha ou receba na hora, com o caixa aberto.",
    ],
    link: { rotulo: "Ir para Pedidos", to: "/pedidos", modulos: ["pdv"] },
  },
  {
    titulo: "Atender uma mesa",
    icone: UtensilsCrossed,
    passos: [
      "Em Mesas, toque em uma mesa livre e abra a comanda.",
      "Na comanda, use Lançar pedido no PDV para adicionar itens.",
      "Ao final, feche a conta e receba o pagamento.",
    ],
    link: { rotulo: "Ir para Mesas", to: "/mesas", modulos: ["mesas"] },
  },
  {
    titulo: "Acompanhar a cozinha",
    icone: ChefHat,
    passos: [
      "Os pedidos enviados aparecem na fila da Cozinha em tempo real.",
      "Filtre por setor para ver só o que cada praça prepara.",
      "Avance o pedido para Em preparo e depois para Pronto.",
    ],
    link: { rotulo: "Ir para Cozinha", to: "/cozinha", modulos: ["cozinha"] },
  },
  {
    titulo: "Receber e fechar o caixa",
    icone: Wallet,
    passos: [
      "Abra o caixa no início do turno, informando o valor inicial.",
      "Receba os pedidos de balcão e registre sangrias e suprimentos.",
      "No fim do turno, confira os valores e feche o caixa.",
    ],
    link: { rotulo: "Ir para Caixa", to: "/caixa", modulos: ["caixa"] },
  },
  {
    titulo: "Cadastrar produtos e estoque",
    icone: Package,
    passos: [
      "Em Configurações, abra Produtos e categorias.",
      "Defina adicionais e setores da cozinha quando necessário.",
      "Em Estoque, cadastre os insumos; a ficha técnica fica no próprio produto.",
    ],
    link: {
      rotulo: "Ir para Configurações",
      to: "/configuracoes",
      modulos: ["produtos", "estoque"],
    },
  },
  {
    titulo: "Usuários e permissões",
    icone: ShieldCheck,
    passos: [
      "Em Configurações, abra a aba Usuários para convidar a equipe.",
      "Cada pessoa recebe um perfil: administrador, caixa, garçom ou cozinha.",
      "A aba Permissões mostra o que cada perfil pode acessar.",
    ],
    link: { rotulo: "Ir para Configurações", to: "/configuracoes", modulos: ["configuracoes"] },
  },
];

function Ajuda() {
  const { podeVer } = useEmpresa();

  return (
    <div className="space-y-6">
      <PageHeader title="Central de ajuda" description="Guia rápido das rotinas do dia a dia." />

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GUIAS.map((g) => (
          <li key={g.titulo}>
            <section
              aria-label={g.titulo}
              className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-xs"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
                  <g.icone className="size-5" aria-hidden="true" />
                </span>
                <h2 className="text-base font-semibold text-foreground">{g.titulo}</h2>
              </div>
              <ol className="mt-4 flex-1 list-decimal space-y-2 pl-5 text-sm text-muted-foreground marker:text-primary-strong">
                {g.passos.map((passo) => (
                  <li key={passo}>{passo}</li>
                ))}
              </ol>
              {g.link.modulos.some(podeVer) && (
                <Link
                  to={g.link.to}
                  className="mt-4 inline-flex items-center gap-1 self-start rounded-md text-sm font-medium text-primary-strong hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {g.link.rotulo}
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              )}
            </section>
          </li>
        ))}
      </ul>

      <p className="text-sm text-muted-foreground">
        Não encontrou o que procurava? Fale com o responsável pelo seu restaurante.
      </p>
    </div>
  );
}
