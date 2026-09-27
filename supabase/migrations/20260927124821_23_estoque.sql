-- ============================================================
-- ARVON FOOD - Estoque (PRD 14 e 25)
--
-- O saldo é coluna, mas só muda junto com uma movimentação,
-- dentro de app.aplicar_movimento_estoque. Movimentações são
-- imutáveis e guardam o saldo antes e depois.
--
-- Venda: cada item de pedido enviado à produção consome os
-- insumos da ficha técnica do produto. O consumo é reconciliado
-- por item (alvo - já consumido), então confirmar, acrescentar,
-- alterar quantidade, remover e cancelar usam a mesma regra, e
-- a devolução é sempre exatamente o que foi baixado.
-- ============================================================

create type public.unidade_estoque as enum ('UN', 'KG', 'G', 'L', 'ML', 'CX', 'PCT');
create type public.tipo_movimentacao_estoque as enum ('ENTRADA', 'SAIDA', 'AJUSTE');
create type public.origem_movimentacao_estoque as enum ('MANUAL', 'PEDIDO');
create type public.status_estoque as enum ('NORMAL', 'BAIXO', 'SEM_ESTOQUE');

-- ------------------------------------------------------------
-- itens_estoque
-- ------------------------------------------------------------
create table public.itens_estoque (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text check (codigo is null or length(btrim(codigo)) between 1 and 30),
  nome text not null check (length(btrim(nome)) between 2 and 120),
  categoria text check (categoria is null or length(btrim(categoria)) between 1 and 60),
  unidade public.unidade_estoque not null default 'UN',
  quantidade numeric(14, 3) not null default 0 check (quantidade >= 0),
  quantidade_minima numeric(14, 3) not null default 0 check (quantidade_minima >= 0),
  ativo boolean not null default true,
  client_request_id uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint itens_estoque_empresa_id_key unique (empresa_id, id),
  constraint itens_estoque_requisicao_unica unique (empresa_id, client_request_id)
);

create unique index itens_estoque_nome_unico
  on public.itens_estoque (empresa_id, lower(btrim(nome)));
create unique index itens_estoque_codigo_unico
  on public.itens_estoque (empresa_id, lower(btrim(codigo)))
  where codigo is not null;

create trigger itens_estoque_atualizado_em
  before update on public.itens_estoque
  for each row execute function app.tg_atualizado_em();

-- ------------------------------------------------------------
-- movimentacoes_estoque: livro-razão, só inserção
-- ------------------------------------------------------------
create table public.movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  item_id uuid not null,
  tipo public.tipo_movimentacao_estoque not null,
  origem public.origem_movimentacao_estoque not null default 'MANUAL',
  variacao numeric(14, 3) not null check (variacao <> 0),
  saldo_anterior numeric(14, 3) not null check (saldo_anterior >= 0),
  saldo_resultante numeric(14, 3) not null check (saldo_resultante >= 0),
  motivo text not null check (length(btrim(motivo)) between 3 and 200),
  observacao text check (observacao is null or length(observacao) <= 500),
  pedido_id uuid,
  -- Sem FK: o item pode sair do pedido e a movimentação continua como histórico.
  item_pedido_id uuid,
  membro_id uuid references public.membros_empresa (id) on delete set null,
  nome_membro text,
  client_request_id uuid,
  criado_em timestamptz not null default now(),
  constraint movimentacoes_estoque_requisicao_unica unique (empresa_id, client_request_id),
  constraint movimentacoes_estoque_item_fk foreign key (empresa_id, item_id)
    references public.itens_estoque (empresa_id, id),
  constraint movimentacoes_estoque_pedido_fk foreign key (empresa_id, pedido_id)
    references public.pedidos (empresa_id, id),
  constraint movimentacoes_estoque_saldo check (saldo_resultante = saldo_anterior + variacao),
  constraint movimentacoes_estoque_sinal check (
    (tipo = 'ENTRADA' and variacao > 0)
    or (tipo = 'SAIDA' and variacao < 0)
    or tipo = 'AJUSTE'
  ),
  constraint movimentacoes_estoque_origem check (
    (origem = 'MANUAL' and pedido_id is null and item_pedido_id is null)
    or (origem = 'PEDIDO' and pedido_id is not null and item_pedido_id is not null
        and tipo <> 'AJUSTE')
  )
);

create index movimentacoes_estoque_item_idx
  on public.movimentacoes_estoque (empresa_id, item_id, criado_em desc);
create index movimentacoes_estoque_empresa_idx
  on public.movimentacoes_estoque (empresa_id, criado_em desc);
create index movimentacoes_estoque_pedido_idx
  on public.movimentacoes_estoque (empresa_id, pedido_id)
  where pedido_id is not null;
create index movimentacoes_estoque_item_pedido_idx
  on public.movimentacoes_estoque (item_pedido_id, item_id)
  where item_pedido_id is not null;

-- ------------------------------------------------------------
-- produto_insumos: ficha técnica mínima (quanto de cada item
-- uma unidade do produto consome)
-- ------------------------------------------------------------
create table public.produto_insumos (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  produto_id uuid not null,
  item_id uuid not null,
  quantidade numeric(14, 3) not null check (quantidade > 0),
  primary key (produto_id, item_id),
  constraint produto_insumos_produto_fk foreign key (empresa_id, produto_id)
    references public.produtos (empresa_id, id) on delete cascade,
  constraint produto_insumos_item_fk foreign key (empresa_id, item_id)
    references public.itens_estoque (empresa_id, id)
);

create index produto_insumos_item_idx on public.produto_insumos (empresa_id, item_id);
create index produto_insumos_produto_idx on public.produto_insumos (empresa_id, produto_id);

-- ============================================================
-- Proteções
-- ============================================================
create or replace function app.tg_item_estoque_protegido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_movimentando boolean := coalesce(current_setting('app.movimentando_estoque', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then
      return old;
    end if;
    raise exception 'Itens de estoque não podem ser excluídos. Desative o item.';
  end if;

  if tg_op = 'INSERT' then
    if new.quantidade <> 0 and not v_movimentando then
      raise exception 'O saldo inicial é lançado como movimentação de entrada.';
    end if;
    return new;
  end if;

  if new.empresa_id <> old.empresa_id then
    raise exception 'O item não pode mudar de empresa.';
  end if;

  if new.quantidade <> old.quantidade and not v_movimentando then
    raise exception 'O saldo do estoque só muda por movimentação.';
  end if;

  if new.unidade <> old.unidade and exists (
    select 1 from public.movimentacoes_estoque m where m.item_id = old.id
  ) then
    raise exception 'A unidade não pode mudar depois que o item já tem movimentações.';
  end if;

  return new;
end;
$$;

create trigger itens_estoque_protegido
  before insert or update or delete on public.itens_estoque
  for each row execute function app.tg_item_estoque_protegido();

create or replace function app.tg_movimentacao_estoque_protegida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  raise exception 'Movimentações de estoque não podem ser alteradas. Registre um ajuste.';
end;
$$;

create trigger movimentacoes_estoque_protegida
  before update or delete on public.movimentacoes_estoque
  for each row execute function app.tg_movimentacao_estoque_protegida();

-- ============================================================
-- Núcleo: toda mudança de saldo passa por aqui
-- ============================================================
create or replace function app.qtd_texto(p_quantidade numeric, p_unidade public.unidade_estoque)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(trim_scale(p_quantidade)::text, '.', ',') || ' ' ||
    case p_unidade
      when 'UN' then 'un'
      when 'KG' then 'kg'
      when 'G' then 'g'
      when 'L' then 'L'
      when 'ML' then 'ml'
      when 'CX' then 'cx'
      when 'PCT' then 'pct'
    end;
$$;

create or replace function app.aplicar_movimento_estoque(
  p_empresa uuid,
  p_item uuid,
  p_tipo public.tipo_movimentacao_estoque,
  p_origem public.origem_movimentacao_estoque,
  p_variacao numeric,
  p_motivo text,
  p_observacao text default null,
  p_pedido uuid default null,
  p_item_pedido uuid default null,
  p_client_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.itens_estoque;
  v_novo numeric(14, 3);
  v_id uuid;
begin
  select * into v_item
  from public.itens_estoque
  where id = p_item and empresa_id = p_empresa
  for update;

  if not found then
    raise exception 'Item de estoque não encontrado.';
  end if;

  v_novo := v_item.quantidade + p_variacao;

  if v_novo < 0 then
    raise exception 'Estoque insuficiente de %: disponível %, necessário %.',
      v_item.nome,
      app.qtd_texto(v_item.quantidade, v_item.unidade),
      app.qtd_texto(-p_variacao, v_item.unidade);
  end if;

  perform set_config('app.movimentando_estoque', 'on', true);
  update public.itens_estoque set quantidade = v_novo where id = p_item;
  perform set_config('app.movimentando_estoque', 'off', true);

  insert into public.movimentacoes_estoque (
    empresa_id, item_id, tipo, origem, variacao, saldo_anterior, saldo_resultante,
    motivo, observacao, pedido_id, item_pedido_id, membro_id, nome_membro, client_request_id
  )
  values (
    p_empresa, p_item, p_tipo, p_origem, p_variacao, v_item.quantidade, v_novo,
    btrim(p_motivo), nullif(btrim(coalesce(p_observacao, '')), ''), p_pedido, p_item_pedido,
    app.membro_atual(p_empresa), app.nome_membro(p_empresa), p_client_request_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ============================================================
-- RPCs de cadastro e movimentação manual (owner/admin)
-- ============================================================
create or replace function public.criar_item_estoque(
  p_empresa uuid,
  p_nome text,
  p_unidade public.unidade_estoque,
  p_quantidade_minima numeric default 0,
  p_codigo text default null,
  p_categoria text default null,
  p_saldo_inicial numeric default 0,
  p_client_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform app.exigir_papel(p_empresa, array['owner', 'admin']::public.papel_usuario[]);

  if p_client_request_id is not null then
    select id into v_id
    from public.itens_estoque
    where empresa_id = p_empresa and client_request_id = p_client_request_id;
    if found then
      return v_id;
    end if;
  end if;

  if coalesce(p_saldo_inicial, 0) < 0 or coalesce(p_quantidade_minima, 0) < 0 then
    raise exception 'Quantidades não podem ser negativas.';
  end if;

  begin
    insert into public.itens_estoque (
      empresa_id, nome, unidade, quantidade_minima, codigo, categoria, client_request_id
    )
    values (
      p_empresa, btrim(p_nome), p_unidade, coalesce(p_quantidade_minima, 0),
      nullif(btrim(coalesce(p_codigo, '')), ''), nullif(btrim(coalesce(p_categoria, '')), ''),
      p_client_request_id
    )
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'Já existe um item de estoque com este nome ou código.';
    when check_violation then
      raise exception 'Confira o nome (2 a 120 caracteres), o código e a categoria.';
  end;

  if coalesce(p_saldo_inicial, 0) > 0 then
    perform app.aplicar_movimento_estoque(
      p_empresa, v_id, 'ENTRADA', 'MANUAL', p_saldo_inicial, 'Saldo inicial'
    );
  end if;

  perform app.registrar_auditoria(
    p_empresa, 'estoque.item_criado', 'itens_estoque', v_id::text,
    jsonb_build_object('nome', btrim(p_nome), 'saldo_inicial', coalesce(p_saldo_inicial, 0))
  );

  return v_id;
end;
$$;

create or replace function public.movimentar_estoque(
  p_empresa uuid,
  p_item uuid,
  p_tipo public.tipo_movimentacao_estoque,
  p_quantidade numeric,
  p_motivo text,
  p_observacao text default null,
  p_client_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.itens_estoque;
  v_variacao numeric(14, 3);
  v_id uuid;
begin
  perform app.exigir_papel(p_empresa, array['owner', 'admin']::public.papel_usuario[]);

  if p_client_request_id is not null then
    select id into v_id
    from public.movimentacoes_estoque
    where empresa_id = p_empresa and client_request_id = p_client_request_id;
    if found then
      return v_id;
    end if;
  end if;

  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe o motivo da movimentação.';
  end if;

  if p_quantidade is null or p_quantidade < 0 then
    raise exception 'Informe uma quantidade válida.';
  end if;

  select * into v_item
  from public.itens_estoque
  where id = p_item and empresa_id = p_empresa
  for update;

  if not found then
    raise exception 'Item de estoque não encontrado.';
  end if;

  if not v_item.ativo then
    raise exception 'O item % está desativado. Reative-o para movimentar.', v_item.nome;
  end if;

  if p_tipo = 'AJUSTE' then
    -- No ajuste, a quantidade informada é o novo saldo contado.
    v_variacao := p_quantidade - v_item.quantidade;
    if v_variacao = 0 then
      raise exception 'O saldo informado é igual ao saldo atual.';
    end if;
  else
    if p_quantidade = 0 then
      raise exception 'A quantidade deve ser maior que zero.';
    end if;
    v_variacao := case when p_tipo = 'ENTRADA' then p_quantidade else -p_quantidade end;
  end if;

  v_id := app.aplicar_movimento_estoque(
    p_empresa, p_item, p_tipo, 'MANUAL', v_variacao, p_motivo, p_observacao,
    null, null, p_client_request_id
  );

  if p_tipo in ('AJUSTE', 'SAIDA') then
    perform app.registrar_auditoria(
      p_empresa,
      case p_tipo when 'AJUSTE' then 'estoque.ajuste' else 'estoque.saida_manual' end,
      'itens_estoque',
      p_item::text,
      jsonb_build_object(
        'item', v_item.nome,
        'saldo_anterior', v_item.quantidade,
        'saldo_resultante', v_item.quantidade + v_variacao,
        'motivo', btrim(p_motivo)
      )
    );
  end if;

  return v_id;
end;
$$;

-- Substitui a ficha técnica inteira de um produto.
-- p_insumos: [{ "item_id": uuid, "quantidade": numeric > 0 }]
create or replace function public.definir_ficha_tecnica(p_produto uuid, p_insumos jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
  v_nome text;
  v_total int;
  v_validos int;
begin
  select empresa_id, nome into v_empresa, v_nome
  from public.produtos
  where id = p_produto;

  if not found then
    raise exception 'Produto não encontrado.';
  end if;

  perform app.exigir_papel(v_empresa, array['owner', 'admin']::public.papel_usuario[]);

  if p_insumos is null or jsonb_typeof(p_insumos) <> 'array' then
    raise exception 'Ficha técnica inválida.';
  end if;

  select count(*), count(distinct x.item_id) filter (
    where x.quantidade > 0 and exists (
      select 1 from public.itens_estoque i
      where i.id = x.item_id and i.empresa_id = v_empresa
    )
  )
  into v_total, v_validos
  from jsonb_to_recordset(p_insumos) as x(item_id uuid, quantidade numeric);

  if v_total <> v_validos then
    raise exception 'Confira a ficha técnica: cada insumo deve aparecer uma vez, com quantidade maior que zero.';
  end if;

  delete from public.produto_insumos where produto_id = p_produto;

  insert into public.produto_insumos (empresa_id, produto_id, item_id, quantidade)
  select v_empresa, p_produto, x.item_id, round(x.quantidade, 3)
  from jsonb_to_recordset(p_insumos) as x(item_id uuid, quantidade numeric);

  perform app.registrar_auditoria(
    v_empresa, 'produto.ficha_tecnica', 'produtos', p_produto::text,
    jsonb_build_object('produto', v_nome, 'insumos', p_insumos)
  );
end;
$$;

-- ============================================================
-- Baixa automática pela venda
-- ============================================================

-- Leva o consumo de um item de pedido até o alvo (p_unidades do
-- produto x ficha técnica). p_unidades = 0 devolve tudo o que foi
-- baixado para o item. A ordem fixa dos insumos evita deadlock
-- entre pedidos simultâneos que usam os mesmos itens.
create or replace function app.sincronizar_estoque_item(
  p_item_pedido uuid,
  p_empresa uuid,
  p_pedido uuid,
  p_produto uuid,
  p_unidades numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_numero bigint;
  v_alvo numeric(14, 3);
  v_consumido numeric(14, 3);
  v_delta numeric(14, 3);
begin
  select numero into v_numero from public.pedidos where id = p_pedido;

  for r in
    select i.item_id, coalesce(pi.quantidade, 0) as por_unidade
    from (
      select pi2.item_id from public.produto_insumos pi2 where pi2.produto_id = p_produto
      union
      select m.item_id from public.movimentacoes_estoque m where m.item_pedido_id = p_item_pedido
    ) i
    left join public.produto_insumos pi
      on pi.produto_id = p_produto and pi.item_id = i.item_id
    order by i.item_id
  loop
    v_alvo := round(r.por_unidade * coalesce(p_unidades, 0), 3);

    select coalesce(-sum(m.variacao), 0) into v_consumido
    from public.movimentacoes_estoque m
    where m.item_pedido_id = p_item_pedido and m.item_id = r.item_id;

    v_delta := v_alvo - v_consumido;

    if v_delta > 0 then
      perform app.aplicar_movimento_estoque(
        p_empresa, r.item_id, 'SAIDA', 'PEDIDO', -v_delta,
        format('Venda do pedido #%s', v_numero), null, p_pedido, p_item_pedido
      );
    elsif v_delta < 0 then
      perform app.aplicar_movimento_estoque(
        p_empresa, r.item_id, 'ENTRADA', 'PEDIDO', -v_delta,
        format('Devolução do pedido #%s', v_numero), null, p_pedido, p_item_pedido
      );
    end if;
  end loop;
end;
$$;

create or replace function app.tg_estoque_item_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.status_operacional_pedido;
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.pedidos where id = old.pedido_id) then
      perform app.sincronizar_estoque_item(old.id, old.empresa_id, old.pedido_id, old.produto_id, 0);
    end if;
    return old;
  end if;

  select status_operacional into v_status from public.pedidos where id = new.pedido_id;

  perform app.sincronizar_estoque_item(
    new.id, new.empresa_id, new.pedido_id, new.produto_id,
    case
      when new.enviado_em is not null and v_status not in ('DRAFT', 'CANCELLED') then new.quantidade
      else 0
    end
  );
  return new;
end;
$$;

create trigger itens_pedido_estoque
  after insert or update of quantidade, enviado_em, produto_id or delete on public.itens_pedido
  for each row execute function app.tg_estoque_item_pedido();

create or replace function app.tg_estoque_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select i.id, i.produto_id, i.quantidade, i.enviado_em
    from public.itens_pedido i
    where i.pedido_id = new.id
    order by i.id
  loop
    perform app.sincronizar_estoque_item(
      r.id, new.empresa_id, new.id, r.produto_id,
      case
        when r.enviado_em is not null and new.status_operacional not in ('DRAFT', 'CANCELLED')
          then r.quantidade
        else 0
      end
    );
  end loop;
  return new;
end;
$$;

-- Só entrar ou sair de rascunho/cancelado muda o consumo do pedido.
create trigger pedidos_estoque
  after update of status_operacional on public.pedidos
  for each row
  when (
    old.status_operacional is distinct from new.status_operacional
    and (old.status_operacional in ('DRAFT', 'CANCELLED')
         or new.status_operacional in ('DRAFT', 'CANCELLED'))
  )
  execute function app.tg_estoque_pedido();

-- ============================================================
-- View de situação (alertas de estoque baixo)
-- ============================================================
create view public.itens_estoque_status with (security_invoker = true) as
select
  i.id,
  i.empresa_id,
  i.codigo,
  i.nome,
  i.categoria,
  i.unidade,
  i.quantidade,
  i.quantidade_minima,
  i.ativo,
  case
    when i.quantidade = 0 then 'SEM_ESTOQUE'::public.status_estoque
    when i.quantidade <= i.quantidade_minima then 'BAIXO'::public.status_estoque
    else 'NORMAL'::public.status_estoque
  end as status
from public.itens_estoque i;

-- ============================================================
-- RLS e grants
-- Itens: leitura para membros (alertas no dashboard), edição
-- cadastral por owner/admin. Saldo, movimentações e ficha
-- técnica: só por RPC.
-- ============================================================
alter table public.itens_estoque enable row level security;
alter table public.movimentacoes_estoque enable row level security;
alter table public.produto_insumos enable row level security;

create policy itens_estoque_select on public.itens_estoque
  for select to authenticated using (app.eh_membro(empresa_id));
create policy itens_estoque_update on public.itens_estoque
  for update to authenticated
  using (app.tem_papel(empresa_id, array['owner', 'admin']::public.papel_usuario[]))
  with check (app.tem_papel(empresa_id, array['owner', 'admin']::public.papel_usuario[]));

create policy movimentacoes_estoque_select on public.movimentacoes_estoque
  for select to authenticated
  using (app.tem_papel(empresa_id, array['owner', 'admin']::public.papel_usuario[]));

create policy produto_insumos_select on public.produto_insumos
  for select to authenticated
  using (app.tem_papel(empresa_id, array['owner', 'admin']::public.papel_usuario[]));

revoke all on table public.itens_estoque, public.movimentacoes_estoque, public.produto_insumos from anon;
revoke insert, update, delete, truncate
  on table public.itens_estoque, public.movimentacoes_estoque, public.produto_insumos
  from authenticated;
grant select on table public.itens_estoque, public.movimentacoes_estoque, public.produto_insumos
  to authenticated;
grant update (codigo, nome, categoria, unidade, quantidade_minima, ativo)
  on table public.itens_estoque to authenticated;

revoke all on public.itens_estoque_status from anon;
revoke insert, update, delete, truncate on public.itens_estoque_status from authenticated;
grant select on public.itens_estoque_status to authenticated;

do $$
declare
  v_assinatura text;
begin
  foreach v_assinatura in array array[
    'public.criar_item_estoque(uuid, text, public.unidade_estoque, numeric, text, text, numeric, uuid)',
    'public.movimentar_estoque(uuid, uuid, public.tipo_movimentacao_estoque, numeric, text, text, uuid)',
    'public.definir_ficha_tecnica(uuid, jsonb)'
  ]
  loop
    execute format('revoke all on function %s from public', v_assinatura);
    execute format('revoke all on function %s from anon', v_assinatura);
    execute format('grant execute on function %s to authenticated, service_role', v_assinatura);
  end loop;

  foreach v_assinatura in array array[
    'app.qtd_texto(numeric, public.unidade_estoque)',
    'app.aplicar_movimento_estoque(uuid, uuid, public.tipo_movimentacao_estoque, public.origem_movimentacao_estoque, numeric, text, text, uuid, uuid, uuid)',
    'app.sincronizar_estoque_item(uuid, uuid, uuid, uuid, numeric)',
    'app.tg_item_estoque_protegido()',
    'app.tg_movimentacao_estoque_protegida()',
    'app.tg_estoque_item_pedido()',
    'app.tg_estoque_pedido()'
  ]
  loop
    execute format('revoke all on function %s from public', v_assinatura);
  end loop;
end $$;
