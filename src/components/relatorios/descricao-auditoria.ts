import { brl } from "@/lib/format";
import { PAPEL_LABEL, type Papel } from "@/lib/permissoes";
import { METODO_LABEL } from "@/services/configuracoes";
import type { CategoriaAuditoria } from "@/services/relatorios";
import type { Json } from "@/types/db";

export const CATEGORIA_LABEL: Record<CategoriaAuditoria, string> = {
  pedidos: "Pedidos",
  comandas: "Comandas",
  caixa: "Caixa",
  pagamentos: "Pagamentos",
  estoque: "Estoque",
  catalogo: "Catálogo",
  equipe: "Equipe",
  empresa: "Empresa",
};

export const ACAO_LABEL: Record<string, string> = {
  "empresa.criada": "Empresa criada",
  "empresa.atualizada": "Dados da empresa alterados",
  "convite.criado": "Convite enviado",
  "convite.cancelado": "Convite cancelado",
  "convite.aceito": "Convite aceito",
  "membro.papel_alterado": "Papel de membro alterado",
  "membro.reativado": "Membro reativado",
  "membro.desativado": "Membro desativado",
  "produto.preco_alterado": "Preço alterado",
  "produto.disponibilidade_alterada": "Disponibilidade alterada",
  "produto.ficha_tecnica": "Ficha técnica alterada",
  "pedido.cancelado": "Pedido cancelado",
  "pedido.item_adicionado_apos_envio": "Item adicionado após envio",
  "pedido.item_alterado_apos_envio": "Item alterado após envio",
  "pedido.item_removido_apos_envio": "Item removido após envio",
  "pedido.valores_aplicados": "Desconto/acréscimo aplicado",
  "pedido.valores_alterados": "Desconto/acréscimo alterado",
  "comanda.transferida": "Comanda transferida",
  "comanda.cancelada": "Comanda cancelada",
  "comanda.reaberta": "Comanda reaberta",
  "comanda.cliente_definido": "Cliente da comanda alterado",
  "caixa.aberto": "Caixa aberto",
  "caixa.fechado": "Caixa fechado",
  "caixa.sangria": "Sangria",
  "caixa.suprimento": "Suprimento",
  "pagamento.registrado": "Pagamento registrado",
  "pagamento.estornado": "Pagamento estornado",
  "estoque.item_criado": "Item de estoque criado",
  "estoque.ajuste": "Ajuste de estoque",
  "estoque.saida_manual": "Saída manual de estoque",
};

/** Ações que merecem destaque visual: tiram dinheiro, desfazem venda ou mexem em permissão. */
export const ACOES_SENSIVEIS = new Set([
  "pedido.cancelado",
  "comanda.cancelada",
  "pagamento.estornado",
  "caixa.sangria",
  "membro.papel_alterado",
  "produto.preco_alterado",
]);

type Dados = Record<string, Json | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const texto = (d: Dados, k: string) => {
  const v = d[k];
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
};
const numero = (d: Dados, k: string) => {
  const v = d[k];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const dinheiro = (d: Dados, k: string) => {
  const n = numero(d, k);
  return n === null ? "" : brl(n);
};
const quantidade = (d: Dados, k: string) => numero(d, k)?.toLocaleString("pt-BR") ?? "?";
const papel = (d: Dados, k: string) => PAPEL_LABEL[texto(d, k) as Papel] ?? texto(d, k);
const motivo = (d: Dados, k = "motivo") => (texto(d, k) ? `motivo: ${texto(d, k)}` : "");
const juntar = (...partes: string[]) => partes.filter(Boolean).join(" · ");

/** Último recurso para ações sem descrição própria. Ids técnicos ficam de fora. */
function generico(d: Dados): string {
  return Object.entries(d)
    .filter(
      ([, v]) => v !== null && typeof v !== "object" && !(typeof v === "string" && UUID.test(v)),
    )
    .map(([k, v]) => `${k.replaceAll("_", " ")}: ${String(v)}`)
    .join(" · ");
}

function camposAlterados(d: Dados): string {
  const antes = d["antes"];
  const depois = d["depois"];
  if (!antes || !depois || typeof antes !== "object" || typeof depois !== "object") return "";
  if (Array.isArray(antes) || Array.isArray(depois)) return "";
  const chaves = Object.keys(depois).filter(
    (k) => JSON.stringify(antes[k]) !== JSON.stringify(depois[k]),
  );
  return chaves.length ? `Campos: ${chaves.map((k) => k.replaceAll("_", " ")).join(", ")}` : "";
}

function variacao(d: Dados, rotulo: string, antes: string, depois: string): string {
  const a = numero(d, antes);
  const b = numero(d, depois);
  if (a === null || b === null || a === b) return "";
  return `${rotulo} de ${brl(a)} para ${brl(b)}`;
}

/**
 * Frase legível do registro. Sempre vira texto puro na tela: os dados vêm do
 * banco, mas podem conter texto digitado por usuários (motivos, nomes).
 */
export function descreverAuditoria(acao: string, dados: Json | null): string {
  if (dados === null || typeof dados !== "object" || Array.isArray(dados)) return "";
  const d: Dados = dados;

  switch (acao) {
    case "empresa.criada":
      return texto(d, "nome");
    case "empresa.atualizada":
      return camposAlterados(d);
    case "convite.criado":
    case "convite.aceito":
      return texto(d, "papel") ? `Papel: ${papel(d, "papel")}` : "";
    case "membro.papel_alterado":
      return `De ${papel(d, "antes")} para ${papel(d, "depois")}`;
    case "produto.preco_alterado":
      return `${texto(d, "nome")}: de ${dinheiro(d, "antes")} para ${dinheiro(d, "depois")}`;
    case "produto.disponibilidade_alterada": {
      const estado =
        d["ativo"] === false
          ? "desativado"
          : d["disponivel"] === false
            ? "indisponível"
            : "disponível";
      return `${texto(d, "nome")}: ${estado}`;
    }
    case "produto.ficha_tecnica": {
      const n = Array.isArray(d["insumos"]) ? d["insumos"].length : 0;
      return `${texto(d, "produto")}: ${n} ${n === 1 ? "insumo" : "insumos"}`;
    }
    case "pedido.cancelado":
      return juntar(`Pedido #${texto(d, "numero")}`, dinheiro(d, "total"), motivo(d));
    case "pedido.item_adicionado_apos_envio":
    case "pedido.item_alterado_apos_envio":
    case "pedido.item_removido_apos_envio":
      return juntar(
        `Pedido #${texto(d, "pedido")}`,
        `${texto(d, "produto")}: quantidade de ${quantidade(d, "quantidade_antes")} para ${quantidade(d, "quantidade_depois")}`,
      );
    case "pedido.valores_aplicados":
      return juntar(
        numero(d, "desconto") ? `Desconto ${dinheiro(d, "desconto")}` : "",
        numero(d, "acrescimo") ? `Acréscimo ${dinheiro(d, "acrescimo")}` : "",
      );
    case "pedido.valores_alterados":
      return juntar(
        `Pedido #${texto(d, "numero")}`,
        variacao(d, "desconto", "desconto_antes", "desconto_depois"),
        variacao(d, "acréscimo", "acrescimo_antes", "acrescimo_depois"),
      );
    case "comanda.transferida":
      return `Comanda ${texto(d, "comanda")}: de ${texto(d, "de")} para ${texto(d, "para")}`;
    case "comanda.cancelada":
      return juntar(`Comanda ${texto(d, "comanda")}`, dinheiro(d, "total"), motivo(d));
    case "comanda.reaberta":
      return juntar(
        `Comanda ${texto(d, "comanda")}`,
        numero(d, "valor_pago") ? `já pago ${dinheiro(d, "valor_pago")}` : "",
      );
    case "comanda.cliente_definido":
      return `Comanda ${texto(d, "comanda")}: cliente ${d["removido"] === true ? "removido" : "vinculado"}`;
    case "caixa.aberto":
      return juntar(`Caixa ${texto(d, "caixa")}`, `fundo de troco ${dinheiro(d, "valor_inicial")}`);
    case "caixa.fechado": {
      const diferenca = numero(d, "diferenca") ?? 0;
      return juntar(
        `Caixa ${texto(d, "caixa")}`,
        diferenca === 0 ? "sem diferença" : `diferença de ${brl(diferenca)}`,
        texto(d, "justificativa") ? `justificativa: ${texto(d, "justificativa")}` : "",
      );
    }
    case "caixa.sangria":
    case "caixa.suprimento":
      return juntar(`Caixa ${texto(d, "caixa")}`, dinheiro(d, "valor"), texto(d, "motivo"));
    case "pagamento.registrado": {
      const partes = numero(d, "partes") ?? 1;
      return juntar(
        texto(d, "referencia"),
        dinheiro(d, "valor"),
        partes > 1 ? `em ${partes} formas` : "",
      );
    }
    case "pagamento.estornado": {
      const metodo = METODO_LABEL[texto(d, "metodo") as keyof typeof METODO_LABEL] ?? "";
      return juntar(texto(d, "referencia"), dinheiro(d, "valor"), metodo, motivo(d));
    }
    case "estoque.item_criado":
      return juntar(texto(d, "nome"), `saldo inicial ${quantidade(d, "saldo_inicial")}`);
    case "estoque.ajuste":
    case "estoque.saida_manual":
      return juntar(
        `${texto(d, "item")}: de ${quantidade(d, "saldo_anterior")} para ${quantidade(d, "saldo_resultante")}`,
        texto(d, "motivo"),
      );
    default:
      return generico(d);
  }
}
