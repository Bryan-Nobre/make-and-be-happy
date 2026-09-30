-- ============================================================
-- Estoque: cada item de pedido consome pela ficha técnica vigente
-- quando entrou em produção, e insumo inativo bloqueia nova baixa.
-- ============================================================

-- ------------------------------------------------------------
-- Ficha técnica gravada por item de pedido. Sem FK para
-- itens_pedido: o item pode sair do pedido e o histórico fica.
-- ------------------------------------------------------------
create table public.fichas_item_pedido (
  item_pedido_id uuid primary key,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  produto_id uuid not null,
  registrada_em timestamptz not null default now()
);

create table public.fichas_item_pedido_insumos (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  item_pedido_id uuid not null
    references public.fichas_item_pedido (item_pedido_id) on delete cascade,
  item_id uuid not null,
  quantidade numeric(18, 6) not null check (quantidade > 0),
  primary key (item_pedido_id, item_id),
  constraint fichas_item_pedido_insumos_item_fk foreign key (empresa_id, item_id)
    references public.itens_estoque (empresa_id, id)
);

create index fichas_item_pedido_empresa_idx on public.fichas_item_pedido (empresa_id);
create index fichas_item_pedido_insumos_item_idx
  on public.fichas_item_pedido_insumos (empresa_id, item_id);

alter table public.fichas_item_pedido enable row level security;
alter table public.fichas_item_pedido_insumos enable row level security;

create policy fichas_item_pedido_select on public.fichas_item_pedido
  for select to authenticated
  using (app.tem_papel(empresa_id, array['owner', 'admin']::public.papel_usuario[]));
create policy fichas_item_pedido_insumos_select on public.fichas_item_pedido_insumos
  for select to authenticated
  using (app.tem_papel(empresa_id, array['owner', 'admin']::public.papel_usuario[]));

revoke all on table public.fichas_item_pedido, public.fichas_item_pedido_insumos from anon;
revoke insert, update, delete, truncate
  on table public.fichas_item_pedido, public.fichas_item_pedido_insumos from authenticated;
grant select on table public.fichas_item_pedido, public.fichas_item_pedido_insumos
  to authenticated;

-- ------------------------------------------------------------
-- Itens já em produção: a base é o que foi efetivamente baixado
-- por unidade, não a ficha atual.
-- ------------------------------------------------------------
insert into public.fichas_item_pedido (item_pedido_id, empresa_id, produto_id, registrada_em)
select i.id, i.empresa_id, i.produto_id, i.enviado_em
from public.itens_pedido i
join public.pedidos p on p.id = i.pedido_id
where i.enviado_em is not null
  and i.produto_id is not null
  and p.status_operacional not in ('DRAFT', 'CANCELLED');

insert into public.fichas_item_pedido_insumos (empresa_id, item_pedido_id, item_id, quantidade)
select i.empresa_id, i.id, m.item_id, -sum(m.variacao) / i.quantidade
from public.fichas_item_pedido f
join public.itens_pedido i on i.id = f.item_pedido_id
join public.movimentacoes_estoque m on m.item_pedido_id = i.id
group by i.empresa_id, i.id, i.quantidade, m.item_id
having -sum(m.variacao) > 0;

-- ------------------------------------------------------------
-- Leva o consumo de um item de pedido até p_unidades x ficha
-- gravada do item. A ficha é gravada na primeira vez em que o item
-- consome; p_unidades = 0 devolve exatamente o que foi baixado.
-- ------------------------------------------------------------
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
  v_status public.status_operacional_pedido;
  v_motivo_cancelamento text;
  v_ficha public.fichas_item_pedido;
  v_insumo record;
  v_alvo numeric(14, 3);
  v_consumido numeric(14, 3);
  v_delta numeric(14, 3);
begin
  select numero, status_operacional, motivo_cancelamento
  into v_numero, v_status, v_motivo_cancelamento
  from public.pedidos where id = p_pedido;

  if coalesce(p_unidades, 0) > 0 then
    select * into v_ficha from public.fichas_item_pedido where item_pedido_id = p_item_pedido;

    if not found or v_ficha.produto_id <> p_produto then
      delete from public.fichas_item_pedido where item_pedido_id = p_item_pedido;

      insert into public.fichas_item_pedido (item_pedido_id, empresa_id, produto_id)
      values (p_item_pedido, p_empresa, p_produto);

      insert into public.fichas_item_pedido_insumos (empresa_id, item_pedido_id, item_id, quantidade)
      select p_empresa, p_item_pedido, pi.item_id, pi.quantidade
      from public.produto_insumos pi
      where pi.empresa_id = p_empresa and pi.produto_id = p_produto;
    end if;
  end if;

  for r in
    select i.item_id, coalesce(fi.quantidade, 0) as por_unidade
    from (
      select f.item_id from public.fichas_item_pedido_insumos f
      where f.item_pedido_id = p_item_pedido
      union
      select m.item_id from public.movimentacoes_estoque m
      where m.item_pedido_id = p_item_pedido
    ) i
    left join public.fichas_item_pedido_insumos fi
      on fi.item_pedido_id = p_item_pedido and fi.item_id = i.item_id
    order by i.item_id
  loop
    v_alvo := round(r.por_unidade * coalesce(p_unidades, 0), 3);

    select coalesce(-sum(m.variacao), 0) into v_consumido
    from public.movimentacoes_estoque m
    where m.item_pedido_id = p_item_pedido and m.item_id = r.item_id;

    v_delta := v_alvo - v_consumido;

    if v_delta > 0 then
      select ie.nome, ie.ativo, p.nome as produto
      into v_insumo
      from public.itens_estoque ie, public.produtos p
      where ie.id = r.item_id and p.id = p_produto;

      if not v_insumo.ativo then
        raise exception 'O produto "%" usa o insumo "%", que está inativo no estoque. Reative o insumo ou ajuste a ficha técnica.',
          v_insumo.produto, v_insumo.nome;
      end if;

      perform app.aplicar_movimento_estoque(
        p_empresa, r.item_id, 'SAIDA', 'PEDIDO', -v_delta,
        format('Venda do pedido #%s', v_numero), null, p_pedido, p_item_pedido
      );
    elsif v_delta < 0 and v_status = 'CANCELLED' then
      perform app.aplicar_movimento_estoque(
        p_empresa, r.item_id, 'ENTRADA', 'PEDIDO', -v_delta,
        format('Cancelamento do pedido #%s', v_numero),
        left(v_motivo_cancelamento, 500), p_pedido, p_item_pedido
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

revoke all on function app.sincronizar_estoque_item(uuid, uuid, uuid, uuid, numeric) from public;
