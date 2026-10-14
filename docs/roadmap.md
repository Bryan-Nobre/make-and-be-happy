# Roadmap do ARVON FOOD

Status de cada fase, em sequência. A visão de produto completa está no [PRD](./prd.md) (seção 35).

Legenda: ✅ concluído · 🟡 parcial · ⏳ próximo passo · ⬜ não iniciado

---

## V1 — Operação principal ✅

| Fase | Conteúdo | Status |
|---|---|---|
| 1. Fundação | Supabase, empresas, membros, convites, auditoria, RLS, login/cadastro/onboarding, guarda de rota | ✅ |
| 2. Catálogo | Categorias, setores, produtos, adicionais, mesas, clientes, formas de pagamento, configurações, Storage | ✅ |
| 3. Comandas e pedidos | Abrir mesa, comanda, pedidos, cozinha (KDS), transferência, cancelamento | ✅ |
| 4. Caixa e pagamentos | Abertura/fechamento, sangria, suprimento, pagamentos parciais e idempotentes | ✅ |
| 5. Estoque e relatórios | Estoque por movimentações, dashboard, relatórios, auditoria, remoção dos dados de exemplo | ✅ |

### Redesigns de interface

| Tela | Status |
|---|---|
| Pedidos / PDV | ✅ |
| Mesas (lista, mapa do salão, comanda em diálogo) | ✅ |
| Cozinha | ⬜ |

---

## V1.1 — Offline, melhorias, auditoria, realtime 🟡

### Offline

| Etapa | Conteúdo | Status |
|---|---|---|
| Auditoria técnica | Levantamento de riscos e limitações do offline | ✅ |
| Fundação (somente leitura) | Service worker (PWA), IndexedDB por usuário + empresa, cache das consultas, detector de conexão, indicador no header, limpeza no logout | ✅ |
| Fila de pedidos | Criar pedido sem internet; envio automático e sem duplicidade; estados pendente / sincronizando / sincronizado / erro / conflito; tela de Pendências; logout bloqueado com pendências | ✅ |
| Pedidos pendentes na comanda | Pedidos feitos offline aparecem na comanda da mesa, fora do total oficial | ✅ |
| Abrir mesa offline | Abrir comanda sem internet e lançar pedido nela; tratar mesa aberta em outro aparelho (lançar na comanda já aberta ou descartar) | ✅ |
| Demais ações offline | Pedir conta offline (com "desfazer" enquanto não enviado). Transferir, cancelar, encerrar, reabrir, pagamento, caixa, estoque e cadastros continuam exigindo internet (decisão de escopo) | ✅ |

Limitações conhecidas do offline:
- A cozinha (em qualquer aparelho, inclusive no mesmo) só mostra o pedido depois que o servidor o aceita.
- Mesa aberta offline recebe o horário de abertura do momento do envio.
- Número do pedido, valor final e baixa de estoque só existem depois do envio (o servidor recalcula tudo).
- Sair da conta sem internet não funciona (o Supabase exige rede).
- Telas nunca abertas no aparelho não abrem offline.

### Demais itens da V1.1

| Item | Status |
|---|---|
| Melhorias de operação | ⬜ |
| Auditoria (tela de consulta; o registro no banco já existe desde a V1) | 🟡 |
| Realtime (já usado em salão, cozinha e caixa; melhorias pendentes) | 🟡 |

---

## Próximas versões ⬜

| Versão | Conteúdo |
|---|---|
| V1.2 | Cardápio digital, QR Code |
| V1.3 | WhatsApp |
| V1.4 | IA + WhatsApp |
| V2 | iFood |
| V2.1 | NFC-e, TEF, integrações fiscais |
