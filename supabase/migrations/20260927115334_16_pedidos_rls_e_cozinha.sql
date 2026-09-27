-- ============================================================
-- RLS dos pedidos + canal de cozinha sem dados financeiros
--
-- A cozinha não tem SELECT em pedidos/itens (PRD 10: não deve ver
-- informação financeira). Ela lê pelo painel_cozinha, que devolve
-- apenas produção, e acompanha mudanças por eventos_cozinha.
-- ============================================================

-- Feed de alterações para o KDS. Nenhuma coluna de valor.
create table public.eventos_cozinha (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  pedido_id uuid not null,
  tipo text not null,
  criado_em timestamptz not null default now()
);

create index eventos_cozinha_idx on public.eventos_cozinha (empresa_id, id desc);

create or replace function app.tg_evento_cozinha()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
  v_pedido uuid;
  v_tipo text;
begin
  if tg_table_name = 'pedidos' then
    if tg_op = 'UPDATE' and new.status_operacional = old.status_operacional then
      return null;
    end if;
    v_empresa := new.empresa_id;
    v_pedido := new.id;
    v_tipo := 'pedido';
  else
    if tg_op = 'DELETE' then
      v_empresa := old.empresa_id;
      v_pedido := old.pedido_id;
    else
      v_empresa := new.empresa_id;
      v_pedido := new.pedido_id;
    end if;
    v_tipo := 'itens';
  end if;

  insert into public.eventos_cozinha (empresa_id, pedido_id, tipo)
  values (v_empresa, v_pedido, v_tipo);

  return null;
end;
$$;

create trigger pedidos_evento_cozinha
  after insert or update on public.pedidos
  for each row execute function app.tg_evento_cozinha();

create trigger itens_evento_cozinha
  after insert or update or delete on public.itens_pedido
  for each row execute function app.tg_evento_cozinha();

-- ------------------------------------------------------------
-- painel_cozinha: uma linha por item, sem preço (PRD 10)
-- ------------------------------------------------------------
create or replace function public.painel_cozinha(p_empresa uuid)
returns table (
  pedido_id uuid,
  numero bigint,
  origem public.origem_pedido,
  status public.status_operacional_pedido,
  nome_mesa text,
  comanda_numero bigint,
  observacoes_pedido text,
  criado_em timestamptz,
  confirmado_em timestamptz,
  preparo_em timestamptz,
  pronto_em timestamptz,
  item_id uuid,
  nome_produto text,
  quantidade numeric,
  observacoes_item text,
  nome_setor text,
  enviado_em timestamptz,
  adicionais text[]
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.eh_membro(p_empresa) then
    raise exception 'Restaurante não encontrado.';
  end if;

  return query
  select
    p.id, p.numero, p.origem, p.status_operacional,
    m.nome, c.numero, p.observacoes,
    p.criado_em, p.confirmado_em, p.preparo_em, p.pronto_em,
    i.id, i.nome_produto, i.quantidade, i.observacoes, i.nome_setor, i.enviado_em,
    coalesce((
      select array_agg(a.nome_opcao order by a.nome_grupo, a.nome_opcao)
      from public.item_pedido_adicional a
      where a.item_pedido_id = i.id
    ), '{}'::text[])
  from public.pedidos p
  join public.itens_pedido i on i.pedido_id = p.id
  left join public.comandas c on c.id = p.comanda_id
  left join public.mesas m on m.id = c.mesa_id
  where p.empresa_id = p_empresa
    and p.status_operacional in ('CONFIRMED', 'PREPARING', 'READY')
  order by p.criado_em, i.criado_em;
end;
$$;

-- ============================================================
-- RLS
-- Escrita só por RPC: nenhuma política de insert/update/delete.
-- ============================================================
do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array[
    'comandas', 'pedidos', 'itens_pedido', 'item_pedido_adicional'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_tabela);
    execute format(
      'create policy %I on public.%I for select to authenticated using (app.tem_papel(empresa_id, array[''owner'', ''admin'', ''cashier'', ''waiter'']::public.papel_usuario[]))',
      v_tabela || '_select', v_tabela
    );
    execute format('revoke all on table public.%I from anon', v_tabela);
    execute format('revoke insert, update, delete on table public.%I from authenticated', v_tabela);
  end loop;
end $$;

alter table public.historico_status_pedido enable row level security;
create policy historico_status_pedido_select on public.historico_status_pedido
  for select to authenticated
  using (app.tem_papel(empresa_id, array['owner', 'admin']::public.papel_usuario[]));
revoke all on table public.historico_status_pedido from anon;
revoke insert, update, delete on table public.historico_status_pedido from authenticated;

alter table public.eventos_cozinha enable row level security;
create policy eventos_cozinha_select on public.eventos_cozinha
  for select to authenticated
  using (app.eh_membro(empresa_id));
revoke all on table public.eventos_cozinha from anon;
revoke insert, update, delete on table public.eventos_cozinha from authenticated;

-- ============================================================
-- Visões e funções: EXECUTE/SELECT nunca para anon.
-- Função em Postgres nasce com execute para PUBLIC, e anon herda.
-- ============================================================
revoke all on public.comandas_resumo from anon;
revoke all on public.mesas_estado from anon;
grant select on public.comandas_resumo to authenticated;
grant select on public.mesas_estado to authenticated;

do $$
declare
  v_assinatura text;
begin
  foreach v_assinatura in array array[
    'public.criar_pedido(uuid, public.origem_pedido, jsonb, uuid, boolean, numeric, numeric, text, uuid)',
    'public.adicionar_itens_pedido(uuid, jsonb)',
    'public.alterar_item_pedido(uuid, numeric, text)',
    'public.remover_item_pedido(uuid)',
    'public.confirmar_pedido(uuid)',
    'public.avancar_status_pedido(uuid, public.status_operacional_pedido)',
    'public.cancelar_pedido(uuid, text)',
    'public.ajustar_valores_pedido(uuid, numeric, numeric)',
    'public.abrir_comanda(uuid, uuid, integer, uuid, text, uuid)',
    'public.pedir_conta(uuid)',
    'public.transferir_comanda(uuid, uuid)',
    'public.encerrar_comanda(uuid)',
    'public.cancelar_comanda(uuid, text)',
    'public.painel_cozinha(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public', v_assinatura);
    execute format('revoke all on function %s from anon', v_assinatura);
    execute format('grant execute on function %s to authenticated, service_role', v_assinatura);
  end loop;
end $$;

-- ============================================================
-- Realtime por empresa. O filtro vai no cliente e a RLS confirma.
-- ============================================================
alter publication supabase_realtime add table public.pedidos;
alter publication supabase_realtime add table public.comandas;
alter publication supabase_realtime add table public.eventos_cozinha;
