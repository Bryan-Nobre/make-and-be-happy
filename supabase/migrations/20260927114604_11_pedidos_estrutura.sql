-- ============================================================
-- ARVON FOOD - Comandas, pedidos e itens
--
-- Mesa -> Comanda -> Pedidos -> Itens (PRD 9).
-- O pedido carrega DOIS status independentes: operacional e
-- financeiro. Pagar não entrega, entregar não paga (PRD 8).
--
-- Colunas de autoria referenciam membros_empresa por id simples,
-- porque `on delete set null` não funciona em chave composta que
-- inclui empresa_id (coluna NOT NULL). O vínculo com a empresa
-- correta é garantido pelas RPCs, únicas autorizadas a escrever.
-- ============================================================

create type public.origem_pedido as enum ('BALCAO', 'MESA');

create type public.status_operacional_pedido as enum (
  'DRAFT', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'
);

create type public.status_financeiro_pedido as enum (
  'UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'
);

create type public.status_comanda as enum (
  'OPEN', 'PAYMENT_PENDING', 'PAID', 'CLOSED', 'CANCELLED'
);

-- ------------------------------------------------------------
-- comandas
-- ------------------------------------------------------------
create table public.comandas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  numero bigint not null,
  mesa_id uuid not null,
  cliente_id uuid,
  pessoas integer check (pessoas is null or pessoas between 1 and 100),
  status public.status_comanda not null default 'OPEN',
  -- Snapshot da taxa vigente na abertura: mudar a configuração depois
  -- não deve reescrever contas antigas (PRD 22).
  taxa_servico_percentual numeric(5, 2) not null default 0
    check (taxa_servico_percentual >= 0 and taxa_servico_percentual <= 100),
  observacoes text check (observacoes is null or length(observacoes) <= 500),
  aberta_por uuid references public.membros_empresa (id) on delete set null,
  aberta_em timestamptz not null default now(),
  conta_pedida_em timestamptz,
  fechada_em timestamptz,
  cancelada_por uuid references public.membros_empresa (id) on delete set null,
  motivo_cancelamento text,
  client_request_id uuid,
  atualizado_em timestamptz not null default now(),
  constraint comandas_empresa_id_key unique (empresa_id, id),
  constraint comandas_numero_unico unique (empresa_id, numero),
  constraint comandas_mesa_fk foreign key (empresa_id, mesa_id)
    references public.mesas (empresa_id, id) on delete restrict,
  constraint comandas_cliente_fk foreign key (empresa_id, cliente_id)
    references public.clientes (empresa_id, id) on delete restrict,
  constraint comandas_cancelamento_com_motivo check (
    status <> 'CANCELLED' or length(btrim(coalesce(motivo_cancelamento, ''))) >= 3
  )
);

-- A regra central do salão: uma mesa nunca tem duas contas abertas (PRD 9).
create unique index comandas_uma_aberta_por_mesa
  on public.comandas (mesa_id)
  where status in ('OPEN', 'PAYMENT_PENDING', 'PAID');

create unique index comandas_idempotencia
  on public.comandas (empresa_id, client_request_id)
  where client_request_id is not null;

create index comandas_empresa_status_idx on public.comandas (empresa_id, status);
create index comandas_mesa_idx on public.comandas (empresa_id, mesa_id);

-- ------------------------------------------------------------
-- pedidos
-- ------------------------------------------------------------
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  numero bigint not null,
  origem public.origem_pedido not null,
  comanda_id uuid,
  cliente_id uuid,
  status_operacional public.status_operacional_pedido not null default 'DRAFT',
  status_financeiro public.status_financeiro_pedido not null default 'UNPAID',
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  desconto numeric(12, 2) not null default 0 check (desconto >= 0),
  acrescimo numeric(12, 2) not null default 0 check (acrescimo >= 0),
  total numeric(12, 2) generated always as (subtotal - desconto + acrescimo) stored,
  valor_pago numeric(12, 2) not null default 0 check (valor_pago >= 0),
  observacoes text check (observacoes is null or length(observacoes) <= 500),
  criado_por uuid references public.membros_empresa (id) on delete set null,
  criado_em timestamptz not null default now(),
  confirmado_em timestamptz,
  preparo_em timestamptz,
  pronto_em timestamptz,
  entregue_em timestamptz,
  cancelado_em timestamptz,
  cancelado_por uuid references public.membros_empresa (id) on delete set null,
  motivo_cancelamento text,
  client_request_id uuid,
  atualizado_em timestamptz not null default now(),
  constraint pedidos_empresa_id_key unique (empresa_id, id),
  constraint pedidos_numero_unico unique (empresa_id, numero),
  constraint pedidos_comanda_fk foreign key (empresa_id, comanda_id)
    references public.comandas (empresa_id, id) on delete restrict,
  constraint pedidos_cliente_fk foreign key (empresa_id, cliente_id)
    references public.clientes (empresa_id, id) on delete restrict,
  -- Pedido de mesa exige comanda; pedido de balcão não pode ter (PRD 9).
  constraint pedidos_origem_coerente check (
    (origem = 'MESA' and comanda_id is not null)
    or (origem = 'BALCAO' and comanda_id is null)
  ),
  constraint pedidos_desconto_ate_subtotal check (desconto <= subtotal),
  constraint pedidos_cancelamento_com_motivo check (
    status_operacional <> 'CANCELLED'
    or length(btrim(coalesce(motivo_cancelamento, ''))) >= 3
  )
);

create unique index pedidos_idempotencia
  on public.pedidos (empresa_id, client_request_id)
  where client_request_id is not null;

create index pedidos_comanda_idx on public.pedidos (empresa_id, comanda_id);
create index pedidos_cozinha_idx on public.pedidos (empresa_id, status_operacional, criado_em);
create index pedidos_empresa_criado_idx on public.pedidos (empresa_id, criado_em desc);

-- ------------------------------------------------------------
-- itens_pedido
-- nome_produto e preco_unitario são snapshots: alterar o cadastro
-- depois não pode reescrever o histórico de vendas (PRD 7 e 22).
-- ------------------------------------------------------------
create table public.itens_pedido (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  pedido_id uuid not null,
  produto_id uuid not null,
  nome_produto text not null,
  preco_unitario numeric(12, 2) not null check (preco_unitario >= 0),
  quantidade numeric(12, 3) not null check (quantidade > 0),
  adicionais_total numeric(12, 2) not null default 0 check (adicionais_total >= 0),
  total numeric(12, 2) generated always as
    (round(quantidade * (preco_unitario + adicionais_total), 2)) stored,
  observacoes text check (observacoes is null or length(observacoes) <= 280),
  setor_id uuid,
  nome_setor text,
  -- Momento em que o item foi para a produção. Itens lançados depois
  -- do envio aparecem destacados na cozinha.
  enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  constraint itens_pedido_empresa_id_key unique (empresa_id, id),
  constraint itens_pedido_fk foreign key (empresa_id, pedido_id)
    references public.pedidos (empresa_id, id) on delete cascade,
  constraint itens_produto_fk foreign key (empresa_id, produto_id)
    references public.produtos (empresa_id, id) on delete restrict,
  constraint itens_setor_fk foreign key (empresa_id, setor_id)
    references public.setores_cozinha (empresa_id, id) on delete restrict
);

create index itens_pedido_idx on public.itens_pedido (empresa_id, pedido_id);
create index itens_produto_idx on public.itens_pedido (empresa_id, produto_id);

-- ------------------------------------------------------------
-- item_pedido_adicional
-- ------------------------------------------------------------
create table public.item_pedido_adicional (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  item_pedido_id uuid not null,
  opcao_id uuid not null,
  nome_grupo text not null,
  nome_opcao text not null,
  preco numeric(12, 2) not null check (preco >= 0),
  constraint ipa_empresa_id_key unique (empresa_id, id),
  constraint ipa_item_fk foreign key (empresa_id, item_pedido_id)
    references public.itens_pedido (empresa_id, id) on delete cascade,
  constraint ipa_opcao_fk foreign key (empresa_id, opcao_id)
    references public.opcoes_adicionais (empresa_id, id) on delete restrict
);

create index ipa_item_idx on public.item_pedido_adicional (empresa_id, item_pedido_id);

-- ------------------------------------------------------------
-- historico_status_pedido
-- Toda transição fica registrada com quem fez e quando (PRD 10).
-- ------------------------------------------------------------
create table public.historico_status_pedido (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  pedido_id uuid not null,
  de public.status_operacional_pedido,
  para public.status_operacional_pedido not null,
  motivo text,
  membro_id uuid references public.membros_empresa (id) on delete set null,
  criado_em timestamptz not null default now(),
  constraint hsp_pedido_fk foreign key (empresa_id, pedido_id)
    references public.pedidos (empresa_id, id) on delete cascade
);

create index hsp_pedido_idx on public.historico_status_pedido (empresa_id, pedido_id, id);
