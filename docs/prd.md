Documento de Requisitos do Produto (PRD) — ARVON FOOD
Versão: 1.0
Produto: ARVON FOOD
Tipo: SaaS de gestão para restaurantes
Nomenclatura: PT-BR
Arquitetura: Multi-tenant desde o início
1. Visão Geral
O ARVON FOOD é uma plataforma SaaS de gestão operacional para restaurantes, inicialmente direcionada a pequenos restaurantes, lanchonetes, pizzarias, espetinhos e estabelecimentos similares.
O sistema centraliza as principais operações do estabelecimento em uma única plataforma:
- vendas no balcão;
- mesas;
- comandas;
- pedidos;
- cozinha;
- caixa;
- produtos;
- estoque;
- clientes;
- relatórios;
- usuários e permissões.
O princípio central do produto é:
Completo por dentro, simples por fora.

O sistema deve permitir que o proprietário gerencie a operação sem precisar aprender uma interface complexa.
O primeiro restaurante utilizado para validação será o Restaurante Sabor da Casa, porém a arquitetura não deve ser construída especificamente para ele. O produto deve estar preparado desde o início para atender múltiplas empresas.
2. Objetivos do Produto
2.1 Simplicidade operacional
Reduzir a quantidade de passos necessários para realizar operações comuns, principalmente:
- registrar uma venda;
- abrir uma mesa;
- criar uma comanda;
- enviar pedido para cozinha;
- receber pagamento;
- movimentar o caixa;
- consultar estoque.
2.2 Gestão integrada
As informações devem estar conectadas.
Exemplo:
Venda
  ↓
Pedido
  ↓
Itens
  ↓
Produtos
  ↓
Estoque
  ↓
Caixa
  ↓
Relatórios

Uma operação não deve exigir que o usuário registre manualmente a mesma informação em vários lugares.
2.3 Velocidade
As operações mais frequentes devem exigir poucos cliques e respostas rápidas.
2.4 Experiência superior
A interface deve priorizar:
- clareza;
- hierarquia visual;
- feedback imediato;
- estados claros;
- baixa complexidade;
- responsividade;
- acessibilidade.
2.5 Escalabilidade
A arquitetura deve permitir que o produto evolua posteriormente para:
- múltiplos terminais;
- delivery;
- cardápio digital;
- WhatsApp;
- IA;
- iFood;
- NFC-e;
- TEF;
- múltiplos setores de cozinha;
- relatórios avançados.
Essas funcionalidades não fazem parte do MVP inicial.
3. Público-Alvo Inicial
O ARVON FOOD será inicialmente direcionado para:
- pequenos restaurantes;
- lanchonetes;
- pizzarias;
- espetinhos;
- marmitarias;
- pequenos estabelecimentos com atendimento no balcão e/ou mesas.
O produto não deve ser projetado inicialmente como um ERP complexo para grandes redes.
4. Stack Tecnológica
Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React
Backend
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Realtime
- Edge Functions quando necessário
Estado e dados
- TanStack Query
- React Context somente quando fizer sentido para estado global local
Formulários
- React Hook Form
- Zod
Arquitetura
Frontend
   ↓
Supabase
   ↓
PostgreSQL
   ↓
RLS

Arquitetura multi-tenant:
                    ARVON FOOD
                         │
                  Supabase/PostgreSQL
                         │
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
      Empresa A      Empresa B      Empresa C
          │              │              │
       Usuários       Usuários       Usuários
          │              │              │
        Dados          Dados          Dados

O isolamento entre empresas deve ser garantido pelo banco através de RLS, e não apenas pelo frontend.
5. Perfis de Usuário
O sistema terá inicialmente cinco papéis:
Perfil	Função
owner	Proprietário da empresa
admin	Administrador/gerente
cashier	Operador de caixa
waiter	Garçom
kitchen	Cozinha


Owner
Acesso total à empresa.
Admin
Acesso administrativo e operacional amplo, respeitando permissões específicas.
Cashier
Principalmente:
- PDV;
- recebimentos;
- caixa;
- pedidos.
Não pode acessar configurações administrativas sensíveis.
Waiter
Principalmente:
- mesas;
- comandas;
- pedidos.
Não pode:
- receber pagamentos;
- realizar sangria;
- alterar configurações financeiras;
- conceder descontos administrativos;
- cancelar operações sem autorização.
Kitchen
Acesso exclusivamente operacional à cozinha/KDS.
Não deve visualizar informações financeiras desnecessárias.
6. Estrutura Principal da Aplicação
A aplicação autenticada terá:
Dashboard
PDV
Mesas
Cozinha
Caixa
Produtos
Estoque
Clientes
Relatórios
Configurações

Navegação lateral no desktop e navegação adaptada para dispositivos menores.
7. Módulo PDV
Objetivo
Permitir registrar vendas realizadas diretamente no balcão.
Fluxo principal
Novo pedido
    ↓
Selecionar categoria
    ↓
Selecionar produto
    ↓
Definir quantidade
    ↓
Adicionar observação/adicionais
    ↓
Revisar pedido
    ↓
Desconto/acréscimo, quando permitido
    ↓
Enviar para cozinha
    ↓
Preparação
    ↓
Pagamento
    ↓
Finalização

Layout
Desktop:
┌─────────────────────────────────────────────┐
│ Cabeçalho / contexto                        │
├──────────────┬────────────────┬─────────────┤
│ Categorias   │ Produtos       │ Pedido      │
│              │                │ atual       │
│             │                │             │
└──────────────┴────────────────┴─────────────┘

Mobile:
A interface deve reorganizar os elementos para priorizar:
1. categorias;
2. produtos;
3. pedido atual;
4. pagamento.
Regras
- Pedido não pode ser finalizado vazio.
- Quantidade deve ser maior que zero.
- Produto inativo não pode ser vendido.
- Preço utilizado na venda deve ser armazenado como snapshot.
- Após o envio para cozinha, itens não devem ser silenciosamente alterados.
- Alterações posteriores devem gerar histórico/auditoria.
- Pedido cancelado nunca deve ser simplesmente excluído.
- Cancelamento exige motivo.
- Desconto depende de permissão.
- Acréscimo deve ser separado do desconto.
- Pagamento não altera o estado operacional do pedido.
8. Status do Pedido
O pedido deve possuir dois estados independentes.
Status operacional
DRAFT
  ↓
CONFIRMED
  ↓
PREPARING
  ↓
READY
  ↓
DELIVERED

Cancelamento:
DRAFT
CONFIRMED
PREPARING
   ↓
CANCELLED

Status financeiro
UNPAID
   ↓
PARTIALLY_PAID
   ↓
PAID

Possível estado posterior:
PAID
 ↓
REFUNDED

Pagamento não deve marcar o pedido como entregue.
Um pedido pode estar:
operacional: PREPARING
financeiro: PAID

Isso é válido.
9. Mesas e Comandas
A estrutura conceitual será:
Mesa
  ↓
Comanda
  ↓
Pedidos
  ↓
Itens

Uma mesa não é uma comanda.
Uma comanda pode possuir múltiplos pedidos.
Estados da mesa
LIVRE
OCUPADA
AGUARDANDO PAGAMENTO

Após encerramento:
LIVRE

Estados da comanda
OPEN
 ↓
PAYMENT_PENDING
 ↓
PAID
 ↓
CLOSED

Ou:
CANCELLED

Abertura
Ao abrir uma mesa:
1. selecionar mesa;
2. informar quantidade de pessoas, opcional/obrigatória conforme regra definida;
3. criar comanda;
4. adicionar pedidos.
Regras
- Uma mesa só pode possuir uma comanda aberta.
- Não permitir abrir mesa já ocupada.
- Transferência só pode ocorrer com comanda aberta.
- Destino da transferência deve estar livre.
- O histórico da comanda permanece após fechamento.
- Pagamento parcial mantém a comanda aberta.
- Não permitir encerramento com saldo pendente.
- Não permitir fechamento enquanto existirem pedidos ainda em produção.
10. Cozinha — KDS
Objetivo
Exibir os pedidos enviados para preparação.
Fluxo:
PDV/Mesa
   ↓
Pedido enviado
   ↓
NOVOS
   ↓
EM PREPARO
   ↓
PRONTOS
   ↓
ENTREGUES

Interface
Três colunas principais:
┌──────────────┬──────────────┬──────────────┐
│ NOVOS        │ EM PREPARO   │ PRONTOS      │
├──────────────┼──────────────┼──────────────┤
│ Pedido #101  │ Pedido #98   │ Pedido #95   │
│ Mesa 04      │ Balcão       │ Mesa 02      │
│              │              │              │
│ 2x Hambúrguer│ 1x Pizza     │ 2x X-Burger  │
└──────────────┴──────────────┴──────────────┘

Cada pedido deve mostrar:
- número;
- origem;
- mesa/comanda, quando aplicável;
- horário;
- tempo de espera;
- itens;
- quantidades;
- observações.
Regras
- Cozinha não acessa informações financeiras desnecessárias.
- Status deve seguir transições válidas.
- Cancelamentos devem ser registrados.
- O sistema deve armazenar timestamps das mudanças.
- Estrutura deve permitir múltiplos setores no futuro.
- MVP possui uma cozinha principal.
Regra definitiva do KDS no MVP
1. Um pedido com itens de produção segue:
NOVOS → EM PREPARO → PRONTOS → ENTREGUES → sai do KDS.
2. Pagamento nunca remove um pedido da Cozinha.
3. Produtos configurados como "Não envia para a cozinha" não aparecem em nenhum KDS.
4. Se um pedido tiver somente itens que não exigem produção:
- não deve ficar preso em "Novos";
- pedido de balcão pode seguir diretamente para Entregue;
- pedido de mesa pode ficar disponível para entrega e ser marcado como Entregue pelo fluxo de Mesas.
5. Pedidos com itens de setores diferentes continuam usando o status do pedido inteiro neste MVP.
Exemplo:
Cozinha = X-Burger
Bar = Coca-Cola
Se um setor avançar o pedido, o status compartilhado avança nos dois painéis.
Evolução futura (fora do MVP): status individual por item/setor no KDS.
11. Caixa
Objetivo
Controlar a sessão financeira operacional do estabelecimento.
Estados
OPEN
CLOSING
CLOSED

Abertura
Registrar:
- responsável;
- valor inicial;
- observação;
- terminal.
A abertura gera uma movimentação de caixa.
Formas de pagamento
- dinheiro;
- PIX;
- débito;
- crédito.
O sistema deve permitir pagamento dividido.
Exemplo:
Total: R$ 100,00

Dinheiro: R$ 40,00
PIX:      R$ 60,00

Sangria
A sangria reduz o dinheiro físico disponível.
Não pode exceder o valor físico esperado.
Suprimento
Adiciona dinheiro ao caixa.
Fechamento
Mostrar:
Dinheiro esperado
Dinheiro informado
Diferença
PIX
Débito
Crédito
Total vendido

Se existir diferença, exigir justificativa.
Regra
Um caixa fechado é imutável.
Correções devem ocorrer através de movimentações apropriadas, nunca alterando o histórico original.
12. Produtos
Objetivo
Centralizar o catálogo utilizado por:
- PDV;
- mesas;
- cozinha;
- estoque;
- futuro cardápio digital.
Estrutura
Empresa
  ↓
Categorias
  ↓
Produtos
  ↓
Grupos de adicionais
  ↓
Opções

Produto
Campos principais:
- nome;
- categoria;
- descrição;
- preço;
- imagem;
- código;
- disponibilidade;
- setor da cozinha;
- adicionais;
- status ativo/inativo.
Regras
A disponibilidade comercial é diferente do estoque.
Exemplo:
Produto: X-Burger
Disponível: NÃO
Estoque: 50 pães

O produto pode estar manualmente indisponível mesmo possuindo estoque.
Produtos utilizados em históricos não devem ser fisicamente excluídos.
Utilizar desativação.
13. Adicionais
O produto poderá possuir grupos de adicionais.
Exemplo:
Hambúrguer
 ├── Queijo
 │    ├── Cheddar
 │    └── Mussarela
 │
 └── Molho
      ├── Barbecue
      └── Especial

Cada grupo deve permitir configurar:
- obrigatório/opcional;
- quantidade mínima;
- quantidade máxima;
- opções disponíveis;
- preço adicional.
O backend deve validar essas regras.
14. Estoque
Objetivo
Controlar o estoque operacional do restaurante.
O módulo não será inicialmente um ERP completo.
Item de estoque
Campos:
- nome;
- categoria;
- unidade;
- quantidade atual;
- quantidade mínima;
- código;
- status.
Unidades iniciais:
- unidade;
- kg;
- g;
- L;
- ml;
- caixa;
- pacote.
Movimentações
Tipos:
ENTRADA
SAÍDA
AJUSTE

Cada movimentação deve registrar:
- item;
- quantidade;
- motivo;
- observação;
- usuário;
- data;
- origem;
- saldo resultante.
Regras
O saldo não deve ser editado diretamente.
A alteração deve ocorrer através de movimentações.
Não permitir estoque negativo no MVP.
O estoque deverá futuramente estar conectado às fichas técnicas.
Exemplo:
Produto
   ↓
Ficha técnica
   ↓
Ingredientes
   ↓
Itens de estoque

Essa estrutura permitirá posteriormente calcular consumo, custo e CMV.
15. Clientes
Objetivo
Manter informações básicas dos clientes.
Dados:
- nome;
- telefone;
- email;
- observações;
- histórico de pedidos.
O módulo inicialmente será simples.
Não incluir no MVP:
- programa de fidelidade;
- cashback;
- pontos;
- cupons;
- campanhas avançadas.
16. Dashboard
O dashboard deve apresentar uma visão rápida da operação.
Informações iniciais:
- vendas do dia;
- quantidade de pedidos;
- ticket médio;
- mesas ocupadas;
- caixa atual;
- produtos com estoque baixo;
- pedidos em preparo.
O dashboard deve priorizar informações operacionais e evitar excesso de gráficos.
17. Relatórios
Relatórios iniciais:
Vendas
- vendas por período;
- quantidade de pedidos;
- faturamento;
- ticket médio;
- formas de pagamento.
Produtos
- produtos mais vendidos;
- quantidade vendida;
- faturamento por produto.
Caixa
- movimentações;
- abertura;
- sangrias;
- suprimentos;
- fechamento.
Estoque
- entradas;
- saídas;
- ajustes;
- itens abaixo do mínimo.
Relatórios financeiros e contábeis avançados ficam fora do MVP.
18. Configurações
Configurações iniciais:
Empresa
- nome;
- telefone;
- endereço;
- logo;
- dados básicos.
Usuários
- usuários;
- funções;
- permissões.
Operação
- mesas;
- categorias;
- setores;
- formas de pagamento;
- taxa de serviço.
Sistema
- preferências;
- aparência;
- configurações gerais.
19. Modelo de Dados
Diferentemente do NoCode Folio, o ARVON FOOD não deve concentrar dados polimórficos em uma única tabela JSONB.
A operação possui entidades relacionais fortes e regras transacionais. Portanto, o modelo deve privilegiar tabelas relacionais, constraints, FKs e RLS.
Principais tabelas
empresas
membros_empresa

categorias
produtos

grupos_adicionais
opcoes_adicionais
produto_grupo_adicional

setores_cozinha

mesas
comandas

pedidos
itens_pedido
item_pedido_adicional
envios_cozinha

pagamentos

sessoes_caixa
movimentacoes_caixa

itens_estoque
movimentacoes_estoque

clientes

auditoria

20. Multi-Tenant
Toda informação empresarial deve estar vinculada à empresa.
Exemplo:
empresas
   │
   ├── membros_empresa
   ├── categorias
   ├── produtos
   ├── mesas
   ├── comandas
   ├── pedidos
   ├── caixa
   ├── estoque
   └── clientes

As tabelas de negócio devem possuir empresa_id quando necessário para:
- isolamento;
- performance;
- RLS;
- integridade.
Além disso, relações importantes devem impedir referências cruzadas entre empresas.
Exemplo conceitual:
empresa_id + produto_id

não pode apontar para um produto pertencente a outra empresa.
21. Identificadores
Para entidades internas:
- UUID como identificador técnico.
Para números operacionais:
- sequência por empresa.
Exemplo:
Pedido #1001
Pedido #1002
Pedido #1003

A sequência deve ser controlada pelo banco.
Nunca gerar números definitivos apenas no navegador.
22. Idempotência
Operações críticas devem possuir mecanismos contra duplicação.
Principalmente:
- criação de pedidos;
- pagamentos;
- movimentações;
- abertura de caixa;
- fechamento;
- operações de estoque.
Usar client_request_id/chave de idempotência quando necessário.
Isso evita, por exemplo:
Clique
 ↓
Pagamento criado
 ↓
Internet oscila
 ↓
Usuário clica novamente
 ↓
Pagamento duplicado

23. Segurança — RLS
A segurança será implementada no PostgreSQL utilizando Row Level Security.
O frontend nunca deve ser considerado uma camada de segurança suficiente.
A lógica conceitual será:
auth.uid()
   ↓
membros_empresa
   ↓
empresa_id
   ↓
dados da empresa

Cada usuário só poderá acessar dados das empresas às quais pertence.
As permissões também devem ser validadas no backend.
Não confiar em:
role === "owner"

apenas no frontend.
24. Auditoria
Operações importantes devem gerar registros de auditoria.
Exemplos:
- cancelamento de pedido;
- alteração de preço;
- desconto;
- transferência de mesa;
- abertura/fechamento de caixa;
- sangria;
- ajuste de estoque;
- reembolso;
- alteração de permissões.
A auditoria deve registrar:
usuário
ação
entidade
entidade_id
data
dados relevantes

25. Estoque e Vendas
O estoque não deve ser alterado diretamente pelo frontend.
A operação deve seguir:
Venda confirmada
      ↓
Itens vendidos
      ↓
Ficha técnica
      ↓
Movimentação de estoque
      ↓
Novo saldo

No MVP, a dedução automática deverá ocorrer quando o pedido for confirmado/enviado para produção, conforme a regra operacional definida para o produto.
Cancelamentos devem possuir mecanismo de reversão quando o estoque já tiver sido consumido.
26. Pagamentos e Caixa
Um pagamento só pode ser registrado se existir uma sessão de caixa válida.
Fluxo:
Pedido
 ↓
Pagamento
 ↓
Sessão de caixa aberta
 ↓
Movimentação de caixa

O pagamento e sua movimentação financeira devem ser registrados atomicamente.
Não permitir:
- pagamento acima do saldo devido;
- pagamento de pedido cancelado;
- pagamento duplicado;
- pagamento sem caixa aberto.
Troco só pode existir para pagamento em dinheiro.
27. Offline
O produto deverá evoluir para suportar operação offline, mas o offline não precisa existir em todos os módulos no primeiro momento.
Prioridade:
PDV
Pedidos
Mesas
Caixa

Arquitetura futura:
ARVON FOOD
     │
     ├── Supabase
     │
     └── IndexedDB
             │
         Fila de sincronização
             │
          Supabase

O sistema deverá conseguir identificar:
- operação pendente;
- sincronização;
- conflito;
- erro de sincronização.
Não implementar offline completo de todos os módulos no MVP.
28. Realtime
O Supabase Realtime será utilizado posteriormente principalmente para:
- KDS;
- pedidos;
- mesas;
- atualizações operacionais;
- caixa quando necessário.
Exemplo:
Garçom envia pedido
       ↓
Supabase
       ↓
Realtime
       ↓
KDS atualiza

O frontend não deve depender de polling constante quando o Realtime for aplicável.
29. Responsividade
O sistema deve funcionar em:
- desktop;
- notebook;
- tablet;
- celular.
Prioridades:
Desktop
Principal ambiente administrativo e caixa.
Tablet
Principalmente garçom e operação.
Celular
Operações rápidas e consulta.
Touch targets devem ser adequados para utilização em dispositivos móveis.
30. Identidade Visual
O ARVON FOOD deve possuir uma identidade própria antes da implementação visual definitiva.
O produto deve transmitir:
- tecnologia;
- confiança;
- simplicidade;
- velocidade;
- organização;
- profissionalismo.
Evitar:
- visual excessivamente futurista;
- excesso de gradientes;
- neon exagerado;
- interfaces visualmente carregadas;
- excesso de efeitos.
A identidade deve ser moderna e limpa, adequada a um SaaS profissional para restaurantes.
31. Design System
O design system existente da ARVON será utilizado como base estrutural, adaptado posteriormente à identidade do ARVON FOOD.
Princípios:
- clareza;
- consistência;
- acessibilidade;
- responsividade;
- velocidade;
- confiança.
Componentes devem ser reutilizáveis:
Button
Input
Select
Dialog
Card
Badge
Table
Tabs
Toast
Dropdown
Sidebar
PageHeader
DataTable
EmptyState
LoadingState
ErrorState

Não criar componentes diferentes para a mesma função sem necessidade.
32. Estados da Interface
Todos os módulos devem possuir estados claros.
Loading
Carregando pedidos...

Empty
Nenhum pedido encontrado.

Error
Não foi possível carregar os pedidos.
Tentar novamente

Success
Feedback após ações importantes.
Permission denied
Você não possui permissão para realizar esta ação.

Offline
Mostrar claramente quando uma operação estiver aguardando sincronização.
33. Acessibilidade
Seguir WCAG 2.2 AA sempre que aplicável.
Priorizar:
- navegação por teclado;
- foco visível;
- contraste;
- labels;
- semântica HTML;
- feedback textual;
- áreas de toque adequadas;
- suporte a redução de movimento.
34. Funcionalidades Fora do MVP
Não implementar inicialmente:
- iFood;
- WhatsApp;
- IA;
- NFC-e;
- TEF;
- integração com maquininhas;
- impressoras fiscais;
- múltiplas cozinhas;
- múltiplos depósitos;
- fornecedores;
- compras;
- DRE;
- contas a pagar;
- contas a receber;
- conciliação bancária;
- fidelidade;
- cashback;
- cupons;
- delivery avançado;
- QR Code de pedidos;
- reservas;
- múltiplas empresas no mesmo usuário como fluxo avançado.
A arquitetura deve permitir essas funcionalidades posteriormente, mas elas não devem aumentar a complexidade do MVP.
35. Roadmap
V1 — Operação principal
PDV
Mesas
Comandas
Cozinha
Caixa
Produtos
Estoque
Usuários/permissões

V1.1
Offline
Melhorias de operação
Auditoria
Realtime

V1.2
Cardápio digital
QR Code

V1.3
WhatsApp

V1.4
IA + WhatsApp

V2
iFood

V2.1
NFC-e
TEF
Integrações fiscais

36. Princípios de Desenvolvimento
O desenvolvedor deve seguir estas regras:
1. Não confiar no frontend para segurança.
2. Não duplicar regras críticas apenas no frontend.
3. Toda regra financeira deve ser validada no backend.
4. Toda empresa deve estar isolada por RLS.
5. Pedidos não devem ser apagados para corrigir operações.
6. Pagamentos não alteram o estado operacional do pedido.
7. Produtos históricos devem permanecer disponíveis para consulta.
8. Estoque deve ser alterado através de movimentações.
9. Operações críticas devem possuir auditoria.
10. Operações críticas devem ser idempotentes.
11. Valores financeiros devem ser calculados no servidor.
12. Não adicionar funcionalidades fora do escopo sem necessidade.
13. Priorizar o fluxo operacional mais simples possível.
14. Usar componentes reutilizáveis.
15. Preservar responsividade e acessibilidade.
37. Regra Principal do Produto
Toda decisão de UX e arquitetura deve responder à seguinte pergunta:
Isso torna a operação do restaurante mais simples, rápida e confiável?

Se uma funcionalidade adicionar complexidade sem resolver um problema operacional real, ela deve ser reconsiderada.