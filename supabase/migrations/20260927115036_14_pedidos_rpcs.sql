-- ============================================================
-- RPCs de pedido
--
-- O navegador nunca escreve em pedidos/itens diretamente: envia
-- produto_id, quantidade e adicionais. Preço, nome, setor e
-- totais são resolvidos aqui (PRD 7 e 20).
-- ============================================================

-- ------------------------------------------------------------
-- Insere itens validando produto e regras de adicionais (PRD 13).
-- Formato de cada item:
--   { "produto_id": uuid, "quantidade": number,
--     "observacoes": text?, "adicionais": uuid[] }
-- ------------------------------------------------------------
create or replace function app.inserir_itens(
  p_empresa uuid,
  p_pedido uuid,
  p_itens jsonb,
  p_enviado boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_produto record;
  v_grupo record;
  v_opcoes uuid[];
  v_informadas integer;
  v_qtd numeric(12, 3);
  v_item_id uuid;
  v_escolhas integer;
  v_inseridos integer := 0;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Adicione pelo menos um item ao pedido.';
  end if;

  for v_item in select valor from jsonb_array_elements(p_itens) as valor
  loop
    v_qtd := coalesce((v_item ->> 'quantidade')::numeric, 0);
    if v_qtd <= 0 then
      raise exception 'A quantidade de cada item precisa ser maior que zero.';
    end if;

    select p.id, p.nome, p.preco, p.ativo, p.disponivel, p.setor_id, s.nome as nome_setor
    into v_produto
    from public.produtos p
    left join public.setores_cozinha s
      on s.empresa_id = p.empresa_id and s.id = p.setor_id
    where p.empresa_id = p_empresa and p.id = (v_item ->> 'produto_id')::uuid;

    if not found then
      raise exception 'Produto não encontrado neste restaurante.';
    end if;
    if not v_produto.ativo then
      raise exception 'O produto "%" saiu do cardápio e não pode ser vendido.', v_produto.nome;
    end if;
    if not v_produto.disponivel then
      raise exception 'O produto "%" está indisponível neste momento.', v_produto.nome;
    end if;

    select coalesce(array_agg(distinct e::uuid), '{}'::uuid[]), count(*)
    into v_opcoes, v_informadas
    from jsonb_array_elements_text(coalesce(v_item -> 'adicionais', '[]'::jsonb)) as e;

    if v_informadas <> cardinality(v_opcoes) then
      raise exception 'O mesmo adicional foi escolhido duas vezes em "%".', v_produto.nome;
    end if;

    -- Toda opção precisa estar ativa e pertencer a um grupo do produto.
    if exists (
      select 1
      from unnest(v_opcoes) as escolhida(id)
      where not exists (
        select 1
        from public.opcoes_adicionais oa
        join public.grupos_adicionais g
          on g.empresa_id = oa.empresa_id and g.id = oa.grupo_id
        join public.produto_grupo_adicional pga
          on pga.empresa_id = g.empresa_id
         and pga.grupo_id = g.id
         and pga.produto_id = v_produto.id
        where oa.empresa_id = p_empresa
          and oa.id = escolhida.id
          and oa.ativo
          and g.ativo
      )
    ) then
      raise exception 'Um dos adicionais escolhidos não está disponível para "%".', v_produto.nome;
    end if;

    for v_grupo in
      select g.id, g.nome, g.minimo, g.maximo
      from public.produto_grupo_adicional pga
      join public.grupos_adicionais g
        on g.empresa_id = pga.empresa_id and g.id = pga.grupo_id
      where pga.empresa_id = p_empresa and pga.produto_id = v_produto.id and g.ativo
    loop
      select count(*)
      into v_escolhas
      from public.opcoes_adicionais oa
      where oa.empresa_id = p_empresa
        and oa.grupo_id = v_grupo.id
        and oa.id = any(v_opcoes);

      if v_escolhas < v_grupo.minimo then
        raise exception 'Escolha pelo menos % opção em "%" para o produto "%".',
          v_grupo.minimo, v_grupo.nome, v_produto.nome;
      end if;
      if v_escolhas > v_grupo.maximo then
        raise exception 'Em "%" é possível escolher no máximo % opção.',
          v_grupo.nome, v_grupo.maximo;
      end if;
    end loop;

    insert into public.itens_pedido (
      empresa_id, pedido_id, produto_id, nome_produto, preco_unitario,
      quantidade, observacoes, setor_id, nome_setor, enviado_em
    )
    values (
      p_empresa, p_pedido, v_produto.id, v_produto.nome, v_produto.preco,
      v_qtd, nullif(btrim(coalesce(v_item ->> 'observacoes', '')), ''),
      v_produto.setor_id, v_produto.nome_setor,
      case when p_enviado then now() end
    )
    returning id into v_item_id;

    insert into public.item_pedido_adicional (
      empresa_id, item_pedido_id, opcao_id, nome_grupo, nome_opcao, preco
    )
    select p_empresa, v_item_id, oa.id, g.nome, oa.nome, oa.preco
    from public.opcoes_adicionais oa
    join public.grupos_adicionais g
      on g.empresa_id = oa.empresa_id and g.id = oa.grupo_id
    where oa.empresa_id = p_empresa and oa.id = any(v_opcoes);

    v_inseridos := v_inseridos + 1;
  end loop;

  return v_inseridos;
end;
$$;

-- ------------------------------------------------------------
-- Carrega um pedido garantindo que o usuário pertence à empresa.
-- ------------------------------------------------------------
create or replace function app.pedido_acessivel(p_pedido uuid)
returns public.pedidos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos;
begin
  select * into v_pedido from public.pedidos where id = p_pedido;
  if not found or not app.eh_membro(v_pedido.empresa_id) then
    raise exception 'Pedido não encontrado.';
  end if;
  return v_pedido;
end;
$$;

-- ------------------------------------------------------------
-- criar_pedido
-- ------------------------------------------------------------
create or replace function public.criar_pedido(
  p_empresa uuid,
  p_origem public.origem_pedido,
  p_itens jsonb,
  p_comanda uuid default null,
  p_confirmar boolean default true,
  p_desconto numeric default 0,
  p_acrescimo numeric default 0,
  p_observacoes text default null,
  p_client_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_papel public.papel_usuario;
  v_pedido uuid;
  v_comanda record;
  v_subtotal numeric(12, 2);
  v_desconto numeric(12, 2) := round(coalesce(p_desconto, 0), 2);
  v_acrescimo numeric(12, 2) := round(coalesce(p_acrescimo, 0), 2);
begin
  v_papel := app.exigir_papel(p_empresa, array['owner', 'admin', 'cashier', 'waiter']::public.papel_usuario[]);

  -- Reenvio da mesma requisição devolve o pedido já criado (PRD 22).
  if p_client_request_id is not null then
    select id into v_pedido
    from public.pedidos
    where empresa_id = p_empresa and client_request_id = p_client_request_id;
    if found then
      return v_pedido;
    end if;
  end if;

  if v_desconto < 0 or v_acrescimo < 0 then
    raise exception 'Desconto e acréscimo não podem ser negativos.';
  end if;

  if (v_desconto > 0 or v_acrescimo > 0)
     and v_papel not in ('owner', 'admin', 'cashier') then
    raise exception 'Seu perfil não pode aplicar desconto ou acréscimo.';
  end if;

  if p_origem = 'MESA' then
    if p_comanda is null then
      raise exception 'Escolha a comanda para lançar o pedido.';
    end if;

    select id, numero, status into v_comanda
    from public.comandas
    where empresa_id = p_empresa and id = p_comanda
    for update;

    if not found then
      raise exception 'Comanda não encontrada.';
    end if;
    if v_comanda.status not in ('OPEN', 'PAYMENT_PENDING') then
      raise exception 'A comanda #% não está aberta.', v_comanda.numero;
    end if;
  elsif p_comanda is not null then
    raise exception 'Pedido de balcão não usa comanda.';
  end if;

  insert into public.pedidos (
    empresa_id, numero, origem, comanda_id, observacoes, criado_por, client_request_id
  )
  values (
    p_empresa,
    app.proximo_numero(p_empresa, 'PEDIDO'),
    p_origem,
    p_comanda,
    nullif(btrim(coalesce(p_observacoes, '')), ''),
    app.membro_atual(p_empresa),
    p_client_request_id
  )
  returning id into v_pedido;

  perform app.inserir_itens(p_empresa, v_pedido, p_itens, p_confirmar);

  select subtotal into v_subtotal from public.pedidos where id = v_pedido;

  if v_desconto > v_subtotal then
    raise exception 'O desconto não pode passar do subtotal do pedido.';
  end if;

  update public.pedidos
  set desconto = v_desconto,
      acrescimo = v_acrescimo,
      status_operacional = case when p_confirmar then 'CONFIRMED' else 'DRAFT' end
  where id = v_pedido;

  -- Lançar em comanda que já pediu a conta reabre o consumo.
  if p_origem = 'MESA' and v_comanda.status = 'PAYMENT_PENDING' then
    update public.comandas
    set status = 'OPEN', conta_pedida_em = null
    where id = p_comanda;
  end if;

  if v_desconto > 0 or v_acrescimo > 0 then
    perform app.registrar_auditoria(
      p_empresa, 'pedido.valores_aplicados', 'pedidos', v_pedido::text,
      jsonb_build_object('desconto', v_desconto, 'acrescimo', v_acrescimo)
    );
  end if;

  return v_pedido;
end;
$$;

-- ------------------------------------------------------------
-- adicionar_itens_pedido
-- ------------------------------------------------------------
create or replace function public.adicionar_itens_pedido(
  p_pedido uuid,
  p_itens jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos;
begin
  v_pedido := app.pedido_acessivel(p_pedido);
  perform app.exigir_papel(v_pedido.empresa_id,
    array['owner', 'admin', 'cashier', 'waiter']::public.papel_usuario[]);

  if v_pedido.status_operacional in ('READY', 'DELIVERED', 'CANCELLED') then
    raise exception 'O pedido #% já está % e não aceita novos itens.',
      v_pedido.numero, app.rotulo_status(v_pedido.status_operacional);
  end if;

  -- Item lançado em pedido já enviado vai direto para a produção.
  perform app.inserir_itens(
    v_pedido.empresa_id, p_pedido, p_itens,
    v_pedido.status_operacional <> 'DRAFT'
  );
end;
$$;

-- ------------------------------------------------------------
-- alterar_item_pedido / remover_item_pedido
-- ------------------------------------------------------------
create or replace function public.alterar_item_pedido(
  p_item uuid,
  p_quantidade numeric,
  p_observacoes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  select empresa_id into v_empresa from public.itens_pedido where id = p_item;
  if not found or not app.eh_membro(v_empresa) then
    raise exception 'Item não encontrado.';
  end if;

  perform app.exigir_papel(v_empresa,
    array['owner', 'admin', 'cashier', 'waiter']::public.papel_usuario[]);

  if coalesce(p_quantidade, 0) <= 0 then
    raise exception 'A quantidade precisa ser maior que zero. Para retirar o item, remova-o.';
  end if;

  update public.itens_pedido
  set quantidade = round(p_quantidade, 3),
      observacoes = nullif(btrim(coalesce(p_observacoes, '')), '')
  where id = p_item;
end;
$$;

create or replace function public.remover_item_pedido(p_item uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_restantes integer;
begin
  select i.empresa_id, i.pedido_id, p.numero
  into v_item
  from public.itens_pedido i
  join public.pedidos p on p.id = i.pedido_id
  where i.id = p_item;

  if not found or not app.eh_membro(v_item.empresa_id) then
    raise exception 'Item não encontrado.';
  end if;

  perform app.exigir_papel(v_item.empresa_id,
    array['owner', 'admin', 'cashier', 'waiter']::public.papel_usuario[]);

  select count(*) into v_restantes
  from public.itens_pedido
  where pedido_id = v_item.pedido_id;

  -- Pedido não pode ficar vazio: nesse caso o certo é cancelar (PRD 7).
  if v_restantes <= 1 then
    raise exception 'Este é o único item do pedido #%. Cancele o pedido informando o motivo.',
      v_item.numero;
  end if;

  delete from public.itens_pedido where id = p_item;
end;
$$;

-- ------------------------------------------------------------
-- confirmar_pedido: envia para a cozinha
-- ------------------------------------------------------------
create or replace function public.confirmar_pedido(p_pedido uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos;
  v_itens integer;
begin
  v_pedido := app.pedido_acessivel(p_pedido);
  perform app.exigir_papel(v_pedido.empresa_id,
    array['owner', 'admin', 'cashier', 'waiter']::public.papel_usuario[]);

  if v_pedido.status_operacional <> 'DRAFT' then
    raise exception 'O pedido #% já foi enviado para a cozinha.', v_pedido.numero;
  end if;

  select count(*) into v_itens from public.itens_pedido where pedido_id = p_pedido;
  if v_itens = 0 then
    raise exception 'Não é possível enviar um pedido sem itens.';
  end if;

  update public.itens_pedido
  set enviado_em = now()
  where pedido_id = p_pedido and enviado_em is null;

  update public.pedidos set status_operacional = 'CONFIRMED' where id = p_pedido;
end;
$$;

-- ------------------------------------------------------------
-- avancar_status_pedido: usado pelo KDS (PRD 10)
-- ------------------------------------------------------------
create or replace function public.avancar_status_pedido(
  p_pedido uuid,
  p_para public.status_operacional_pedido
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos;
begin
  v_pedido := app.pedido_acessivel(p_pedido);

  if p_para = 'CANCELLED' then
    raise exception 'Use o cancelamento de pedido, que exige motivo.';
  end if;

  if p_para = 'DELIVERED' then
    perform app.exigir_papel(v_pedido.empresa_id,
      array['owner', 'admin', 'cashier', 'waiter', 'kitchen']::public.papel_usuario[]);
  else
    perform app.exigir_papel(v_pedido.empresa_id,
      array['owner', 'admin', 'kitchen', 'cashier']::public.papel_usuario[]);
  end if;

  if v_pedido.status_operacional = p_para then
    return;
  end if;

  update public.pedidos set status_operacional = p_para where id = p_pedido;
end;
$$;

-- ------------------------------------------------------------
-- cancelar_pedido: nunca apaga, sempre registra motivo (PRD 7)
-- ------------------------------------------------------------
create or replace function public.cancelar_pedido(
  p_pedido uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos;
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  v_pedido := app.pedido_acessivel(p_pedido);

  if length(v_motivo) < 3 then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  -- Antes do envio o garçom pode desfazer; depois, só quem responde pelo caixa.
  if v_pedido.status_operacional = 'DRAFT' then
    perform app.exigir_papel(v_pedido.empresa_id,
      array['owner', 'admin', 'cashier', 'waiter']::public.papel_usuario[]);
  else
    perform app.exigir_papel(v_pedido.empresa_id,
      array['owner', 'admin', 'cashier']::public.papel_usuario[]);
  end if;

  update public.pedidos
  set status_operacional = 'CANCELLED',
      motivo_cancelamento = v_motivo,
      cancelado_por = app.membro_atual(v_pedido.empresa_id)
  where id = p_pedido;

  perform app.registrar_auditoria(
    v_pedido.empresa_id, 'pedido.cancelado', 'pedidos', p_pedido::text,
    jsonb_build_object(
      'numero', v_pedido.numero,
      'total', v_pedido.total,
      'status_anterior', v_pedido.status_operacional,
      'motivo', v_motivo
    )
  );
end;
$$;

-- ------------------------------------------------------------
-- ajustar_valores_pedido: desconto e acréscimo separados (PRD 7)
-- ------------------------------------------------------------
create or replace function public.ajustar_valores_pedido(
  p_pedido uuid,
  p_desconto numeric,
  p_acrescimo numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos;
  v_desconto numeric(12, 2) := round(coalesce(p_desconto, 0), 2);
  v_acrescimo numeric(12, 2) := round(coalesce(p_acrescimo, 0), 2);
begin
  v_pedido := app.pedido_acessivel(p_pedido);
  perform app.exigir_papel(v_pedido.empresa_id,
    array['owner', 'admin', 'cashier']::public.papel_usuario[]);

  if v_desconto < 0 or v_acrescimo < 0 then
    raise exception 'Desconto e acréscimo não podem ser negativos.';
  end if;
  if v_desconto > v_pedido.subtotal then
    raise exception 'O desconto não pode passar do subtotal do pedido.';
  end if;
  if v_pedido.status_financeiro <> 'UNPAID' then
    raise exception 'O pedido #% já tem pagamento registrado.', v_pedido.numero;
  end if;

  update public.pedidos
  set desconto = v_desconto, acrescimo = v_acrescimo
  where id = p_pedido;

  perform app.registrar_auditoria(
    v_pedido.empresa_id, 'pedido.valores_alterados', 'pedidos', p_pedido::text,
    jsonb_build_object(
      'numero', v_pedido.numero,
      'desconto_antes', v_pedido.desconto, 'desconto_depois', v_desconto,
      'acrescimo_antes', v_pedido.acrescimo, 'acrescimo_depois', v_acrescimo
    )
  );
end;
$$;
