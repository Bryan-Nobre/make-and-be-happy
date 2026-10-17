# Status do produto — Arvon Food

Documento para alinhar o que já existe, como funciona no dia a dia e o que ainda falta — em especial as integrações com coisas de fora do sistema (impressora, maquininha, iFood, etc.).

Última atualização: outubro/2026  
Complementa o [PRD](./prd.md) e o [roadmap](./roadmap.md).

---

## Em uma frase

O Arvon Food já cobre a **operação do restaurante** (venda, mesa, cozinha, caixa, estoque, equipe).  
Ainda **não** imprime recibo sozinho, **não** fala com maquininha/NF-e e **não** importa pedidos do iFood/WhatsApp — isso entra nas próximas versões.

---

## Como o restaurante usa o sistema hoje

Fluxo típico:

```text
Cliente pede
    ↓
PDV ou mesa/comanda
    ↓
Pedido vai para a cozinha
    ↓
Cliente paga no caixa (ou no PDV)
    ↓
Estoque e relatórios acompanham
```

Cada restaurante é uma **empresa** isolada. Quem entra é **membro** com um perfil (proprietário, admin, caixa, garçom, cozinha). Uma empresa não vê dados da outra.

---

## O que já temos (e como funciona)

### Conta, empresa e equipe

| O quê | Para o usuário | Por baixo dos panos (leve) |
| ----- | -------------- | -------------------------- |
| Login / cadastro | Entra com e-mail e senha | Supabase Auth |
| Onboarding | Cria o restaurante e vira dono | RPC segura no banco |
| Convites | Gera **link** (copiar ou WhatsApp). **Não manda e-mail** | Registro em `convites` + token; a pessoa aceita em `/aceitar-convite` com o mesmo e-mail |
| Perfis | Dono, admin, caixa, garçom, cozinha | UI esconde botões; **RLS/RPC** bloqueiam de verdade |

### Vendas e salão

| O quê | Para o usuário | Por baixo dos panos (leve) |
| ----- | -------------- | -------------------------- |
| PDV / Pedidos | Monta pedido no balcão ou liga a uma mesa, envia à cozinha, cobra | Pedido com estado operacional + estado financeiro separados |
| Balcão | Pode informar **nome para chamar** | Campo `identificacao` no pedido |
| Mesas e comandas | Abre mesa → comanda → pedidos; pede conta; transferir comanda para outra mesa | Uma mesa só com uma comanda aberta; regras no banco |
| Cozinha (KDS) | Filas por setor; avança status (preparando → pronto…) | Realtime por empresa; telas atualizam quase ao vivo |
| Caixa | Abre/fecha sessão, sangria, suprimento, recebe (parcial / vários métodos) | Pagamento + movimentação juntos; saldo vem das movimentações, não de “digitar o total” |

### Cadastros e gestão

| O quê | Para o usuário | Por baixo dos panos (leve) |
| ----- | -------------- | -------------------------- |
| Produtos | Categorias, produtos, adicionais, setores da cozinha, fotos | Storage para imagens; preços atuais no cadastro; pedido guarda snapshot do que foi vendido |
| Estoque | Ajustes por **movimentação**; alerta de baixo estoque | Não dá para “só mudar o número” na mão sem histórico |
| Clientes | Cadastro e histórico de pedidos | Isolado por empresa |
| Relatórios | Vendas, caixa, estoque | Consultas no servidor |
| Auditoria | Quem fez o quê (cancelar, pagar, convite…) | Tabela de auditoria; não depende do log do navegador |
| Configurações | Dados da empresa, mesas, formas de pagamento, equipe | Só gestor altera o sensível (UI + banco) |
| Ajuda | Guias rápidos das rotinas | Textos estáticos |

### Offline e tempo real

**Offline (parcial, de propósito):** sem internet dá para abrir mesa, criar pedido e pedir conta. Isso fica numa fila no aparelho e sobe quando a rede volta. Pagamento, caixa, estoque, transferência e cadastros **exigem internet**.

**Realtime:** salão, cozinha e caixa recebem atualizações da própria empresa — útil com vários celulares/tablets ao mesmo tempo.

---

## O que está incompleto ou parcial

| Item | Situação | Comentário |
| ---- | -------- | ---------- |
| Impressão de recibos / comandas | **Não iniciado no código** | O roadmap ainda cita “código pronto”; na prática ainda não há tela/serviço de impressão. Ver seção de integrações. |
| Mover pedidos entre comandas / juntar mesas | Não feito | Transferir a **comanda inteira** de mesa já existe; falta mover itens ou unir mesas. |
| Balcão “senha para chamar” | Só o **nome** | Roadmap menciona nome/senha; senha de chamada ainda não existe. |
| Convite por e-mail | Não envia | Fluxo atual = link + WhatsApp manual. E-mail real exigiria provedor (ex.: Resend) + função no servidor. |
| Offline amplo | Limitado de propósito | Cozinha só vê o pedido depois que o servidor aceita; número do pedido e estoque só depois da sync. |
| WhatsApp de produto | Só link de convite | Pedidos/avisos via WhatsApp Business são V1.3. |
| Cardápio digital / QR | Não feito | V1.2. |
| iFood, NF-e, TEF, maquininha | Não feito | V2 / V2.1 — ver abaixo. |

Fora do escopo atual (de propósito, para não virar ERP cedo demais): compras, fornecedores, DRE, contas a pagar/receber, fidelidade, delivery avançado, reservas, etc. (detalhe no PRD §34).

---

## Integrações externas — o que falta e como deve funcionar

Esta é a parte que mais depende de **aparelhos e serviços de fora**. A ideia do produto é: o Arvon Food continua sendo o “cérebro” da operação; as máquinas e apps entram como **canais** ou **impressoras**, sem o usuário ter que digitar a mesma coisa duas vezes.

### 1. Impressora de recibo / comanda (próximo passo operacional)

**Para o restaurante**

- Ao confirmar pedido na cozinha ou ao pagar, o sistema manda imprimir:
  - comanda da cozinha (itens, mesa/nome, observações);
  - recibo do cliente (itens, total, forma de pagamento).
- Em geral é impressora **térmica** USB, rede ou Bluetooth no caixa/cozinha.
- No primeiro cliente, a expectativa é: configurar a impressora uma vez e o fluxo “pedido → papel” virar automático (ou um botão claro “Imprimir”).

**Por baixo dos panos (leve)**

- O navegador sozinho não controla bem impressora térmica em todos os ambientes.
- Caminhos comuns:
  - **agente local** no PC do caixa (pequeno programa que recebe o job e manda para a impressora);
  - ou serviço de impressão em nuvem + driver no local;
  - layout do cupom gerado a partir do pedido/pagamento já gravados no servidor (fonte da verdade).
- Relatórios fiscais **não** são a mesma coisa que recibo interno — ver NFC-e abaixo.

**Status hoje:** planejado na V1.1; **ainda sem implementação no app**.

---

### 2. Maquininha de cartão (TEF / pinpad)

**Para o restaurante**

- No pagamento, em vez de só marcar “Cartão R$ 50”, o sistema pode **abrir a cobrança na maquininha**.
- Aprovado → registra pagamento no Arvon Food; negado → não marca como pago.
- Evita divergência entre o que a maquininha cobrou e o que o caixa anotou.

**Por baixo dos panos (leve)**

- Integração com o provedor da maquininha (Stone, PagSeguro, etc.) via API/SDK **no servidor** ou terminal autorizado — nunca com chaves secretas no celular do garçom.
- O pagamento no Arvon Food só fecha depois da confirmação do adquirente (com idempotência: um clique repetido não cobra duas vezes).

**Status hoje:** fora do MVP; previsto na **V2.1**.

---

### 3. Nota / cupom fiscal (NFC-e e afins)

**Para o restaurante**

- Depois (ou junto) do pagamento, emitir cupom fiscal válido para a SEFAZ, quando o estabelecimento precisar.
- O recibo “bonitinho” da impressora térmica ≠ documento fiscal.

**Por baixo dos panos (leve)**

- Certificado digital, autorização na SEFAZ, numeração, cancelamento — quase sempre via **parceiro fiscal** ou API especializada.
- O Arvon Food envia os dados da venda já calculados no servidor; o parceiro devolve o XML/PDF/chave de acesso.
- Falha de emissão não pode “inventar” um pago fiscalmente; estados de emissão ficam separados do “cliente já pagou na loja”.

**Status hoje:** fora do MVP; previsto na **V2.1**.

---

### 4. WhatsApp (pedidos e avisos)

**Para o restaurante**

- Cliente manda pedido ou tira dúvida no WhatsApp; o pedido entra no mesmo fluxo de cozinha/caixa.
- Avisos: “seu pedido saiu”, “mesa pronta”, etc.

**Por baixo dos panos (leve)**

- WhatsApp Business API (Meta / BSP oficial), não o `wa.me` do convite de equipe.
- Mensagens entram como eventos → viram pedido/comanda no banco, com as mesmas regras de estoque e pagamento.
- Hoje só usamos WhatsApp como **atalho para compartilhar o link de convite** da equipe.

**Status hoje:** V1.3 (produto); IA por cima disso na V1.4.

---

### 5. iFood (e apps de delivery)

**Para o restaurante**

- Pedido que chega no iFood aparece no Arvon Food (cozinha + valores), sem redigitar.
- Aceitar/recusar/atualizar status pode refletir nos dois lados, conforme a integração.

**Por baixo dos panos (leve)**

- API do iFood (ou agregador), webhooks no servidor, mapeamento de produtos/cardápio.
- Origem do pedido deixa de ser só `BALCAO` / `MESA` — entra canal delivery, sem misturar regras de mesa.

**Status hoje:** V2; delivery avançado ainda fora do núcleo atual.

---

### 6. Cardápio digital + QR (autoatendimento leve)

**Para o cliente / salão**

- QR na mesa abre o cardápio; em versões mais avançadas, o cliente monta o pedido (com regras do restaurante).

**Por baixo dos panos (leve)**

- Página pública ou autenticada por token da mesa/comanda, sempre amarrada à empresa certa (multi-tenant).
- Pedidos passam pelas mesmas validações do PDV.

**Status hoje:** V1.2.

---

### 7. E-mail transacional (convites, comprovantes)

**Para o usuário**

- Convite chega na caixa de entrada; opcionalmente recibo/resumo por e-mail.

**Por baixo dos panos (leve)**

- Provedor (Resend, SendGrid…) com chave **só no servidor**; templates; domínio verificado.
- Não confundir com o e-mail de login do Supabase Auth (confirmação de conta).

**Status hoje:** não implementado; convite = link manual.

---

## Mapa rápido: agora × depois

```text
HOJE (operação)
  PDV · Mesas · Cozinha · Caixa · Estoque · Relatórios · Equipe · Offline parcial · Realtime

QUASE (V1.1 restante)
  Impressão térmica · Juntar/mover mesas-pedidos

DEPOIS
  V1.2  Cardápio / QR
  V1.3  WhatsApp (pedidos/avisos)
  V1.4  IA + WhatsApp
  V2    iFood
  V2.1  NFC-e · TEF · fiscal
```

---

## Princípios que não mudam com as integrações

1. **O sistema (banco) manda** — impressora, maquininha e iFood não reescrevem preço/estoque sozinhos.
2. **Cada restaurante isolado** — integração de um cliente não vaza dados para outro.
3. **Pagamento ≠ entrega** — pagar não marca pedido como entregue automaticamente.
4. **Não apagar venda para “desfazer”** — cancela com motivo e auditoria.
5. **Segredos fora do app** — chaves de maquininha, fiscal e WhatsApp API ficam no servidor.

---

## Onde olhar no repositório

| Documento | Uso |
| --------- | --- |
| [prd.md](./prd.md) | Visão completa do produto e exclusões do MVP |
| [roadmap.md](./roadmap.md) | Status por fase (✅ 🟡 ⬜) |
| Este arquivo | Leitura rápida “o que temos / o que falta / integrações” |

Quando um item deste documento for entregue, atualize também o `roadmap.md` e a data no topo desta página.
