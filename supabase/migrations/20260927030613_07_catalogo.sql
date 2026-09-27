-- ============================================================
-- ARVON FOOD - Catálogo, mesas, clientes e formas de pagamento
--
-- Toda tabela carrega empresa_id e expõe UNIQUE (empresa_id, id),
-- para que as referências entre entidades usem chave estrangeira
-- composta e seja impossível apontar para outra empresa (PRD 20).
-- ============================================================

create type public.metodo_pagamento as enum ('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO');

-- ------------------------------------------------------------
-- categorias
-- ------------------------------------------------------------
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 60),
  ordem integer not null default 0 check (ordem >= 0),
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint categorias_empresa_id_key unique (empresa_id, id)
);

create unique index categorias_nome_unico on public.categorias (empresa_id, lower(btrim(nome)));
create index categorias_empresa_ordem_idx on public.categorias (empresa_id, ordem);

-- ------------------------------------------------------------
-- setores_cozinha
-- ------------------------------------------------------------
create table public.setores_cozinha (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 40),
  ordem integer not null default 0 check (ordem >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint setores_cozinha_empresa_id_key unique (empresa_id, id)
);

create unique index setores_nome_unico on public.setores_cozinha (empresa_id, lower(btrim(nome)));

-- ------------------------------------------------------------
-- produtos
-- `ativo` = existe no catálogo. `disponivel` = pode ser vendido agora.
-- São coisas diferentes e independentes do estoque (PRD 12).
-- ------------------------------------------------------------
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  categoria_id uuid not null,
  setor_id uuid,
  nome text not null check (length(btrim(nome)) between 2 and 120),
  descricao text check (descricao is null or length(descricao) <= 500),
  preco numeric(12, 2) not null check (preco >= 0),
  codigo text check (codigo is null or length(btrim(codigo)) between 1 and 30),
  imagem_url text,
  ativo boolean not null default true,
  disponivel boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint produtos_empresa_id_key unique (empresa_id, id),
  constraint produtos_categoria_fk foreign key (empresa_id, categoria_id)
    references public.categorias (empresa_id, id) on delete restrict,
  constraint produtos_setor_fk foreign key (empresa_id, setor_id)
    references public.setores_cozinha (empresa_id, id) on delete restrict
);

create unique index produtos_codigo_unico
  on public.produtos (empresa_id, upper(btrim(codigo)))
  where codigo is not null;

create index produtos_empresa_categoria_idx on public.produtos (empresa_id, categoria_id);
create index produtos_empresa_nome_idx on public.produtos (empresa_id, nome);

-- ------------------------------------------------------------
-- grupos_adicionais e opções
-- `obrigatorio` é derivado de `minimo` para não existirem dois
-- campos que possam se contradizer.
-- ------------------------------------------------------------
create table public.grupos_adicionais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 60),
  minimo integer not null default 0 check (minimo >= 0),
  maximo integer not null default 1 check (maximo >= 1),
  obrigatorio boolean generated always as (minimo >= 1) stored,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint grupos_adicionais_empresa_id_key unique (empresa_id, id),
  constraint grupos_adicionais_faixa check (minimo <= maximo)
);

create unique index grupos_adicionais_nome_unico
  on public.grupos_adicionais (empresa_id, lower(btrim(nome)));

create table public.opcoes_adicionais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  grupo_id uuid not null,
  nome text not null check (length(btrim(nome)) between 1 and 60),
  preco numeric(12, 2) not null default 0 check (preco >= 0),
  ordem integer not null default 0 check (ordem >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint opcoes_adicionais_empresa_id_key unique (empresa_id, id),
  constraint opcoes_grupo_fk foreign key (empresa_id, grupo_id)
    references public.grupos_adicionais (empresa_id, id) on delete cascade
);

create index opcoes_grupo_idx on public.opcoes_adicionais (empresa_id, grupo_id, ordem);

create table public.produto_grupo_adicional (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  produto_id uuid not null,
  grupo_id uuid not null,
  ordem integer not null default 0 check (ordem >= 0),
  primary key (produto_id, grupo_id),
  constraint pga_produto_fk foreign key (empresa_id, produto_id)
    references public.produtos (empresa_id, id) on delete cascade,
  constraint pga_grupo_fk foreign key (empresa_id, grupo_id)
    references public.grupos_adicionais (empresa_id, id) on delete cascade
);

create index pga_produto_idx on public.produto_grupo_adicional (empresa_id, produto_id, ordem);

-- ------------------------------------------------------------
-- mesas
-- ------------------------------------------------------------
create table public.mesas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 40),
  lugares integer not null default 4 check (lugares between 1 and 50),
  ordem integer not null default 0 check (ordem >= 0),
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint mesas_empresa_id_key unique (empresa_id, id)
);

create unique index mesas_nome_unico on public.mesas (empresa_id, lower(btrim(nome)));
create index mesas_empresa_ordem_idx on public.mesas (empresa_id, ordem);

-- ------------------------------------------------------------
-- clientes
-- ------------------------------------------------------------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 2 and 120),
  telefone text check (telefone is null or length(btrim(telefone)) between 8 and 20),
  email text check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'),
  observacoes text check (observacoes is null or length(observacoes) <= 500),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint clientes_empresa_id_key unique (empresa_id, id)
);

create index clientes_empresa_nome_idx on public.clientes (empresa_id, nome);
create index clientes_empresa_telefone_idx on public.clientes (empresa_id, telefone);

-- ------------------------------------------------------------
-- formas_pagamento
-- ------------------------------------------------------------
create table public.formas_pagamento (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  metodo public.metodo_pagamento not null,
  ativa boolean not null default true,
  ordem integer not null default 0 check (ordem >= 0),
  atualizado_em timestamptz not null default now(),
  primary key (empresa_id, metodo)
);

-- ------------------------------------------------------------
-- Triggers de atualizado_em
-- ------------------------------------------------------------
create trigger categorias_atualizado_em before update on public.categorias
  for each row execute function app.tg_atualizado_em();
create trigger setores_atualizado_em before update on public.setores_cozinha
  for each row execute function app.tg_atualizado_em();
create trigger produtos_atualizado_em before update on public.produtos
  for each row execute function app.tg_atualizado_em();
create trigger grupos_atualizado_em before update on public.grupos_adicionais
  for each row execute function app.tg_atualizado_em();
create trigger opcoes_atualizado_em before update on public.opcoes_adicionais
  for each row execute function app.tg_atualizado_em();
create trigger mesas_atualizado_em before update on public.mesas
  for each row execute function app.tg_atualizado_em();
create trigger clientes_atualizado_em before update on public.clientes
  for each row execute function app.tg_atualizado_em();
create trigger formas_pagamento_atualizado_em before update on public.formas_pagamento
  for each row execute function app.tg_atualizado_em();

-- ------------------------------------------------------------
-- Auditoria de preço e disponibilidade (PRD 24)
-- ------------------------------------------------------------
create or replace function app.tg_auditar_produto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.preco is distinct from new.preco then
    perform app.registrar_auditoria(
      new.empresa_id,
      'produto.preco_alterado',
      'produtos',
      new.id::text,
      jsonb_build_object('nome', new.nome, 'antes', old.preco, 'depois', new.preco)
    );
  end if;

  if old.ativo is distinct from new.ativo or old.disponivel is distinct from new.disponivel then
    perform app.registrar_auditoria(
      new.empresa_id,
      'produto.disponibilidade_alterada',
      'produtos',
      new.id::text,
      jsonb_build_object(
        'nome', new.nome,
        'ativo', new.ativo,
        'disponivel', new.disponivel
      )
    );
  end if;

  return new;
end;
$$;

create trigger produtos_auditoria
  after update on public.produtos
  for each row execute function app.tg_auditar_produto();

-- ------------------------------------------------------------
-- RLS
-- Leitura: qualquer membro ativo da empresa.
-- Escrita de catálogo e operação: owner/admin.
-- Clientes: owner/admin/cashier (módulo previsto para o caixa no PRD 5).
-- ------------------------------------------------------------
alter table public.categorias enable row level security;
alter table public.setores_cozinha enable row level security;
alter table public.produtos enable row level security;
alter table public.grupos_adicionais enable row level security;
alter table public.opcoes_adicionais enable row level security;
alter table public.produto_grupo_adicional enable row level security;
alter table public.mesas enable row level security;
alter table public.clientes enable row level security;
alter table public.formas_pagamento enable row level security;

do $$
declare
  v_tabela text;
  v_gestao text := 'array[''owner'', ''admin'']::public.papel_usuario[]';
begin
  foreach v_tabela in array array[
    'categorias', 'setores_cozinha', 'produtos', 'grupos_adicionais',
    'opcoes_adicionais', 'produto_grupo_adicional', 'mesas', 'formas_pagamento'
  ]
  loop
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated using (app.eh_membro(empresa_id))',
      v_tabela
    );
    execute format(
      'create policy %1$s_insert on public.%1$s for insert to authenticated with check (app.tem_papel(empresa_id, %2$s))',
      v_tabela, v_gestao
    );
    execute format(
      'create policy %1$s_update on public.%1$s for update to authenticated using (app.tem_papel(empresa_id, %2$s)) with check (app.tem_papel(empresa_id, %2$s))',
      v_tabela, v_gestao
    );
  end loop;
end $$;

-- Exclusão permitida apenas onde não existe histórico dependente; as chaves
-- estrangeiras com RESTRICT bloqueiam o resto. Produto nunca é excluído:
-- usa-se `ativo = false` (PRD 12 e 22).
create policy categorias_delete on public.categorias
  for delete to authenticated
  using (app.tem_papel(empresa_id, array['owner', 'admin']::public.papel_usuario[]));

create policy setores_cozinha_delete on public.setores_cozinha
  for delete to authenticated
  using (app.tem_papel(empresa_id, array['owner', 'admin']::public.papel_usuario[]));

create policy grupos_adicionais_delete on public.grupos_adicionais
  for delete to authenticated
  using (app.tem_papel(empresa_id, array['owner', 'admin']::public.papel_usuario[]));

create policy opcoes_adicionais_delete on public.opcoes_adicionais
  for delete to authenticated
  using (app.tem_papel(empresa_id, array['owner', 'admin']::public.papel_usuario[]));

create policy produto_grupo_adicional_delete on public.produto_grupo_adicional
  for delete to authenticated
  using (app.tem_papel(empresa_id, array['owner', 'admin']::public.papel_usuario[]));

create policy mesas_delete on public.mesas
  for delete to authenticated
  using (app.tem_papel(empresa_id, array['owner', 'admin']::public.papel_usuario[]));

create policy clientes_select on public.clientes
  for select to authenticated
  using (app.eh_membro(empresa_id));

create policy clientes_insert on public.clientes
  for insert to authenticated
  with check (app.tem_papel(empresa_id, array['owner', 'admin', 'cashier']::public.papel_usuario[]));

create policy clientes_update on public.clientes
  for update to authenticated
  using (app.tem_papel(empresa_id, array['owner', 'admin', 'cashier']::public.papel_usuario[]))
  with check (app.tem_papel(empresa_id, array['owner', 'admin', 'cashier']::public.papel_usuario[]));

-- ------------------------------------------------------------
-- Privilégios: nada de catálogo para visitantes anônimos.
-- ------------------------------------------------------------
do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array[
    'categorias', 'setores_cozinha', 'produtos', 'grupos_adicionais',
    'opcoes_adicionais', 'produto_grupo_adicional', 'mesas', 'clientes',
    'formas_pagamento'
  ]
  loop
    execute format('revoke all on table public.%s from anon', v_tabela);
  end loop;
end $$;

revoke delete on table public.produtos from anon, authenticated;
revoke delete on table public.clientes from anon, authenticated;
