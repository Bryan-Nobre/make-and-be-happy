import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronUp, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/app-layout";
import { CatalogoPdv } from "@/components/pdv/catalogo-pdv";
import { DialogoAdicionais } from "@/components/pdv/dialogo-adicionais";
import { FaixaPedidos } from "@/components/pdv/faixa-pedidos";
import { PainelNovoPedido } from "@/components/pdv/painel-novo-pedido";
import { PainelPedido } from "@/components/pdv/painel-pedido";
import { numeroPedido } from "@/components/pdv/status";
import { useNovoPedido } from "@/components/pdv/use-novo-pedido";
import { useConfirmacao } from "@/components/shared/confirmacao";
import { PageHeader } from "@/components/shared/page-header";
import { DialogoPagamento } from "@/components/shared/payment-dialog";
import { SeletorCliente } from "@/components/shared/seletor-cliente";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useSaldoPedido, useSessaoAberta } from "@/hooks/use-caixa";
import { useGruposAdicionais } from "@/hooks/use-catalogo";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePedidosDoDia, useRealtimeSalao } from "@/hooks/use-pedidos";
import { brl } from "@/lib/format";
import { useEmpresa, useEmpresaAtual } from "@/providers/empresa";
import type { GrupoAdicional, Produto } from "@/services/catalogo";

export const Route = createFileRoute("/pedidos")({
  validateSearch: (search: Record<string, unknown>): { comanda?: string } => {
    const comanda = search["comanda"];
    return typeof comanda === "string" && comanda !== "" ? { comanda } : {};
  },
  head: () => ({
    meta: [
      { title: "Pedidos — ARVON FOOD" },
      { name: "description", content: "Ponto de venda: crie, acompanhe e receba pedidos." },
      { property: "og:title", content: "Pedidos — ARVON FOOD" },
      {
        property: "og:description",
        content: "Ponto de venda: crie, acompanhe e receba pedidos.",
      },
    ],
  }),
  component: () => (
    <AppLayout module="pdv">
      <Pedidos />
    </AppLayout>
  ),
});

function Pedidos() {
  const { papel } = useEmpresaAtual();
  const { podeVer } = useEmpresa();
  const { comanda: comandaDaUrl } = Route.useSearch();
  const navigate = useNavigate({ from: "/pedidos" });
  const mobile = useIsMobile();
  const { confirmar, dialogo } = useConfirmacao();

  useRealtimeSalao();
  const pedidos = usePedidosDoDia();
  const grupos = useGruposAdicionais();
  const novo = useNovoPedido(comandaDaUrl ?? null);

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [painelAberto, setPainelAberto] = useState(false);
  const [escolhendo, setEscolhendo] = useState<Produto | null>(null);
  const [escolhendoCliente, setEscolhendoCliente] = useState(false);
  const [cobrando, setCobrando] = useState<string | null>(null);

  // Nota: controla apenas a interface. Quem pode receber é decidido pela
  // função `registrar_pagamento` no banco.
  const podeReceber = papel === "owner" || papel === "admin" || papel === "cashier";
  const sessao = useSessaoAberta({ habilitado: podeReceber });
  const saldoCobranca = useSaldoPedido(cobrando);
  const caixaAberto = podeReceber && !!sessao.data;

  const { carrinho } = novo;

  const gruposDoProduto = (produto: Produto): GrupoAdicional[] =>
    (grupos.data ?? [])
      .filter((g) => g.ativo && produto.grupoIds.includes(g.id))
      .map((g) => ({ ...g, opcoes: g.opcoes.filter((o) => o.ativo) }));

  const limparUrl = () => {
    if (comandaDaUrl) void navigate({ search: {}, replace: true });
  };

  const voltarAoRascunho = () => setSelecionadoId(null);

  const escolherProduto = (produto: Produto) => {
    voltarAoRascunho();
    if (gruposDoProduto(produto).length) setEscolhendo(produto);
    else carrinho.adicionar(produto);
  };

  const comecarDoZero = () => {
    novo.reiniciar();
    voltarAoRascunho();
    limparUrl();
  };

  const novoPedido = () => {
    if (carrinho.itens.length === 0) return comecarDoZero();
    confirmar({
      titulo: "Descartar o pedido em montagem?",
      descricao: "Os itens adicionados ainda não foram enviados e serão removidos.",
      acao: "Descartar",
      aoConfirmar: comecarDoZero,
    });
  };

  const selecionar = (pedidoId: string) => {
    setSelecionadoId(pedidoId);
    if (mobile) setPainelAberto(true);
  };

  const adicionarNaComanda = (comandaId: string) => {
    novo.mudarModo("MESA");
    novo.escolherComanda(comandaId);
    voltarAoRascunho();
  };

  // Vindo de Mesas com a tela já aberta, a comanda da URL vira o destino.
  const [comandaVista, setComandaVista] = useState(comandaDaUrl);
  if (comandaDaUrl !== comandaVista) {
    setComandaVista(comandaDaUrl);
    if (comandaDaUrl) adicionarNaComanda(comandaDaUrl);
  }

  const enviar = (receber: boolean) =>
    novo.enviar((pedidoId) => {
      setSelecionadoId(pedidoId);
      if (receber) setCobrando(pedidoId);
      limparUrl();
    });

  const painel = selecionadoId ? (
    <PainelPedido
      key={selecionadoId}
      pedidoId={selecionadoId}
      podeVerMesas={podeVer("mesas")}
      podeReceber={podeReceber}
      caixaAberto={caixaAberto}
      comandaAceitaPedidos={(id) => novo.mesasComComanda.some((m) => m.comandaId === id)}
      aoReceber={(p) => setCobrando(p.id)}
      aoAdicionarNaComanda={adicionarNaComanda}
      aoNovoPedido={novoPedido}
    />
  ) : (
    <PainelNovoPedido
      novo={novo}
      caixaAberto={caixaAberto}
      avisoCaixaFechado={podeReceber && sessao.isSuccess && !sessao.data}
      aoEscolherCliente={() => setEscolhendoCliente(true)}
      aoEnviar={enviar}
    />
  );

  const selecionado = pedidos.data?.find((p) => p.id === selecionadoId) ?? null;
  const mostrarNovo = !!selecionadoId || carrinho.itens.length > 0 || !!comandaDaUrl;

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader
        title="Pedidos"
        description="Monte, acompanhe e receba os pedidos do dia."
        actions={
          mostrarNovo ? (
            <Button onClick={novoPedido}>
              <Plus className="size-4" aria-hidden="true" /> Novo pedido
            </Button>
          ) : undefined
        }
      />

      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <FaixaPedidos pedidos={pedidos} selecionadoId={selecionadoId} aoSelecionar={selecionar} />
          <CatalogoPdv
            quantidadeDoProduto={carrinho.quantidadeDoProduto}
            aoEscolher={escolherProduto}
            aoDiminuir={(produto) => {
              voltarAoRascunho();
              carrinho.diminuirProduto(produto.id);
            }}
          />
        </div>

        {!mobile && (
          <aside
            aria-labelledby="titulo-painel"
            className="sticky top-20 h-[calc(100dvh-6.5rem)] overflow-hidden rounded-xl border border-border bg-card shadow-xs"
          >
            {painel}
          </aside>
        )}
      </div>

      {mobile && (
        <>
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 backdrop-blur">
            <Button
              size="operational"
              className="w-full justify-between"
              onClick={() => setPainelAberto(true)}
            >
              <span className="flex items-center gap-2">
                <ChevronUp aria-hidden="true" />
                {selecionado
                  ? `Pedido ${numeroPedido(selecionado.numero)}`
                  : carrinho.itens.length
                    ? `Ver pedido · ${carrinho.quantidadeTotal} ${carrinho.quantidadeTotal === 1 ? "item" : "itens"}`
                    : "Ver pedido"}
              </span>
              <span className="tabular-nums">
                {selecionado ? brl(selecionado.total) : brl(novo.total)}
              </span>
            </Button>
          </div>
          <Sheet open={painelAberto} onOpenChange={setPainelAberto}>
            <SheetContent
              side="bottom"
              className="h-[90dvh] gap-0 overflow-hidden rounded-t-2xl p-0"
              aria-describedby={undefined}
            >
              <SheetTitle className="sr-only">Pedido atual</SheetTitle>
              {painel}
            </SheetContent>
          </Sheet>
        </>
      )}

      <DialogoPagamento
        aberto={!!cobrando && !!saldoCobranca.data}
        aoMudarAberto={(aberto) => !aberto && setCobrando(null)}
        aoDesistir={() => {
          if (saldoCobranca.data) {
            toast.info(`Pedido #${saldoCobranca.data.numero} ficou a receber no Caixa.`);
          }
        }}
        titulo={`Receber pedido #${saldoCobranca.data?.numero ?? ""}`}
        saldo={saldoCobranca.data?.saldo ?? 0}
        alvo={cobrando ? { pedidoId: cobrando } : null}
      />

      <SeletorCliente
        aberto={escolhendoCliente}
        atualId={novo.cliente?.id ?? null}
        aoFechar={() => setEscolhendoCliente(false)}
        aoEscolher={(escolhido) => {
          novo.escolherCliente(escolhido);
          setEscolhendoCliente(false);
        }}
      />
      <DialogoAdicionais
        key={escolhendo?.id ?? "nenhum"}
        produto={escolhendo}
        grupos={escolhendo ? gruposDoProduto(escolhendo) : []}
        aoFechar={() => setEscolhendo(null)}
        aoAdicionar={(adicionais, observacoes) => {
          if (escolhendo) carrinho.adicionar(escolhendo, adicionais, observacoes);
          setEscolhendo(null);
        }}
      />
      {dialogo}
    </div>
  );
}
