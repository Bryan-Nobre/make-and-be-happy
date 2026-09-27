-- ============================================================
-- Totais, máquina de estados e imutabilidade do pedido
--
-- Nenhum valor financeiro chega do navegador: subtotal vem da
-- soma dos itens e total é coluna gerada (PRD 20).
-- ============================================================

create trigger comandas_atualizado_em before update on public.comandas
  for each row execute function app.tg_atualizado_em();
create trigger pedidos_atualizado_em before update on public.pedidos
  for each row execute function app.tg_atualizado_em();

-- ------------------------------------------------------------
-- Recalcula os adicionais de um item e o subtotal do pedido.
-- ------------------------------------------------------------
create or replace function app.recalcular_item(p_item uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.itens_pedido i
  set adicionais_total = coalesce((
    select sum(a.preco)
    from public.item_pedido_adicional a
    where a.item_pedido_id = i.id
  ), 0)
  where i.id = p_item;
$$;

create or replace function app.recalcular_pedido(p_pedido uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.pedidos p
  set subtotal = coalesce((
    select sum(i.total)
    from public.itens_pedido i
    where i.pedido_id = p.id
  ), 0)
  where p.id = p_pedido;
$$;

create or replace function app.tg_recalcular_por_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.recalcular_pedido(coalesce(new.pedido_id, old.pedido_id));
  return null;
end;
$$;

create or replace function app.tg_recalcular_por_adicional()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item uuid := coalesce(new.item_pedido_id, old.item_pedido_id);
begin
  perform app.recalcular_item(v_item);
  return null;
end;
$$;

-- AFTER, porque o total do item é coluna gerada e só existe depois da escrita.
create trigger itens_pedido_recalcular
  after insert or update or delete on public.itens_pedido
  for each row execute function app.tg_recalcular_por_item();

create trigger ipa_recalcular
  after insert or update or delete on public.item_pedido_adicional
  for each row execute function app.tg_recalcular_por_adicional();

-- ------------------------------------------------------------
-- Transições operacionais permitidas (PRD 8).
-- Cancelamento só antes de o pedido ficar pronto.
-- ------------------------------------------------------------
create or replace function app.transicao_operacional_valida(
  p_de public.status_operacional_pedido,
  p_para public.status_operacional_pedido
)
returns boolean
language sql
immutable
as $$
  select case
    when p_de = p_para then true
    when p_de = 'DRAFT' then p_para in ('CONFIRMED', 'CANCELLED')
    when p_de = 'CONFIRMED' then p_para in ('PREPARING', 'CANCELLED')
    when p_de = 'PREPARING' then p_para in ('READY', 'CANCELLED')
    when p_de = 'READY' then p_para = 'DELIVERED'
    else false
  end;
$$;

-- ------------------------------------------------------------
-- O status financeiro é consequência do valor pago, nunca um campo
-- escrito à mão. Isso elimina a divergencia entre os dois.
-- REFUNDED é a única exceção: marcação explícita de estorno.
-- ------------------------------------------------------------
create or replace function app.tg_pedido_consistencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric(12, 2);
begin
  v_total := new.subtotal - new.desconto + new.acrescimo;

  if tg_op = 'UPDATE' then
    if not app.transicao_operacional_valida(old.status_operacional, new.status_operacional) then
      raise exception 'Não é possível mudar o pedido de % para %.',
        app.rotulo_status(old.status_operacional), app.rotulo_status(new.status_operacional);
    end if;

    if new.status_operacional = 'CANCELLED'
       and old.status_operacional <> 'CANCELLED'
       and old.valor_pago > 0 then
      raise exception 'Este pedido já tem pagamento registrado. Faça o estorno antes de cancelar.';
    end if;

    if old.status_financeiro = 'REFUNDED' and new.status_financeiro <> 'REFUNDED' then
      raise exception 'Pedido estornado não volta a ficar em aberto.';
    end if;

    -- Pedido entregue ou cancelado não muda mais de valor.
    if old.status_operacional in ('DELIVERED', 'CANCELLED')
       and (old.subtotal <> new.subtotal
            or old.desconto <> new.desconto
            or old.acrescimo <> new.acrescimo) then
      raise exception 'Pedido % não pode mais ter os valores alterados.',
        app.rotulo_status(old.status_operacional);
    end if;

    -- Marca os momentos de cada etapa.
    if new.status_operacional <> old.status_operacional then
      new.confirmado_em := coalesce(new.confirmado_em,
        case when new.status_operacional = 'CONFIRMED' then now() end);
      new.preparo_em := coalesce(new.preparo_em,
        case when new.status_operacional = 'PREPARING' then now() end);
      new.pronto_em := coalesce(new.pronto_em,
        case when new.status_operacional = 'READY' then now() end);
      new.entregue_em := coalesce(new.entregue_em,
        case when new.status_operacional = 'DELIVERED' then now() end);
      if new.status_operacional = 'CANCELLED' then
        new.cancelado_em := coalesce(new.cancelado_em, now());
      end if;
    end if;
  end if;

  if new.valor_pago > v_total then
    raise exception 'O valor pago não pode passar do total do pedido.';
  end if;

  if new.status_financeiro <> 'REFUNDED' then
    new.status_financeiro := case
      when new.valor_pago <= 0 then 'UNPAID'
      when new.valor_pago >= v_total then 'PAID'
      else 'PARTIALLY_PAID'
    end;
  end if;

  return new;
end;
$$;

create or replace function app.rotulo_status(p_status public.status_operacional_pedido)
returns text
language sql
immutable
as $$
  select case p_status
    when 'DRAFT' then 'rascunho'
    when 'CONFIRMED' then 'confirmado'
    when 'PREPARING' then 'em preparo'
    when 'READY' then 'pronto'
    when 'DELIVERED' then 'entregue'
    when 'CANCELLED' then 'cancelado'
  end;
$$;

create trigger pedidos_consistencia
  before insert or update on public.pedidos
  for each row execute function app.tg_pedido_consistencia();

-- ------------------------------------------------------------
-- Histórico de status
-- ------------------------------------------------------------
create or replace function app.tg_historico_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.historico_status_pedido (empresa_id, pedido_id, de, para, membro_id)
    values (new.empresa_id, new.id, null, new.status_operacional, new.criado_por);
    return new;
  end if;

  if new.status_operacional <> old.status_operacional then
    insert into public.historico_status_pedido
      (empresa_id, pedido_id, de, para, motivo, membro_id)
    values (
      new.empresa_id, new.id, old.status_operacional, new.status_operacional,
      case when new.status_operacional = 'CANCELLED' then new.motivo_cancelamento end,
      coalesce(new.cancelado_por, app.membro_atual(new.empresa_id))
    );
  end if;

  return new;
end;
$$;

create or replace function app.membro_atual(p_empresa uuid)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select m.id
  from public.membros_empresa m
  where m.empresa_id = p_empresa and m.usuario_id = auth.uid() and m.ativo;
$$;

create trigger pedidos_historico
  after insert or update on public.pedidos
  for each row execute function app.tg_historico_pedido();

-- ------------------------------------------------------------
-- Itens de pedido entregue, cancelado ou pago não mudam mais.
-- Alterações depois do envio à cozinha geram auditoria (PRD 7).
-- ------------------------------------------------------------
create or replace function app.tg_item_protegido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido record;
  v_id uuid := coalesce(new.pedido_id, old.pedido_id);
  v_relevante boolean := true;
begin
  -- Atualizações internas (total de adicionais, marca de envio) passam direto.
  if tg_op = 'UPDATE' then
    v_relevante := old.quantidade <> new.quantidade
      or old.preco_unitario <> new.preco_unitario
      or old.produto_id <> new.produto_id
      or coalesce(old.observacoes, '') <> coalesce(new.observacoes, '');
  end if;

  if not v_relevante then
    return new;
  end if;

  select status_operacional, status_financeiro, numero, empresa_id
  into v_pedido
  from public.pedidos
  where id = v_id;

  if v_pedido is null then
    return coalesce(new, old);
  end if;

  if v_pedido.status_operacional in ('DELIVERED', 'CANCELLED') then
    raise exception 'O pedido #% já está % e não aceita mais mudança de itens.',
      v_pedido.numero, app.rotulo_status(v_pedido.status_operacional);
  end if;

  if v_pedido.status_financeiro in ('PAID', 'REFUNDED') then
    raise exception 'O pedido #% já foi pago. Itens não podem mais ser alterados.',
      v_pedido.numero;
  end if;

  if v_pedido.status_operacional <> 'DRAFT' then
    perform app.registrar_auditoria(
      v_pedido.empresa_id,
      case tg_op
        when 'INSERT' then 'pedido.item_adicionado_apos_envio'
        when 'UPDATE' then 'pedido.item_alterado_apos_envio'
        else 'pedido.item_removido_apos_envio'
      end,
      'itens_pedido',
      coalesce(new.id, old.id)::text,
      jsonb_build_object(
        'pedido', v_pedido.numero,
        'produto', coalesce(new.nome_produto, old.nome_produto),
        'quantidade_antes', case when tg_op <> 'INSERT' then old.quantidade end,
        'quantidade_depois', case when tg_op <> 'DELETE' then new.quantidade end
      )
    );
  end if;

  return coalesce(new, old);
end;
$$;

create trigger itens_pedido_protegido
  before insert or update or delete on public.itens_pedido
  for each row execute function app.tg_item_protegido();
