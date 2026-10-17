import { brl, dateTime, time } from "@/lib/format";
import type { Empresa } from "@/services/empresas";
import type { ItemDoPedido, PedidoDetalhado, TicketCozinha } from "@/services/pedidos";

function esc(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Dispara a impressão do sistema sem abrir pop-up (iframe oculto).
 * Evita o bloqueio de janelas que vários navegadores aplicam ao `window.open`.
 */
export function imprimirHtml(titulo: string, corpo: string): void {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${esc(titulo)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font: 13px/1.35 ui-monospace, "Cascadia Mono", "Segoe UI Mono", Menlo, Consolas, monospace;
      color: #111;
      background: #fff;
    }
    .ticket { max-width: 320px; margin: 0 auto; }
    h1 { font-size: 16px; margin: 0 0 4px; text-align: center; }
    h2 { font-size: 14px; margin: 12px 0 6px; text-align: center; letter-spacing: 0.04em; }
    .muted { color: #444; font-size: 12px; text-align: center; }
    .linha { border: 0; border-top: 1px dashed #999; margin: 10px 0; }
    .meta { font-size: 12px; }
    .meta div { display: flex; justify-content: space-between; gap: 8px; }
    .item { margin: 8px 0; }
    .item-topo { display: flex; justify-content: space-between; gap: 8px; font-weight: 700; }
    .sub { margin: 2px 0 0 1.2em; font-size: 12px; color: #333; }
    .totais div { display: flex; justify-content: space-between; gap: 8px; margin: 3px 0; }
    .totais .grande { font-size: 15px; font-weight: 700; margin-top: 6px; }
    .rodape { margin-top: 14px; text-align: center; font-size: 11px; color: #555; }
    @media print {
      body { padding: 0; }
      .ticket { max-width: none; width: 72mm; }
    }
  </style>
</head>
<body>
  <div class="ticket">${corpo}</div>
</body>
</html>`;

  document.querySelectorAll("iframe[data-arvon-impressao]").forEach((el) => el.remove());

  const iframe = document.createElement("iframe");
  iframe.setAttribute("data-arvon-impressao", "1");
  iframe.setAttribute("title", titulo);
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error("Não foi possível preparar a impressão neste navegador.");
  }

  doc.open();
  doc.write(html);
  doc.close();

  const limpar = () => {
    win.removeEventListener("afterprint", limpar);
    iframe.remove();
  };
  win.addEventListener("afterprint", limpar);

  // Garante que o documento do iframe terminou de montar antes do diálogo.
  const disparar = () => {
    try {
      win.focus();
      win.print();
    } catch {
      limpar();
      throw new Error("Não foi possível abrir o diálogo de impressão.");
    }
    // Fallback se `afterprint` não existir (alguns mobile).
    window.setTimeout(limpar, 60_000);
  };

  if (doc.readyState === "complete") {
    window.setTimeout(disparar, 50);
  } else {
    iframe.addEventListener("load", () => window.setTimeout(disparar, 50), { once: true });
  }
}

function cabecalhoEmpresa(empresa: Pick<Empresa, "nome" | "cnpj" | "telefone" | "endereco">): string {
  const partes = [
    `<h1>${esc(empresa.nome)}</h1>`,
    empresa.cnpj ? `<div class="muted">CNPJ ${esc(empresa.cnpj)}</div>` : "",
    empresa.telefone ? `<div class="muted">${esc(empresa.telefone)}</div>` : "",
    empresa.endereco ? `<div class="muted">${esc(empresa.endereco)}</div>` : "",
  ];
  return partes.filter(Boolean).join("");
}

function destinoPedido(entrada: {
  origem: string;
  nomeMesa: string | null;
  comandaNumero: number | null;
  identificacao: string | null;
}): string {
  if (entrada.origem === "MESA") {
    const mesa = entrada.nomeMesa ?? "Mesa";
    const comanda = entrada.comandaNumero ? ` · Comanda #${entrada.comandaNumero}` : "";
    return `${mesa}${comanda}`;
  }
  return entrada.identificacao?.trim()
    ? `Balcão · ${entrada.identificacao.trim()}`
    : "Balcão";
}

function blocoItensCozinha(
  itens: {
    quantidade: number;
    nomeProduto: string;
    adicionais: string[];
    observacoes: string | null;
    nomeSetor?: string | null;
    adicionadoDepois?: boolean;
  }[],
): string {
  return itens
    .map((i) => {
      const extras = [
        ...i.adicionais.map((a) => `<div class="sub">+ ${esc(a)}</div>`),
        i.observacoes ? `<div class="sub">Obs: ${esc(i.observacoes)}</div>` : "",
        i.nomeSetor ? `<div class="sub">${esc(i.nomeSetor)}</div>` : "",
        i.adicionadoDepois ? `<div class="sub">* item novo</div>` : "",
      ]
        .filter(Boolean)
        .join("");
      return `<div class="item">
        <div class="item-topo"><span>${i.quantidade}× ${esc(i.nomeProduto)}</span></div>
        ${extras}
      </div>`;
    })
    .join("");
}

function blocoItensRecibo(itens: ItemDoPedido[]): string {
  return itens
    .map((i) => {
      const extras = [
        ...i.adicionais.map((a) => `<div class="sub">+ ${esc(a)}</div>`),
        i.observacoes ? `<div class="sub">Obs: ${esc(i.observacoes)}</div>` : "",
      ]
        .filter(Boolean)
        .join("");
      return `<div class="item">
        <div class="item-topo">
          <span>${i.quantidade}× ${esc(i.nomeProduto)}</span>
          <span>${esc(brl(i.total))}</span>
        </div>
        ${extras}
      </div>`;
    })
    .join("");
}

/** Comanda de produção (cozinha) — sem preços. */
export function imprimirComandaCozinha(
  ticket: TicketCozinha,
  empresa: Pick<Empresa, "nome">,
): void {
  const destino = destinoPedido(ticket);
  const corpo = `
    <h1>${esc(empresa.nome)}</h1>
    <h2>COMANDA COZINHA</h2>
    <div class="muted">Pedido #${ticket.numero}</div>
    <div class="muted">${esc(destino)}</div>
    <div class="muted">${esc(time(ticket.enviadoEm))} · ${esc(dateTime(ticket.enviadoEm))}</div>
    <hr class="linha" />
    ${blocoItensCozinha(ticket.itens)}
    ${
      ticket.observacoes
        ? `<hr class="linha" /><div class="meta"><strong>Obs. pedido:</strong> ${esc(ticket.observacoes)}</div>`
        : ""
    }
    <div class="rodape">Arvon Food · uso interno</div>
  `;
  imprimirHtml(`Comanda #${ticket.numero}`, corpo);
}

/** Comanda a partir do pedido detalhado do PDV (itens sem destacar preço na cozinha). */
export function imprimirComandaDoPedido(
  pedido: PedidoDetalhado,
  empresa: Pick<Empresa, "nome">,
): void {
  const destino = destinoPedido(pedido);
  const corpo = `
    <h1>${esc(empresa.nome)}</h1>
    <h2>COMANDA COZINHA</h2>
    <div class="muted">Pedido #${pedido.numero}</div>
    <div class="muted">${esc(destino)}</div>
    <div class="muted">${esc(dateTime(pedido.criadoEm))}</div>
    <hr class="linha" />
    ${blocoItensCozinha(
      pedido.itens.map((i) => ({
        quantidade: i.quantidade,
        nomeProduto: i.nomeProduto,
        adicionais: i.adicionais,
        observacoes: i.observacoes,
      })),
    )}
    ${
      pedido.observacoes
        ? `<hr class="linha" /><div class="meta"><strong>Obs. pedido:</strong> ${esc(pedido.observacoes)}</div>`
        : ""
    }
    <div class="rodape">Arvon Food · uso interno</div>
  `;
  imprimirHtml(`Comanda #${pedido.numero}`, corpo);
}

/** Recibo do cliente (não é cupom fiscal). */
export function imprimirReciboPedido(
  pedido: PedidoDetalhado,
  empresa: Pick<Empresa, "nome" | "cnpj" | "telefone" | "endereco">,
): void {
  const destino = destinoPedido(pedido);
  const saldo = Math.max(0, pedido.total - pedido.valorPago);
  const totais = [
    `<div><span>Subtotal</span><span>${esc(brl(pedido.subtotal))}</span></div>`,
    pedido.desconto > 0
      ? `<div><span>Desconto</span><span>- ${esc(brl(pedido.desconto))}</span></div>`
      : "",
    pedido.acrescimo > 0
      ? `<div><span>Acréscimo</span><span>+ ${esc(brl(pedido.acrescimo))}</span></div>`
      : "",
    `<div class="grande"><span>Total</span><span>${esc(brl(pedido.total))}</span></div>`,
    pedido.valorPago > 0
      ? `<div><span>Pago</span><span>${esc(brl(pedido.valorPago))}</span></div>`
      : "",
    saldo > 0 ? `<div><span>Saldo</span><span>${esc(brl(saldo))}</span></div>` : "",
  ]
    .filter(Boolean)
    .join("");

  const corpo = `
    ${cabecalhoEmpresa(empresa)}
    <h2>RECIBO</h2>
    <div class="muted">Pedido #${pedido.numero} · ${esc(destino)}</div>
    ${pedido.nomeCliente ? `<div class="muted">${esc(pedido.nomeCliente)}</div>` : ""}
    <div class="muted">${esc(dateTime(pedido.criadoEm))}</div>
    <hr class="linha" />
    ${blocoItensRecibo(pedido.itens)}
    <hr class="linha" />
    <div class="totais">${totais}</div>
    <div class="rodape">Documento não fiscal · Arvon Food</div>
  `;
  imprimirHtml(`Recibo #${pedido.numero}`, corpo);
}

/** Recibo simplificado da comanda da mesa (itens já consolidados). */
export function imprimirReciboComanda(entrada: {
  empresa: Pick<Empresa, "nome" | "cnpj" | "telefone" | "endereco">;
  nomeMesa: string;
  comandaNumero: number;
  nomeCliente: string | null;
  pessoas: number;
  subtotal: number;
  taxaServico: number;
  total: number;
  valorPago: number;
  itens: { quantidade: number; nomeProduto: string; total: number; adicionais: string[] }[];
}): void {
  const saldo = Math.max(0, entrada.total - entrada.valorPago);
  const itensHtml = entrada.itens
    .map((i) => {
      const extras = i.adicionais.map((a) => `<div class="sub">+ ${esc(a)}</div>`).join("");
      return `<div class="item">
        <div class="item-topo">
          <span>${i.quantidade}× ${esc(i.nomeProduto)}</span>
          <span>${esc(brl(i.total))}</span>
        </div>
        ${extras}
      </div>`;
    })
    .join("");

  const totais = [
    `<div><span>Subtotal</span><span>${esc(brl(entrada.subtotal))}</span></div>`,
    entrada.taxaServico > 0
      ? `<div><span>Taxa de serviço</span><span>${esc(brl(entrada.taxaServico))}</span></div>`
      : "",
    `<div class="grande"><span>Total</span><span>${esc(brl(entrada.total))}</span></div>`,
    entrada.valorPago > 0
      ? `<div><span>Pago</span><span>${esc(brl(entrada.valorPago))}</span></div>`
      : "",
    saldo > 0 ? `<div><span>Saldo</span><span>${esc(brl(saldo))}</span></div>` : "",
  ]
    .filter(Boolean)
    .join("");

  const corpo = `
    ${cabecalhoEmpresa(entrada.empresa)}
    <h2>RECIBO</h2>
    <div class="muted">${esc(entrada.nomeMesa)} · Comanda #${entrada.comandaNumero}</div>
    ${entrada.nomeCliente ? `<div class="muted">${esc(entrada.nomeCliente)}</div>` : ""}
    <div class="muted">${entrada.pessoas} ${entrada.pessoas === 1 ? "pessoa" : "pessoas"}</div>
    <div class="muted">${esc(dateTime(new Date().toISOString()))}</div>
    <hr class="linha" />
    ${itensHtml}
    <hr class="linha" />
    <div class="totais">${totais}</div>
    <div class="rodape">Documento não fiscal · Arvon Food</div>
  `;
  imprimirHtml(`Recibo comanda #${entrada.comandaNumero}`, corpo);
}
