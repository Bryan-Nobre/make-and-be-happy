-- ============================================================
-- 26. Setores no painel da cozinha
-- ============================================================

-- ------------------------------------------------------------
-- painel_cozinha: só itens que vão para produção (produto com setor).
-- Com p_setor, só os itens daquele setor; o pedido aparece em cada
-- setor com os próprios itens.
-- ------------------------------------------------------------
drop function public.painel_cozinha(uuid);

create function public.painel_cozinha(p_empresa uuid, p_setor uuid default null)
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
    and i.setor_id is not null
    and (p_setor is null or i.setor_id = p_setor)
  order by p.criado_em, i.criado_em;
end;
$$;

revoke execute on function public.painel_cozinha(uuid, uuid) from public, anon;
grant execute on function public.painel_cozinha(uuid, uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- Pedido sem nenhum item de produção não aparece em KDS nenhum. Para não
-- ficar parado na fila, ele segue pelas transições válidas: na mesa fica
-- pronto para o garçom entregar; no balcão já sai entregue.
-- ------------------------------------------------------------
create or replace function app.tg_pedido_sem_producao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.itens_pedido
    where pedido_id = new.id and setor_id is not null
  ) then
    return null;
  end if;

  update public.pedidos set status_operacional = 'PREPARING' where id = new.id;
  update public.pedidos set status_operacional = 'READY' where id = new.id;
  if new.origem = 'BALCAO' then
    update public.pedidos set status_operacional = 'DELIVERED' where id = new.id;
  end if;
  return null;
end;
$$;

create trigger pedidos_sem_producao
  after update of status_operacional on public.pedidos
  for each row
  when (new.status_operacional = 'CONFIRMED'
    and old.status_operacional is distinct from new.status_operacional)
  execute function app.tg_pedido_sem_producao();
