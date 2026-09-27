-- ============================================================
-- ARVON FOOD - Caixa e pagamentos: regras (PRD 11, 22 e 26)
-- ============================================================

-- ------------------------------------------------------------
-- Auxiliares
-- ------------------------------------------------------------
create or replace function app.brl(p_valor numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'R$ ' || replace(to_char(coalesce(p_valor, 0), 'FM999999990.00'), '.', ',');
$$;

-- Total da comanda com a taxa de serviço fotografada na abertura.
create or replace function app.total_comanda(p_comanda uuid)
returns numeric
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(t.subtotal, 0)
    + round(coalesce(t.subtotal, 0) * c.taxa_servico_percentual / 100, 2)
  from public.comandas c
  left join lateral (
    select sum(p.total) as subtotal
    from public.pedidos p
    where p.comanda_id = c.id and p.status_operacional <> 'CANCELLED'
  ) t on true
  where c.id = p_comanda;
$$;

create or replace function app.saldo_devido(p_pedido uuid, p_comanda uuid)
returns numeric
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when p_pedido is not null then (
      select greatest(p.total - p.valor_pago, 0) from public.pedidos p where p.id = p_pedido
    )
    else (
      select greatest(app.total_comanda(c.id) - c.valor_pago, 0)
      from public.comandas c where c.id = p_comanda
    )
  end;
$$;

-- Dinheiro físico que deveria estar na gaveta.
create or replace function app.dinheiro_esperado(p_sessao uuid)
returns numeric
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(sum(
    case
      when m.tipo in ('ABERTURA', 'SUPRIMENTO') then m.valor
      when m.tipo = 'SANGRIA' then -m.valor
      when m.tipo = 'VENDA' and m.metodo = 'DINHEIRO' then m.valor
      when m.tipo = 'ESTORNO' and m.metodo = 'DINHEIRO' then -m.valor
      else 0
    end
  ), 0)
  from public.movimentacoes_caixa m
  where m.sessao_id = p_sessao;
$$;

-- Sessão aberta da empresa, travada para a operação em curso.
-- Exclusiva para quem tira dinheiro (sangria, estorno, fechamento),
-- compartilhada para quem só coloca (vendas).
create or replace function app.sessao_aberta(p_empresa uuid, p_exclusiva boolean default false)
returns public.sessoes_caixa
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sessao public.sessoes_caixa;
begin
  if p_exclusiva then
    select * into v_sessao from public.sessoes_caixa
    where empresa_id = p_empresa and status = 'OPEN'
    for update;
  else
    select * into v_sessao from public.sessoes_caixa
    where empresa_id = p_empresa and status = 'OPEN'
    for share;
  end if;

  if not found then
    raise exception 'O caixa está fechado. Abra o caixa antes de continuar.';
  end if;

  return v_sessao;
end;
$$;

-- ------------------------------------------------------------
-- Valor pago do pedido de balcão = soma dos pagamentos confirmados.
-- ------------------------------------------------------------
create or replace function app.recalcular_pedido_pago(p_pedido uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.pedidos p
  set valor_pago = coalesce((
    select sum(pg.valor)
    from public.pagamentos pg
    where pg.pedido_id = p.id and pg.status = 'CONFIRMADO'
  ), 0)
  where p.id = p_pedido;
$$;

-- ------------------------------------------------------------
-- Valor pago da comanda e distribuição nos pedidos.
-- A parte proporcional à taxa de serviço fica na comanda; o restante
-- quita os pedidos do mais antigo para o mais novo.
-- ------------------------------------------------------------
create or replace function app.recalcular_comanda_paga(p_comanda uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comanda public.comandas;
  v_pago numeric(12, 2);
  v_subtotal numeric(12, 2);
  v_total numeric(12, 2);
  v_liquido numeric(12, 2);
  v_aplicar numeric(12, 2);
  v_pedido record;
begin
  select * into v_comanda from public.comandas where id = p_comanda for update;
  if not found then
    return;
  end if;

  select coalesce(sum(valor), 0) into v_pago
  from public.pagamentos
  where comanda_id = p_comanda and status = 'CONFIRMADO';

  select coalesce(sum(total), 0) into v_subtotal
  from public.pedidos
  where comanda_id = p_comanda and status_operacional <> 'CANCELLED';

  v_total := v_subtotal + round(v_subtotal * v_comanda.taxa_servico_percentual / 100, 2);

  if v_pago > v_total then
    raise exception 'O valor já pago na comanda #% (%) passaria do total da conta (%).',
      v_comanda.numero, app.brl(v_pago), app.brl(v_total);
  end if;

  v_liquido := case
    when v_total = 0 then 0
    when v_pago >= v_total then v_subtotal
    else round(v_pago * v_subtotal / v_total, 2)
  end;

  for v_pedido in
    select id, total, status_financeiro
    from public.pedidos
    where comanda_id = p_comanda and status_operacional <> 'CANCELLED'
    order by criado_em, id
  loop
    v_aplicar := least(v_pedido.total, v_liquido);
    update public.pedidos
    set valor_pago = v_aplicar
    where id = v_pedido.id and valor_pago <> v_aplicar;
    v_liquido := v_liquido - v_aplicar;
  end loop;

  update public.comandas
  set valor_pago = v_pago,
      status = case
        when status in ('OPEN', 'PAYMENT_PENDING') and v_total > 0 and v_pago >= v_total
          then 'PAID'::public.status_comanda
        when status = 'PAID' and v_pago < v_total
          then 'PAYMENT_PENDING'::public.status_comanda
        else status
      end
  where id = p_comanda
    and (valor_pago <> v_pago or status in ('OPEN', 'PAYMENT_PENDING', 'PAID'));
end;
$$;

-- Mudou o total de um pedido da comanda (item novo, cancelamento,
-- desconto): a distribuição e o status da comanda são refeitos.
create or replace function app.tg_pedido_redistribuir_comanda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.recalcular_comanda_paga(new.comanda_id);
  return null;
end;
$$;

create trigger pedidos_redistribuir_comanda
  after update of status_operacional, subtotal, desconto, acrescimo on public.pedidos
  for each row
  when (
    new.comanda_id is not null
    and (old.status_operacional is distinct from new.status_operacional
         or old.total is distinct from new.total)
  )
  execute function app.tg_pedido_redistribuir_comanda();

-- ============================================================
-- RPCs de caixa
-- ============================================================

-- ------------------------------------------------------------
-- abrir_caixa
-- ------------------------------------------------------------
create or replace function public.abrir_caixa(
  p_empresa uuid,
  p_valor_inicial numeric,
  p_observacao text default null,
  p_client_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_numero bigint;
  v_valor numeric(12, 2) := round(coalesce(p_valor_inicial, 0), 2);
  v_membro uuid;
begin
  perform app.exigir_papel(p_empresa, array['owner', 'admin', 'cashier']::public.papel_usuario[]);

  if p_client_request_id is not null then
    select id into v_id from public.sessoes_caixa
    where empresa_id = p_empresa and client_request_id = p_client_request_id;
    if found then
      return v_id;
    end if;
  end if;

  select numero into v_numero from public.sessoes_caixa
  where empresa_id = p_empresa and status = 'OPEN';
  if found then
    raise exception 'O caixa #% já está aberto.', v_numero;
  end if;

  if v_valor < 0 or v_valor > 1000000 then
    raise exception 'Informe um fundo de troco válido.';
  end if;

  v_membro := app.membro_atual(p_empresa);

  insert into public.sessoes_caixa (
    empresa_id, numero, valor_inicial, observacao_abertura,
    aberta_por, nome_abertura, client_request_id
  )
  values (
    p_empresa, app.proximo_numero(p_empresa, 'CAIXA'), v_valor,
    nullif(btrim(coalesce(p_observacao, '')), ''),
    v_membro, app.nome_membro(p_empresa), p_client_request_id
  )
  returning id, numero into v_id, v_numero;

  if v_valor > 0 then
    insert into public.movimentacoes_caixa (empresa_id, sessao_id, tipo, metodo, valor, descricao, membro_id)
    values (p_empresa, v_id, 'ABERTURA', 'DINHEIRO', v_valor, 'Fundo de troco', v_membro);
  end if;

  perform app.registrar_auditoria(
    p_empresa, 'caixa.aberto', 'sessoes_caixa', v_id::text,
    jsonb_build_object('caixa', v_numero, 'valor_inicial', v_valor)
  );

  return v_id;
end;
$$;

-- ------------------------------------------------------------
-- movimentar_caixa: sangria e suprimento
-- ------------------------------------------------------------
create or replace function public.movimentar_caixa(
  p_empresa uuid,
  p_tipo public.tipo_movimentacao_caixa,
  p_valor numeric,
  p_descricao text,
  p_client_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sessao public.sessoes_caixa;
  v_id uuid;
  v_valor numeric(12, 2) := round(coalesce(p_valor, 0), 2);
  v_descricao text := btrim(coalesce(p_descricao, ''));
  v_disponivel numeric(12, 2);
begin
  perform app.exigir_papel(p_empresa, array['owner', 'admin', 'cashier']::public.papel_usuario[]);

  if p_tipo not in ('SANGRIA', 'SUPRIMENTO') then
    raise exception 'Use esta operação apenas para sangria ou suprimento.';
  end if;

  if p_client_request_id is not null then
    select id into v_id from public.movimentacoes_caixa
    where empresa_id = p_empresa and client_request_id = p_client_request_id;
    if found then
      return v_id;
    end if;
  end if;

  if v_valor <= 0 or v_valor > 1000000 then
    raise exception 'Informe um valor maior que zero.';
  end if;
  if length(v_descricao) < 3 then
    raise exception 'Informe o motivo da movimentação.';
  end if;

  v_sessao := app.sessao_aberta(p_empresa, p_tipo = 'SANGRIA');

  if p_tipo = 'SANGRIA' then
    v_disponivel := app.dinheiro_esperado(v_sessao.id);
    if v_valor > v_disponivel then
      raise exception 'A sangria (%) passa do dinheiro em caixa (%).',
        app.brl(v_valor), app.brl(v_disponivel);
    end if;
  end if;

  insert into public.movimentacoes_caixa (
    empresa_id, sessao_id, tipo, metodo, valor, descricao, membro_id, client_request_id
  )
  values (
    p_empresa, v_sessao.id, p_tipo, 'DINHEIRO', v_valor, left(v_descricao, 300),
    app.membro_atual(p_empresa), p_client_request_id
  )
  returning id into v_id;

  perform app.registrar_auditoria(
    p_empresa,
    case p_tipo when 'SANGRIA' then 'caixa.sangria' else 'caixa.suprimento' end,
    'movimentacoes_caixa', v_id::text,
    jsonb_build_object('caixa', v_sessao.numero, 'valor', v_valor, 'motivo', v_descricao)
  );

  return v_id;
end;
$$;

-- ------------------------------------------------------------
-- fechar_caixa: fotografa os totais e trava a sessão
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

-- ============================================================
-- RPCs de pagamento
-- ============================================================

-- ------------------------------------------------------------
-- registrar_pagamento
-- p_partes: [{ "metodo": "PIX", "valor": 60 },
--            { "metodo": "DINHEIRO", "valor": 40, "valor_recebido": 50 }]
-- Tudo ou nada: se uma parte for inválida, nenhuma é gravada.
-- ------------------------------------------------------------
create or replace function public.registrar_pagamento(
  p_empresa uuid,
  p_partes jsonb,
  p_pedido uuid default null,
  p_comanda uuid default null,
  p_client_request_id uuid default null
)
returns table (troco numeric, saldo numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sessao public.sessoes_caixa;
  v_membro uuid;
  v_lote uuid := coalesce(p_client_request_id, gen_random_uuid());
  v_pedido public.pedidos;
  v_comanda public.comandas;
  v_devido numeric(12, 2);
  v_rotulo text;
  v_parte jsonb;
  v_ordem integer := 0;
  v_metodo public.metodo_pagamento;
  v_valor numeric(12, 2);
  v_recebido numeric(12, 2);
  v_soma numeric(12, 2) := 0;
  v_troco numeric(12, 2) := 0;
  v_mov uuid;
  v_alvo_anterior record;
begin
  perform app.exigir_papel(p_empresa, array['owner', 'admin', 'cashier']::public.papel_usuario[]);

  if num_nonnulls(p_pedido, p_comanda) <> 1 then
    raise exception 'Informe o pedido ou a comanda a receber.';
  end if;

  v_sessao := app.sessao_aberta(p_empresa);

  -- Trava o que está sendo pago: dois caixas não recebem a mesma conta
  -- ao mesmo tempo, e a repetição da requisição espera a primeira.
  if p_pedido is not null then
    select * into v_pedido from public.pedidos
    where empresa_id = p_empresa and id = p_pedido
    for update;
    if not found then
      raise exception 'Pedido não encontrado.';
    end if;
    v_rotulo := 'Pedido #' || v_pedido.numero;
  else
    select * into v_comanda from public.comandas
    where empresa_id = p_empresa and id = p_comanda
    for update;
    if not found then
      raise exception 'Comanda não encontrada.';
    end if;
    v_rotulo := 'Comanda #' || v_comanda.numero;
  end if;

  -- Idempotência: o mesmo lote devolve o resultado já gravado.
  select pg.pedido_id, pg.comanda_id into v_alvo_anterior
  from public.pagamentos pg
  where pg.empresa_id = p_empresa and pg.lote_id = v_lote
  limit 1;

  if found then
    if v_alvo_anterior.pedido_id is distinct from p_pedido
       or v_alvo_anterior.comanda_id is distinct from p_comanda then
      raise exception 'Esta requisição de pagamento já foi usada em outra conta.';
    end if;
    return query
      select coalesce(sum(pg.troco), 0)::numeric, app.saldo_devido(p_pedido, p_comanda)
      from public.pagamentos pg
      where pg.empresa_id = p_empresa and pg.lote_id = v_lote;
    return;
  end if;

  if p_pedido is not null then
    if v_pedido.comanda_id is not null then
      raise exception 'O pedido #% é de uma mesa. Receba pela comanda.', v_pedido.numero;
    end if;
    if v_pedido.status_operacional = 'CANCELLED' then
      raise exception 'O pedido #% está cancelado.', v_pedido.numero;
    end if;
    if v_pedido.status_financeiro = 'REFUNDED' then
      raise exception 'O pedido #% foi estornado e não recebe novos pagamentos.', v_pedido.numero;
    end if;
  elsif v_comanda.status not in ('OPEN', 'PAYMENT_PENDING') then
    raise exception 'A comanda #% não está aberta para pagamento.', v_comanda.numero;
  end if;

  v_devido := app.saldo_devido(p_pedido, p_comanda);
  if v_devido <= 0 then
    raise exception '% já está quitado.', v_rotulo;
  end if;

  if jsonb_typeof(p_partes) is distinct from 'array' or jsonb_array_length(p_partes) = 0 then
    raise exception 'Informe ao menos uma forma de pagamento.';
  end if;
  if jsonb_array_length(p_partes) > 10 then
    raise exception 'O pagamento pode ser dividido em no máximo 10 partes.';
  end if;

  v_membro := app.membro_atual(p_empresa);

  for v_parte in select value from jsonb_array_elements(p_partes)
  loop
    v_ordem := v_ordem + 1;

    begin
      v_metodo := (v_parte ->> 'metodo')::public.metodo_pagamento;
      v_valor := round((v_parte ->> 'valor')::numeric, 2);
      v_recebido := round((v_parte ->> 'valor_recebido')::numeric, 2);
    exception when others then
      raise exception 'Forma de pagamento inválida na parte %.', v_ordem;
    end;

    if v_metodo is null or v_valor is null or v_valor <= 0 then
      raise exception 'Informe a forma e o valor de cada parte do pagamento.';
    end if;

    if not exists (
      select 1 from public.formas_pagamento f
      where f.empresa_id = p_empresa and f.metodo = v_metodo and f.ativa
    ) then
      raise exception 'A forma de pagamento % não está habilitada.', v_metodo;
    end if;

    if v_metodo <> 'DINHEIRO' then
      if v_recebido is not null and v_recebido <> v_valor then
        raise exception 'Troco só existe para pagamento em dinheiro.';
      end if;
      v_recebido := null;
    elsif v_recebido is not null and v_recebido < v_valor then
      raise exception 'O dinheiro recebido (%) é menor que o valor da parte (%).',
        app.brl(v_recebido), app.brl(v_valor);
    end if;

    v_soma := v_soma + v_valor;
    if v_soma > v_devido then
      raise exception 'O pagamento passa do saldo devido de %.', app.brl(v_devido);
    end if;

    insert into public.movimentacoes_caixa (empresa_id, sessao_id, tipo, metodo, valor, descricao, membro_id)
    values (p_empresa, v_sessao.id, 'VENDA', v_metodo, v_valor, v_rotulo, v_membro)
    returning id into v_mov;

    insert into public.pagamentos (
      empresa_id, sessao_id, pedido_id, comanda_id, metodo, valor, valor_recebido,
      movimentacao_id, lote_id, ordem, criado_por
    )
    values (
      p_empresa, v_sessao.id, p_pedido, p_comanda, v_metodo, v_valor, v_recebido,
      v_mov, v_lote, v_ordem, v_membro
    );

    v_troco := v_troco + coalesce(v_recebido - v_valor, 0);
  end loop;

  if p_pedido is not null then
    perform app.recalcular_pedido_pago(p_pedido);
  else
    perform app.recalcular_comanda_paga(p_comanda);
  end if;

  perform app.registrar_auditoria(
    p_empresa, 'pagamento.registrado',
    case when p_pedido is not null then 'pedidos' else 'comandas' end,
    coalesce(p_pedido, p_comanda)::text,
    jsonb_build_object('referencia', v_rotulo, 'valor', v_soma, 'partes', v_ordem,
                       'caixa', v_sessao.numero, 'lote', v_lote)
  );

  return query select v_troco::numeric, app.saldo_devido(p_pedido, p_comanda);
end;
$$;

-- ------------------------------------------------------------
-- estornar_pagamento: nunca apaga; gera movimentação de saída no
-- caixa aberto e registra motivo e autor (PRD 7, 11 e 24).
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
  v_sessao := app.sessao_aberta(v_pagamento.empresa_id, true);

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
-- encerrar_comanda: passa a usar o valor pago da própria comanda,
-- que inclui a taxa de serviço.
-- ------------------------------------------------------------
create or replace function public.encerrar_comanda(p_comanda uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comanda public.comandas;
  v_em_producao integer;
  v_total numeric(12, 2);
begin
  v_comanda := app.comanda_acessivel(p_comanda);
  perform app.exigir_papel(v_comanda.empresa_id,
    array['owner', 'admin', 'cashier']::public.papel_usuario[]);

  if v_comanda.status in ('CLOSED', 'CANCELLED') then
    raise exception 'A comanda #% já foi encerrada.', v_comanda.numero;
  end if;

  select count(*) into v_em_producao
  from public.pedidos p
  where p.comanda_id = p_comanda
    and p.status_operacional in ('DRAFT', 'CONFIRMED', 'PREPARING', 'READY');

  if v_em_producao > 0 then
    raise exception 'A comanda #% tem % pedido(s) ainda em andamento.',
      v_comanda.numero, v_em_producao;
  end if;

  v_total := app.total_comanda(p_comanda);
  if v_comanda.valor_pago < v_total then
    raise exception 'A comanda #% ainda tem % em aberto.',
      v_comanda.numero, app.brl(v_total - v_comanda.valor_pago);
  end if;

  update public.comandas
  set status = 'CLOSED', fechada_em = now()
  where id = p_comanda;
end;
$$;

-- ============================================================
-- Visões
-- ============================================================
drop view public.mesas_estado;
drop view public.comandas_resumo;

create view public.comandas_resumo with (security_invoker = true) as
select
  c.id,
  c.empresa_id,
  c.numero,
  c.mesa_id,
  m.nome as nome_mesa,
  c.cliente_id,
  cl.nome as nome_cliente,
  c.pessoas,
  c.status,
  c.taxa_servico_percentual,
  c.observacoes,
  c.aberta_em,
  c.conta_pedida_em,
  c.fechada_em,
  c.motivo_cancelamento,
  coalesce(t.subtotal, 0) as subtotal,
  round(coalesce(t.subtotal, 0) * c.taxa_servico_percentual / 100, 2) as taxa_servico,
  coalesce(t.subtotal, 0)
    + round(coalesce(t.subtotal, 0) * c.taxa_servico_percentual / 100, 2) as total,
  c.valor_pago,
  greatest(
    coalesce(t.subtotal, 0)
      + round(coalesce(t.subtotal, 0) * c.taxa_servico_percentual / 100, 2)
      - c.valor_pago,
    0
  ) as saldo,
  coalesce(t.pedidos, 0) as pedidos,
  coalesce(t.em_producao, 0) as pedidos_em_producao
from public.comandas c
join public.mesas m on m.empresa_id = c.empresa_id and m.id = c.mesa_id
left join public.clientes cl on cl.empresa_id = c.empresa_id and cl.id = c.cliente_id
left join lateral (
  select
    sum(p.total) as subtotal,
    count(*) as pedidos,
    count(*) filter (
      where p.status_operacional in ('DRAFT', 'CONFIRMED', 'PREPARING', 'READY')
    ) as em_producao
  from public.pedidos p
  where p.comanda_id = c.id and p.status_operacional <> 'CANCELLED'
) t on true;

create view public.mesas_estado with (security_invoker = true) as
select
  m.id,
  m.empresa_id,
  m.nome,
  m.lugares,
  m.ordem,
  m.ativa,
  case
    when c.id is null then 'LIVRE'
    when c.status in ('PAYMENT_PENDING', 'PAID') then 'AGUARDANDO_PAGAMENTO'
    else 'OCUPADA'
  end::public.status_mesa as status,
  c.id as comanda_id,
  c.numero as comanda_numero,
  c.pessoas,
  c.aberta_em,
  coalesce(c.subtotal, 0) as subtotal,
  coalesce(c.total, 0) as total,
  coalesce(c.valor_pago, 0) as valor_pago,
  coalesce(c.pedidos_em_producao, 0) as pedidos_em_producao
from public.mesas m
left join public.comandas_resumo c
  on c.empresa_id = m.empresa_id
 and c.mesa_id = m.id
 and c.status in ('OPEN', 'PAYMENT_PENDING', 'PAID');

-- Resumo vivo da sessão; depois de fechada, valem as colunas fotografadas.
create view public.sessoes_caixa_resumo with (security_invoker = true) as
select
  s.id,
  s.empresa_id,
  s.numero,
  s.terminal,
  s.status,
  s.valor_inicial,
  s.observacao_abertura,
  s.nome_abertura,
  s.aberta_em,
  s.nome_fechamento,
  s.fechada_em,
  s.dinheiro_informado,
  s.diferenca,
  s.justificativa,
  coalesce(s.dinheiro_esperado, t.dinheiro_esperado) as dinheiro_esperado,
  coalesce(s.total_dinheiro, t.dinheiro) as total_dinheiro,
  coalesce(s.total_pix, t.pix) as total_pix,
  coalesce(s.total_debito, t.debito) as total_debito,
  coalesce(s.total_credito, t.credito) as total_credito,
  coalesce(s.total_estornos, t.estornos) as total_estornos,
  t.suprimentos,
  t.sangrias,
  t.movimentacoes
from public.sessoes_caixa s
left join lateral (
  select
    coalesce(sum(case
      when m.tipo in ('ABERTURA', 'SUPRIMENTO') then m.valor
      when m.tipo = 'SANGRIA' then -m.valor
      when m.tipo = 'VENDA' and m.metodo = 'DINHEIRO' then m.valor
      when m.tipo = 'ESTORNO' and m.metodo = 'DINHEIRO' then -m.valor
      else 0 end), 0) as dinheiro_esperado,
    coalesce(sum(case when m.tipo = 'VENDA' and m.metodo = 'DINHEIRO' then m.valor
                      when m.tipo = 'ESTORNO' and m.metodo = 'DINHEIRO' then -m.valor end), 0) as dinheiro,
    coalesce(sum(case when m.tipo = 'VENDA' and m.metodo = 'PIX' then m.valor
                      when m.tipo = 'ESTORNO' and m.metodo = 'PIX' then -m.valor end), 0) as pix,
    coalesce(sum(case when m.tipo = 'VENDA' and m.metodo = 'DEBITO' then m.valor
                      when m.tipo = 'ESTORNO' and m.metodo = 'DEBITO' then -m.valor end), 0) as debito,
    coalesce(sum(case when m.tipo = 'VENDA' and m.metodo = 'CREDITO' then m.valor
                      when m.tipo = 'ESTORNO' and m.metodo = 'CREDITO' then -m.valor end), 0) as credito,
    coalesce(sum(case when m.tipo = 'ESTORNO' then m.valor end), 0) as estornos,
    coalesce(sum(case when m.tipo = 'SUPRIMENTO' then m.valor end), 0) as suprimentos,
    coalesce(sum(case when m.tipo = 'SANGRIA' then m.valor end), 0) as sangrias,
    count(*) as movimentacoes
  from public.movimentacoes_caixa m
  where m.sessao_id = s.id
) t on true;

-- ============================================================
-- Permissões
-- ============================================================
revoke all on public.comandas_resumo from anon;
revoke all on public.mesas_estado from anon;
revoke all on public.sessoes_caixa_resumo from anon;
revoke insert, update, delete, truncate on public.comandas_resumo from authenticated;
revoke insert, update, delete, truncate on public.mesas_estado from authenticated;
revoke insert, update, delete, truncate on public.sessoes_caixa_resumo from authenticated;
grant select on public.comandas_resumo to authenticated;
grant select on public.mesas_estado to authenticated;
grant select on public.sessoes_caixa_resumo to authenticated;

do $$
declare
  v_assinatura text;
begin
  foreach v_assinatura in array array[
    'public.abrir_caixa(uuid, numeric, text, uuid)',
    'public.movimentar_caixa(uuid, public.tipo_movimentacao_caixa, numeric, text, uuid)',
    'public.fechar_caixa(uuid, numeric, text)',
    'public.registrar_pagamento(uuid, jsonb, uuid, uuid, uuid)',
    'public.estornar_pagamento(uuid, text)',
    'public.encerrar_comanda(uuid)'
  ]
  loop
    execute format('revoke all on function %s from public', v_assinatura);
    execute format('revoke all on function %s from anon', v_assinatura);
    execute format('grant execute on function %s to authenticated, service_role', v_assinatura);
  end loop;
end $$;

-- Funções internas não ficam expostas (schema app não está na API),
-- mas também não precisam de execute para PUBLIC.
do $$
declare
  v_assinatura text;
begin
  foreach v_assinatura in array array[
    'app.brl(numeric)',
    'app.total_comanda(uuid)',
    'app.saldo_devido(uuid, uuid)',
    'app.dinheiro_esperado(uuid)',
    'app.sessao_aberta(uuid, boolean)',
    'app.recalcular_pedido_pago(uuid)',
    'app.recalcular_comanda_paga(uuid)',
    'app.tg_pedido_redistribuir_comanda()',
    'app.tg_sessao_caixa_protegida()',
    'app.tg_movimentacao_caixa_protegida()',
    'app.tg_pagamento_protegido()'
  ]
  loop
    execute format('revoke all on function %s from public', v_assinatura);
  end loop;
end $$;

-- ============================================================
-- Realtime: o caixa acompanha vendas feitas em outro aparelho.
-- ============================================================
alter publication supabase_realtime add table public.sessoes_caixa;
alter publication supabase_realtime add table public.movimentacoes_caixa;
