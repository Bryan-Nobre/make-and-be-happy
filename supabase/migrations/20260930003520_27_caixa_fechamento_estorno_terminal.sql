-- ============================================================
-- Caixa: fechamento bloqueado com contas pendentes, estorno só na
-- sessão original aberta e unicidade preparada para terminal.
-- ============================================================

-- ------------------------------------------------------------
-- Contas que ainda devem ser recebidas: pedidos de balcão não
-- quitados e comandas abertas/aguardando pagamento com saldo.
-- ------------------------------------------------------------
create or replace function app.pendencias_caixa(p_empresa uuid)
returns table (pedidos integer, comandas integer, valor numeric)
language sql
security definer
stable
set search_path = ''
as $$
  with pend_pedidos as (
    select greatest(p.total - p.valor_pago, 0) as saldo
    from public.pedidos p
    where p.empresa_id = p_empresa
      and p.origem = 'BALCAO'
      and p.comanda_id is null
      and p.status_operacional not in ('DRAFT', 'CANCELLED')
      and p.status_financeiro in ('UNPAID', 'PARTIALLY_PAID')
  ),
  pend_comandas as (
    select app.saldo_devido(null, c.id) as saldo
    from public.comandas c
    where c.empresa_id = p_empresa
      and c.status in ('OPEN', 'PAYMENT_PENDING')
  )
  select
    (select count(*) from pend_pedidos where saldo > 0)::integer,
    (select count(*) from pend_comandas where saldo > 0)::integer,
    coalesce((select sum(saldo) from pend_pedidos), 0)
      + coalesce((select sum(saldo) from pend_comandas), 0);
$$;

revoke execute on function app.pendencias_caixa(uuid) from public, anon;

create or replace function public.pendencias_caixa(p_empresa uuid)
returns table (pedidos integer, comandas integer, valor numeric)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  perform app.exigir_papel(p_empresa, array['owner', 'admin', 'cashier']::public.papel_usuario[]);
  return query select * from app.pendencias_caixa(p_empresa);
end;
$$;

revoke execute on function public.pendencias_caixa(uuid) from public, anon;
grant execute on function public.pendencias_caixa(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- fechar_caixa: bloqueia enquanto houver conta pendente.
-- ------------------------------------------------------------
create or replace function public.fechar_caixa(
  p_sessao uuid,
  p_dinheiro_informado numeric,
  p_justificativa text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sessao public.sessoes_caixa;
  v_informado numeric(12, 2) := round(p_dinheiro_informado, 2);
  v_esperado numeric(12, 2);
  v_justificativa text := nullif(btrim(coalesce(p_justificativa, '')), '');
  v_totais record;
  v_pendencias record;
begin
  select * into v_sessao from public.sessoes_caixa where id = p_sessao for update;
  if not found or not app.eh_membro(v_sessao.empresa_id) then
    raise exception 'Caixa não encontrado.';
  end if;
  perform app.exigir_papel(v_sessao.empresa_id,
    array['owner', 'admin', 'cashier']::public.papel_usuario[]);

  if v_sessao.status = 'CLOSED' then
    raise exception 'O caixa #% já foi fechado.', v_sessao.numero;
  end if;

  select * into v_pendencias from app.pendencias_caixa(v_sessao.empresa_id);
  if v_pendencias.pedidos + v_pendencias.comandas > 0 then
    raise exception 'Não é possível fechar o caixa: % conta(s) pendente(s) somando %. Receba antes de fechar.',
      v_pendencias.pedidos + v_pendencias.comandas, app.brl(v_pendencias.valor);
  end if;

  if v_informado is null or v_informado < 0 then
    raise exception 'Informe o dinheiro contado na gaveta.';
  end if;

  v_esperado := app.dinheiro_esperado(p_sessao);

  if v_informado <> v_esperado and coalesce(length(v_justificativa), 0) < 3 then
    raise exception 'Justifique a diferença de % no fechamento.',
      app.brl(v_informado - v_esperado);
  end if;

  select
    coalesce(sum(case when tipo = 'VENDA' and metodo = 'DINHEIRO' then valor
                      when tipo = 'ESTORNO' and metodo = 'DINHEIRO' then -valor end), 0) as dinheiro,
    coalesce(sum(case when tipo = 'VENDA' and metodo = 'PIX' then valor
                      when tipo = 'ESTORNO' and metodo = 'PIX' then -valor end), 0) as pix,
    coalesce(sum(case when tipo = 'VENDA' and metodo = 'DEBITO' then valor
                      when tipo = 'ESTORNO' and metodo = 'DEBITO' then -valor end), 0) as debito,
    coalesce(sum(case when tipo = 'VENDA' and metodo = 'CREDITO' then valor
                      when tipo = 'ESTORNO' and metodo = 'CREDITO' then -valor end), 0) as credito,
    coalesce(sum(case when tipo = 'ESTORNO' then valor end), 0) as estornos
  into v_totais
  from public.movimentacoes_caixa
  where sessao_id = p_sessao;

  update public.sessoes_caixa
  set status = 'CLOSED',
      fechada_em = now(),
      fechada_por = app.membro_atual(v_sessao.empresa_id),
      nome_fechamento = app.nome_membro(v_sessao.empresa_id),
      dinheiro_esperado = v_esperado,
      dinheiro_informado = v_informado,
      justificativa = left(v_justificativa, 500),
      total_dinheiro = v_totais.dinheiro,
      total_pix = v_totais.pix,
      total_debito = v_totais.debito,
      total_credito = v_totais.credito,
      total_estornos = v_totais.estornos
  where id = p_sessao;

  perform app.registrar_auditoria(
    v_sessao.empresa_id, 'caixa.fechado', 'sessoes_caixa', p_sessao::text,
    jsonb_build_object(
      'caixa', v_sessao.numero,
      'dinheiro_esperado', v_esperado,
      'dinheiro_informado', v_informado,
      'diferenca', v_informado - v_esperado,
      'justificativa', v_justificativa
    )
  );
end;
$$;

-- ------------------------------------------------------------
-- estornar_pagamento: o estorno sai da mesma sessão do pagamento,
-- que precisa estar aberta. Caixa fechado não recebe estorno.
-- ------------------------------------------------------------
create or replace function public.estornar_pagamento(p_pagamento uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pagamento public.pagamentos;
  v_sessao public.sessoes_caixa;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_membro uuid;
  v_mov uuid;
  v_disponivel numeric(12, 2);
  v_rotulo text;
  v_comanda public.comandas;
begin
  select * into v_pagamento from public.pagamentos where id = p_pagamento;
  if not found or not app.eh_membro(v_pagamento.empresa_id) then
    raise exception 'Pagamento não encontrado.';
  end if;
  perform app.exigir_papel(v_pagamento.empresa_id,
    array['owner', 'admin']::public.papel_usuario[]);

  if length(v_motivo) < 3 then
    raise exception 'Informe o motivo do estorno.';
  end if;

  -- Ordem de travas igual à do pagamento: sessão, depois a conta.
  select * into v_sessao from public.sessoes_caixa
  where id = v_pagamento.sessao_id
  for update;
  if v_sessao.status <> 'OPEN' then
    raise exception 'Este pagamento pertence ao caixa #%, que já foi fechado, e não pode ser estornado.',
      v_sessao.numero;
  end if;

  if v_pagamento.pedido_id is not null then
    perform 1 from public.pedidos where id = v_pagamento.pedido_id for update;
    select 'Pedido #' || numero into v_rotulo from public.pedidos where id = v_pagamento.pedido_id;
  else
    select * into v_comanda from public.comandas where id = v_pagamento.comanda_id for update;
    v_rotulo := 'Comanda #' || v_comanda.numero;
  end if;

  select * into v_pagamento from public.pagamentos where id = p_pagamento for update;
  if v_pagamento.status = 'ESTORNADO' then
    raise exception 'Este pagamento já foi estornado.';
  end if;

  if v_pagamento.metodo = 'DINHEIRO' then
    v_disponivel := app.dinheiro_esperado(v_sessao.id);
    if v_pagamento.valor > v_disponivel then
      raise exception 'Não há dinheiro suficiente no caixa para devolver % (disponível: %).',
        app.brl(v_pagamento.valor), app.brl(v_disponivel);
    end if;
  end if;

  v_membro := app.membro_atual(v_pagamento.empresa_id);

  insert into public.movimentacoes_caixa (empresa_id, sessao_id, tipo, metodo, valor, descricao, membro_id)
  values (
    v_pagamento.empresa_id, v_sessao.id, 'ESTORNO', v_pagamento.metodo, v_pagamento.valor,
    left('Estorno ' || v_rotulo || ': ' || v_motivo, 300), v_membro
  )
  returning id into v_mov;

  update public.pagamentos
  set status = 'ESTORNADO',
      estornado_em = now(),
      estornado_por = v_membro,
      motivo_estorno = left(v_motivo, 300),
      movimentacao_estorno_id = v_mov
  where id = p_pagamento;

  -- Devolução de algo já entregue/encerrado vira REFUNDED quando nada
  -- mais fica pago. Antes disso (ex.: forma errada) a conta volta a
  -- ficar em aberto e pode ser recebida de novo.
  if v_pagamento.pedido_id is not null then
    perform app.recalcular_pedido_pago(v_pagamento.pedido_id);
    update public.pedidos
    set status_financeiro = 'REFUNDED'
    where id = v_pagamento.pedido_id
      and valor_pago = 0
      and status_operacional = 'DELIVERED';
  else
    perform app.recalcular_comanda_paga(v_pagamento.comanda_id);
    update public.pedidos p
    set status_financeiro = 'REFUNDED'
    from public.comandas c
    where c.id = v_pagamento.comanda_id
      and c.status = 'CLOSED'
      and c.valor_pago = 0
      and p.comanda_id = c.id
      and p.status_operacional <> 'CANCELLED';
  end if;

  perform app.registrar_auditoria(
    v_pagamento.empresa_id, 'pagamento.estornado', 'pagamentos', p_pagamento::text,
    jsonb_build_object('referencia', v_rotulo, 'metodo', v_pagamento.metodo,
                       'valor', v_pagamento.valor, 'motivo', v_motivo,
                       'caixa', v_sessao.numero)
  );
end;
$$;

-- ------------------------------------------------------------
-- Terminal: a unicidade passa a ser por empresa + terminal. No MVP
-- só existe o terminal 'Principal', então continua havendo no
-- máximo um caixa aberto por empresa. Para liberar vários terminais,
-- remover sessoes_caixa_terminal_mvp e adaptar abrir_caixa e
-- app.sessao_aberta para receber o terminal.
-- ------------------------------------------------------------
alter table public.sessoes_caixa
  add constraint sessoes_caixa_terminal_mvp check (terminal = 'Principal');

drop index public.sessoes_caixa_uma_aberta;

create unique index sessoes_caixa_uma_aberta_por_terminal
  on public.sessoes_caixa (empresa_id, terminal)
  where status = 'OPEN';

create or replace function app.tg_sessao_caixa_protegida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 then
      return old;
    end if;
    raise exception 'Sessões de caixa não podem ser excluídas.';
  end if;

  if old.status = 'CLOSED' then
    raise exception 'Caixa fechado não pode ser alterado.';
  end if;

  if new.empresa_id <> old.empresa_id
     or new.numero <> old.numero
     or new.terminal <> old.terminal
     or new.valor_inicial <> old.valor_inicial
     or new.aberta_em <> old.aberta_em then
    raise exception 'Os dados de abertura do caixa não podem ser alterados.';
  end if;

  return new;
end;
$$;
