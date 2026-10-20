-- ============================================================
-- Seed demo — Restaurante Sabor da Casa
-- Limpa dados operacionais da empresa e recria cardápio, estoque,
-- mesas, clientes e movimentações / vendas de dias anteriores.
-- Mantém: empresa, membros, formas de pagamento.
-- ============================================================

do $$
declare
  v_empresa uuid := 'e249beb7-4741-4fb0-824d-8fd8e518c556';
  v_owner uuid := '89f70e5d-5a62-41ef-8b09-bff40655f768';
  v_caixa uuid := '4a3c74f0-33aa-41de-80df-45e8280ebdda';
  v_garcom uuid := '239ed837-198f-4cb4-9001-24d163461775';

  v_cozinha uuid;
  v_bar uuid;
  v_cat_lanches uuid;
  v_cat_pratos uuid;
  v_cat_bebidas uuid;
  v_cat_sobremesas uuid;

  v_g_ponto uuid;
  v_g_extra uuid;

  -- produtos
  v_xburguer uuid;
  v_xbacon uuid;
  v_frango uuid;
  v_picanha uuid;
  v_feijoada uuid;
  v_executivo uuid;
  v_refrigerante uuid;
  v_suco uuid;
  v_cerveja uuid;
  v_agua uuid;
  v_pudim uuid;
  v_brownie uuid;

  -- estoque
  v_pao uuid;
  v_carne uuid;
  v_bacon uuid;
  v_queijo uuid;
  v_alface uuid;
  v_tomate uuid;
  v_frango_est uuid;
  v_arroz uuid;
  v_feijao uuid;
  v_oleo uuid;
  v_refri_lata uuid;
  v_cerveja_long uuid;
  v_agua_garrafa uuid;
  v_leite uuid;
  v_acucar uuid;

  -- mesas / clientes
  v_mesa int;
  v_cli_ana uuid;
  v_cli_joao uuid;
  v_cli_carla uuid;
  v_cli_pedro uuid;
  v_cli_lucia uuid;

  v_sessao uuid;
  v_comanda uuid;
  v_pedido uuid;
  v_item uuid;
  v_mov uuid;
  v_lote uuid;
  v_dia date;
  v_i int;
  v_saldo numeric;
begin
  if not exists (select 1 from public.empresas where id = v_empresa) then
    raise exception 'Empresa demo não encontrada.';
  end if;

  -- Bypass de triggers de imutabilidade (somente neste bloco).
  perform set_config('session_replication_role', 'replica', true);

  -- ---- limpeza operacional ----
  delete from public.fichas_item_pedido_insumos
    where item_pedido_id in (
      select ip.id from public.itens_pedido ip
      join public.pedidos p on p.id = ip.pedido_id where p.empresa_id = v_empresa
    );
  delete from public.fichas_item_pedido
    where item_pedido_id in (
      select ip.id from public.itens_pedido ip
      join public.pedidos p on p.id = ip.pedido_id where p.empresa_id = v_empresa
    );
  delete from public.item_pedido_adicional
    where item_pedido_id in (
      select ip.id from public.itens_pedido ip
      join public.pedidos p on p.id = ip.pedido_id where p.empresa_id = v_empresa
    );
  delete from public.itens_pedido
    where pedido_id in (select id from public.pedidos where empresa_id = v_empresa);
  delete from public.historico_status_pedido
    where pedido_id in (select id from public.pedidos where empresa_id = v_empresa);
  delete from public.eventos_cozinha where empresa_id = v_empresa;
  delete from public.pagamentos where empresa_id = v_empresa;
  delete from public.movimentacoes_caixa where empresa_id = v_empresa;
  delete from public.sessoes_caixa where empresa_id = v_empresa;
  delete from public.pedidos where empresa_id = v_empresa;
  delete from public.comandas where empresa_id = v_empresa;
  delete from public.movimentacoes_estoque where empresa_id = v_empresa;
  delete from public.produto_insumos where empresa_id = v_empresa;
  delete from public.itens_estoque where empresa_id = v_empresa;
  delete from public.produto_grupo_adicional where empresa_id = v_empresa;
  delete from public.opcoes_adicionais where empresa_id = v_empresa;
  delete from public.grupos_adicionais where empresa_id = v_empresa;
  delete from public.produtos where empresa_id = v_empresa;
  delete from public.categorias where empresa_id = v_empresa;
  delete from public.setores_cozinha where empresa_id = v_empresa;
  delete from public.mesas where empresa_id = v_empresa;
  delete from public.clientes where empresa_id = v_empresa;
  delete from public.convites where empresa_id = v_empresa;
  delete from public.auditoria where empresa_id = v_empresa;

  update public.sequencias_empresa set valor = 1000 where empresa_id = v_empresa and tipo = 'PEDIDO';
  update public.sequencias_empresa set valor = 0 where empresa_id = v_empresa and tipo = 'COMANDA';
  update public.sequencias_empresa set valor = 0 where empresa_id = v_empresa and tipo = 'CAIXA';

  perform set_config('session_replication_role', 'origin', true);

  -- ---- empresa ----
  update public.empresas set
    nome = 'Restaurante Sabor da Casa',
    telefone = '(11) 3456-7890',
    endereco = 'Rua das Flores, 120 — Centro',
    horario_funcionamento = 'Ter a Dom, 11h às 15h e 18h às 23h',
    taxa_servico = 10,
    envio_automatico_cozinha = true,
    cnpj = '12.345.678/0001-90'
  where id = v_empresa;

  update public.formas_pagamento set ativa = true where empresa_id = v_empresa;

  -- ---- setores e categorias ----
  insert into public.setores_cozinha (empresa_id, nome, ordem, ativo)
  values (v_empresa, 'Cozinha', 1, true)
  returning id into v_cozinha;

  insert into public.setores_cozinha (empresa_id, nome, ordem, ativo)
  values (v_empresa, 'Bar', 2, true)
  returning id into v_bar;

  insert into public.categorias (empresa_id, nome, ordem, ativa)
  values (v_empresa, 'Lanches', 1, true) returning id into v_cat_lanches;
  insert into public.categorias (empresa_id, nome, ordem, ativa)
  values (v_empresa, 'Pratos', 2, true) returning id into v_cat_pratos;
  insert into public.categorias (empresa_id, nome, ordem, ativa)
  values (v_empresa, 'Bebidas', 3, true) returning id into v_cat_bebidas;
  insert into public.categorias (empresa_id, nome, ordem, ativa)
  values (v_empresa, 'Sobremesas', 4, true) returning id into v_cat_sobremesas;

  -- ---- adicionais ----
  insert into public.grupos_adicionais (empresa_id, nome, minimo, maximo, ativo)
  values (v_empresa, 'Ponto da carne', 1, 1, true) returning id into v_g_ponto;
  insert into public.opcoes_adicionais (empresa_id, grupo_id, nome, preco, ordem, ativo) values
    (v_empresa, v_g_ponto, 'Mal passada', 0, 1, true),
    (v_empresa, v_g_ponto, 'Ao ponto', 0, 2, true),
    (v_empresa, v_g_ponto, 'Bem passada', 0, 3, true);

  insert into public.grupos_adicionais (empresa_id, nome, minimo, maximo, ativo)
  values (v_empresa, 'Extras do lanche', 0, 3, true) returning id into v_g_extra;
  insert into public.opcoes_adicionais (empresa_id, grupo_id, nome, preco, ordem, ativo) values
    (v_empresa, v_g_extra, 'Bacon extra', 4.00, 1, true),
    (v_empresa, v_g_extra, 'Queijo extra', 3.00, 2, true),
    (v_empresa, v_g_extra, 'Ovo', 3.50, 3, true),
    (v_empresa, v_g_extra, 'Cheddar', 3.50, 4, true);

  -- ---- produtos ----
  insert into public.produtos (empresa_id, categoria_id, setor_id, nome, descricao, preco, codigo, ativo, disponivel)
  values (v_empresa, v_cat_lanches, v_cozinha, 'X-Burguer', 'Pão, blend 160g, queijo, alface e tomate', 28.90, 'XB01', true, true)
  returning id into v_xburguer;
  insert into public.produtos (empresa_id, categoria_id, setor_id, nome, descricao, preco, codigo, ativo, disponivel)
  values (v_empresa, v_cat_lanches, v_cozinha, 'X-Bacon', 'Burguer com bacon crocante e cheddar', 34.90, 'XB02', true, true)
  returning id into v_xbacon;
  insert into public.produtos (empresa_id, categoria_id, setor_id, nome, descricao, preco, codigo, ativo, disponivel)
  values (v_empresa, v_cat_lanches, v_cozinha, 'Frango Crocante', 'Filé empanado, maionese da casa', 29.90, 'FR01', true, true)
  returning id into v_frango;

  insert into public.produto_grupo_adicional (empresa_id, produto_id, grupo_id, ordem) values
    (v_empresa, v_xburguer, v_g_ponto, 1),
    (v_empresa, v_xburguer, v_g_extra, 2),
    (v_empresa, v_xbacon, v_g_ponto, 1),
    (v_empresa, v_xbacon, v_g_extra, 2);

  insert into public.produtos (empresa_id, categoria_id, setor_id, nome, descricao, preco, codigo, ativo, disponivel)
  values (v_empresa, v_cat_pratos, v_cozinha, 'Picanha na Chapa', '300g, arroz, feijão e vinagrete', 69.90, 'PC01', true, true)
  returning id into v_picanha;
  insert into public.produtos (empresa_id, categoria_id, setor_id, nome, descricao, preco, codigo, ativo, disponivel)
  values (v_empresa, v_cat_pratos, v_cozinha, 'Feijoada Completa', 'Porção individual com acompanhamentos', 49.90, 'FJ01', true, true)
  returning id into v_feijoada;
  insert into public.produtos (empresa_id, categoria_id, setor_id, nome, descricao, preco, codigo, ativo, disponivel)
  values (v_empresa, v_cat_pratos, v_cozinha, 'Prato Executivo', 'Proteína do dia, arroz, feijão e salada', 32.90, 'EX01', true, true)
  returning id into v_executivo;

  insert into public.produtos (empresa_id, categoria_id, setor_id, nome, descricao, preco, codigo, ativo, disponivel)
  values (v_empresa, v_cat_bebidas, v_bar, 'Refrigerante Lata', '350ml', 7.00, 'BB01', true, true)
  returning id into v_refrigerante;
  insert into public.produtos (empresa_id, categoria_id, setor_id, nome, descricao, preco, codigo, ativo, disponivel)
  values (v_empresa, v_cat_bebidas, v_bar, 'Suco Natural', 'Laranja ou limão — 400ml', 12.00, 'BB02', true, true)
  returning id into v_suco;
  insert into public.produtos (empresa_id, categoria_id, setor_id, nome, descricao, preco, codigo, ativo, disponivel)
  values (v_empresa, v_cat_bebidas, v_bar, 'Cerveja Long Neck', '355ml', 14.00, 'BB03', true, true)
  returning id into v_cerveja;
  insert into public.produtos (empresa_id, categoria_id, setor_id, nome, descricao, preco, codigo, ativo, disponivel)
  values (v_empresa, v_cat_bebidas, v_bar, 'Água Mineral', 'Com ou sem gás', 5.00, 'BB04', true, true)
  returning id into v_agua;

  insert into public.produtos (empresa_id, categoria_id, setor_id, nome, descricao, preco, codigo, ativo, disponivel)
  values (v_empresa, v_cat_sobremesas, v_cozinha, 'Pudim de Leite', 'Fatia generosa', 14.90, 'SB01', true, true)
  returning id into v_pudim;
  insert into public.produtos (empresa_id, categoria_id, setor_id, nome, descricao, preco, codigo, ativo, disponivel)
  values (v_empresa, v_cat_sobremesas, v_cozinha, 'Brownie com Sorvete', 'Brownie quente e bola de creme', 18.90, 'SB02', true, true)
  returning id into v_brownie;

  -- ---- estoque (saldo 0 + entradas via função) ----
  insert into public.itens_estoque (empresa_id, nome, categoria, unidade, quantidade_minima, codigo, ativo)
  values (v_empresa, 'Pão de hambúrguer', 'Padaria', 'UN', 20, 'EST-PAO', true) returning id into v_pao;
  insert into public.itens_estoque (empresa_id, nome, categoria, unidade, quantidade_minima, codigo, ativo)
  values (v_empresa, 'Blend bovino 160g', 'Carnes', 'UN', 30, 'EST-BLEND', true) returning id into v_carne;
  insert into public.itens_estoque (empresa_id, nome, categoria, unidade, quantidade_minima, codigo, ativo)
  values (v_empresa, 'Bacon fatiado', 'Carnes', 'KG', 1, 'EST-BACON', true) returning id into v_bacon;
  insert into public.itens_estoque (empresa_id, nome, categoria, unidade, quantidade_minima, codigo, ativo)
  values (v_empresa, 'Queijo muçarela', 'Laticínios', 'KG', 2, 'EST-QUEIJO', true) returning id into v_queijo;
  insert into public.itens_estoque (empresa_id, nome, categoria, unidade, quantidade_minima, codigo, ativo)
  values (v_empresa, 'Alface americana', 'Hortifruti', 'UN', 5, 'EST-ALFACE', true) returning id into v_alface;
  insert into public.itens_estoque (empresa_id, nome, categoria, unidade, quantidade_minima, codigo, ativo)
  values (v_empresa, 'Tomate', 'Hortifruti', 'KG', 2, 'EST-TOMATE', true) returning id into v_tomate;
  insert into public.itens_estoque (empresa_id, nome, categoria, unidade, quantidade_minima, codigo, ativo)
  values (v_empresa, 'Filé de frango', 'Carnes', 'KG', 3, 'EST-FRANGO', true) returning id into v_frango_est;
  insert into public.itens_estoque (empresa_id, nome, categoria, unidade, quantidade_minima, codigo, ativo)
  values (v_empresa, 'Arroz tipo 1', 'Secos', 'KG', 5, 'EST-ARROZ', true) returning id into v_arroz;
  insert into public.itens_estoque (empresa_id, nome, categoria, unidade, quantidade_minima, codigo, ativo)
  values (v_empresa, 'Feijão carioca', 'Secos', 'KG', 3, 'EST-FEIJAO', true) returning id into v_feijao;
  insert into public.itens_estoque (empresa_id, nome, categoria, unidade, quantidade_minima, codigo, ativo)
  values (v_empresa, 'Óleo de soja', 'Secos', 'L', 2, 'EST-OLEO', true) returning id into v_oleo;
  insert into public.itens_estoque (empresa_id, nome, categoria, unidade, quantidade_minima, codigo, ativo)
  values (v_empresa, 'Refrigerante lata', 'Bebidas', 'UN', 24, 'EST-REFRI', true) returning id into v_refri_lata;
  insert into public.itens_estoque (empresa_id, nome, categoria, unidade, quantidade_minima, codigo, ativo)
  values (v_empresa, 'Cerveja long neck', 'Bebidas', 'UN', 24, 'EST-CERV', true) returning id into v_cerveja_long;
  insert into public.itens_estoque (empresa_id, nome, categoria, unidade, quantidade_minima, codigo, ativo)
  values (v_empresa, 'Água mineral 500ml', 'Bebidas', 'UN', 12, 'EST-AGUA', true) returning id into v_agua_garrafa;
  insert into public.itens_estoque (empresa_id, nome, categoria, unidade, quantidade_minima, codigo, ativo)
  values (v_empresa, 'Leite integral', 'Laticínios', 'L', 4, 'EST-LEITE', true) returning id into v_leite;
  insert into public.itens_estoque (empresa_id, nome, categoria, unidade, quantidade_minima, codigo, ativo)
  values (v_empresa, 'Açúcar refinado', 'Secos', 'KG', 2, 'EST-ACUCAR', true) returning id into v_acucar;

  -- fichas técnicas
  insert into public.produto_insumos (empresa_id, produto_id, item_id, quantidade) values
    (v_empresa, v_xburguer, v_pao, 1),
    (v_empresa, v_xburguer, v_carne, 1),
    (v_empresa, v_xburguer, v_queijo, 0.030),
    (v_empresa, v_xbacon, v_pao, 1),
    (v_empresa, v_xbacon, v_carne, 1),
    (v_empresa, v_xbacon, v_bacon, 0.040),
    (v_empresa, v_xbacon, v_queijo, 0.040),
    (v_empresa, v_frango, v_pao, 1),
    (v_empresa, v_frango, v_frango_est, 0.180),
    (v_empresa, v_executivo, v_arroz, 0.150),
    (v_empresa, v_executivo, v_feijao, 0.100),
    (v_empresa, v_feijoada, v_feijao, 0.250),
    (v_empresa, v_feijoada, v_arroz, 0.150),
    (v_empresa, v_refrigerante, v_refri_lata, 1),
    (v_empresa, v_cerveja, v_cerveja_long, 1),
    (v_empresa, v_agua, v_agua_garrafa, 1),
    (v_empresa, v_pudim, v_leite, 0.080),
    (v_empresa, v_pudim, v_acucar, 0.030);

  -- entradas de estoque (últimos dias) via função oficial
  perform app.aplicar_movimento_estoque(v_empresa, v_pao, 'ENTRADA', 'MANUAL', 120, 'Compra semanal — pães', 'Fornecedor Padaria Central');
  perform app.aplicar_movimento_estoque(v_empresa, v_carne, 'ENTRADA', 'MANUAL', 100, 'Compra blends bovinos', 'Açougue Bom Corte');
  perform app.aplicar_movimento_estoque(v_empresa, v_bacon, 'ENTRADA', 'MANUAL', 5, 'Compra bacon', null);
  perform app.aplicar_movimento_estoque(v_empresa, v_queijo, 'ENTRADA', 'MANUAL', 8, 'Compra muçarela', null);
  perform app.aplicar_movimento_estoque(v_empresa, v_alface, 'ENTRADA', 'MANUAL', 20, 'Hortifruti — alface', null);
  perform app.aplicar_movimento_estoque(v_empresa, v_tomate, 'ENTRADA', 'MANUAL', 10, 'Hortifruti — tomate', null);
  perform app.aplicar_movimento_estoque(v_empresa, v_frango_est, 'ENTRADA', 'MANUAL', 12, 'Compra frango', null);
  perform app.aplicar_movimento_estoque(v_empresa, v_arroz, 'ENTRADA', 'MANUAL', 25, 'Compra arroz', null);
  perform app.aplicar_movimento_estoque(v_empresa, v_feijao, 'ENTRADA', 'MANUAL', 15, 'Compra feijão', null);
  perform app.aplicar_movimento_estoque(v_empresa, v_oleo, 'ENTRADA', 'MANUAL', 10, 'Compra óleo', null);
  perform app.aplicar_movimento_estoque(v_empresa, v_refri_lata, 'ENTRADA', 'MANUAL', 96, 'Compra refrigerantes', null);
  perform app.aplicar_movimento_estoque(v_empresa, v_cerveja_long, 'ENTRADA', 'MANUAL', 72, 'Compra cervejas', null);
  perform app.aplicar_movimento_estoque(v_empresa, v_agua_garrafa, 'ENTRADA', 'MANUAL', 48, 'Compra águas', null);
  perform app.aplicar_movimento_estoque(v_empresa, v_leite, 'ENTRADA', 'MANUAL', 12, 'Compra leite', null);
  perform app.aplicar_movimento_estoque(v_empresa, v_acucar, 'ENTRADA', 'MANUAL', 5, 'Compra açúcar', null);

  -- saídas / ajustes com datas antigas (replica para backdate)
  perform set_config('session_replication_role', 'replica', true);

  -- simula consumo dos últimos 7 dias ajustando saldos e lançando movimentos datados
  for v_i in 1..7 loop
    v_dia := (current_date - v_i);

    select quantidade into v_saldo from public.itens_estoque where id = v_pao;
    update public.itens_estoque set quantidade = v_saldo - 8 where id = v_pao;
    insert into public.movimentacoes_estoque (
      empresa_id, item_id, tipo, origem, variacao, saldo_anterior, saldo_resultante,
      motivo, membro_id, nome_membro, criado_em
    ) values (
      v_empresa, v_pao, 'SAIDA', 'MANUAL', -8, v_saldo, v_saldo - 8,
      'Baixa produção lanches — dia ' || to_char(v_dia, 'DD/MM'),
      v_owner, 'Marcos Ribeiro', v_dia + time '21:30'
    );

    select quantidade into v_saldo from public.itens_estoque where id = v_carne;
    update public.itens_estoque set quantidade = v_saldo - 8 where id = v_carne;
    insert into public.movimentacoes_estoque (
      empresa_id, item_id, tipo, origem, variacao, saldo_anterior, saldo_resultante,
      motivo, membro_id, nome_membro, criado_em
    ) values (
      v_empresa, v_carne, 'SAIDA', 'MANUAL', -8, v_saldo, v_saldo - 8,
      'Baixa blends — dia ' || to_char(v_dia, 'DD/MM'),
      v_owner, 'Marcos Ribeiro', v_dia + time '21:31'
    );

    select quantidade into v_saldo from public.itens_estoque where id = v_refri_lata;
    update public.itens_estoque set quantidade = v_saldo - 10 where id = v_refri_lata;
    insert into public.movimentacoes_estoque (
      empresa_id, item_id, tipo, origem, variacao, saldo_anterior, saldo_resultante,
      motivo, membro_id, nome_membro, criado_em
    ) values (
      v_empresa, v_refri_lata, 'SAIDA', 'MANUAL', -10, v_saldo, v_saldo - 10,
      'Venda bebidas — dia ' || to_char(v_dia, 'DD/MM'),
      v_caixa, 'Testando', v_dia + time '22:00'
    );
  end loop;

  -- item em alerta (quase no mínimo)
  select quantidade into v_saldo from public.itens_estoque where id = v_alface;
  update public.itens_estoque set quantidade = 4 where id = v_alface;
  insert into public.movimentacoes_estoque (
    empresa_id, item_id, tipo, origem, variacao, saldo_anterior, saldo_resultante,
    motivo, membro_id, nome_membro, criado_em
  ) values (
    v_empresa, v_alface, 'AJUSTE', 'MANUAL', 4 - v_saldo, v_saldo, 4,
    'Inventário — alface murcha descartada',
    v_owner, 'Marcos Ribeiro', now() - interval '1 day'
  );

  -- ---- mesas e clientes ----
  for v_mesa in 1..10 loop
    insert into public.mesas (empresa_id, nome, lugares, ativa, ordem)
    values (v_empresa, 'Mesa ' || v_mesa, case when v_mesa <= 4 then 2 when v_mesa <= 8 then 4 else 6 end, true, v_mesa);
  end loop;

  insert into public.clientes (empresa_id, nome, telefone, ativo)
  values (v_empresa, 'Ana Souza', '11999887766', true) returning id into v_cli_ana;
  insert into public.clientes (empresa_id, nome, telefone, ativo)
  values (v_empresa, 'João Pereira', '11988776655', true) returning id into v_cli_joao;
  insert into public.clientes (empresa_id, nome, telefone, ativo)
  values (v_empresa, 'Carla Mendes', '11977665544', true) returning id into v_cli_carla;
  insert into public.clientes (empresa_id, nome, telefone, ativo)
  values (v_empresa, 'Pedro Lima', '11966554433', true) returning id into v_cli_pedro;
  insert into public.clientes (empresa_id, nome, telefone, ativo)
  values (v_empresa, 'Lúcia Ferreira', '11955443322', true) returning id into v_cli_lucia;

  -- ---- vendas históricas (3 noites fechadas) ----
  for v_i in 1..3 loop
    v_dia := (current_date - (v_i + 1));

    insert into public.sessoes_caixa (
      empresa_id, numero, terminal, status, valor_inicial,
      aberta_por, nome_abertura, aberta_em,
      fechada_por, nome_fechamento, fechada_em,
      dinheiro_esperado, dinheiro_informado,
      total_dinheiro, total_pix, total_debito, total_credito, total_estornos
    ) values (
      v_empresa, v_i, 'Principal', 'CLOSED', 200.00,
      v_caixa, 'Testando', v_dia + time '11:00',
      v_caixa, 'Testando', v_dia + time '23:15',
      520.00, 520.00,
      320.00, 410.00, 180.00, 95.00, 0
    ) returning id into v_sessao;

    insert into public.movimentacoes_caixa (
      empresa_id, sessao_id, tipo, metodo, valor, descricao, membro_id, criado_em
    ) values (
      v_empresa, v_sessao, 'ABERTURA', 'DINHEIRO', 200.00, 'Fundo de troco', v_caixa, v_dia + time '11:00'
    );

    -- pedido balcão pago
    insert into public.pedidos (
      empresa_id, numero, origem, status_operacional, status_financeiro,
      subtotal, desconto, acrescimo, valor_pago, identificacao,
      criado_por, criado_em, confirmado_em, preparo_em, pronto_em, entregue_em, cliente_id
    ) values (
      v_empresa, 1000 + v_i, 'BALCAO', 'DELIVERED', 'PAID',
      63.80, 0, 0, 63.80, 'Carlos',
      v_caixa, v_dia + time '12:20', v_dia + time '12:20', v_dia + time '12:25',
      v_dia + time '12:40', v_dia + time '12:45', v_cli_joao
    ) returning id into v_pedido;

    insert into public.itens_pedido (
      empresa_id, pedido_id, produto_id, nome_produto, preco_unitario, quantidade,
      setor_id, nome_setor, enviado_em
    ) values
      (v_empresa, v_pedido, v_xbacon, 'X-Bacon', 34.90, 1, v_cozinha, 'Cozinha', v_dia + time '12:20'),
      (v_empresa, v_pedido, v_refrigerante, 'Refrigerante Lata', 7.00, 2, v_bar, 'Bar', v_dia + time '12:20'),
      (v_empresa, v_pedido, v_pudim, 'Pudim de Leite', 14.90, 1, v_cozinha, 'Cozinha', v_dia + time '12:20');

    v_lote := gen_random_uuid();
    insert into public.movimentacoes_caixa (
      empresa_id, sessao_id, tipo, metodo, valor, descricao, membro_id, criado_em
    ) values (
      v_empresa, v_sessao, 'VENDA', 'PIX', 63.80, 'Pedido balcão #' || (1000 + v_i), v_caixa, v_dia + time '12:50'
    ) returning id into v_mov;

    insert into public.pagamentos (
      empresa_id, sessao_id, pedido_id, metodo, valor, status, movimentacao_id, lote_id, ordem, criado_por, criado_em
    ) values (
      v_empresa, v_sessao, v_pedido, 'PIX', 63.80, 'CONFIRMADO', v_mov, v_lote, 1, v_caixa, v_dia + time '12:50'
    );

    -- comanda mesa paga
    insert into public.comandas (
      empresa_id, numero, mesa_id, cliente_id, pessoas, status, taxa_servico_percentual,
      aberta_por, aberta_em, conta_pedida_em, fechada_em
    )
    select
      v_empresa, v_i, m.id, v_cli_ana, 2, 'CLOSED', 10,
      v_garcom, v_dia + time '19:00', v_dia + time '21:10', v_dia + time '21:25'
    from public.mesas m
    where m.empresa_id = v_empresa and m.ordem = v_i
    returning id into v_comanda;

    insert into public.pedidos (
      empresa_id, numero, origem, comanda_id, status_operacional, status_financeiro,
      subtotal, desconto, acrescimo, valor_pago, cliente_id,
      criado_por, criado_em, confirmado_em, preparo_em, pronto_em, entregue_em
    ) values (
      v_empresa, 1100 + v_i, 'MESA', v_comanda, 'DELIVERED', 'PAID',
      118.80, 0, 0, 130.68, v_cli_ana,
      v_garcom, v_dia + time '19:15', v_dia + time '19:15', v_dia + time '19:20',
      v_dia + time '19:45', v_dia + time '19:50'
    ) returning id into v_pedido;

    -- total comanda = subtotal + 10% ; valor_pago na comanda é via pagamentos
    -- Ajustamos valor_pago do pedido para o total com taxa já no pagamento da comanda
    update public.pedidos set valor_pago = 0, status_financeiro = 'PAID' where id = v_pedido;

    insert into public.itens_pedido (
      empresa_id, pedido_id, produto_id, nome_produto, preco_unitario, quantidade,
      setor_id, nome_setor, enviado_em
    ) values
      (v_empresa, v_pedido, v_picanha, 'Picanha na Chapa', 69.90, 1, v_cozinha, 'Cozinha', v_dia + time '19:15'),
      (v_empresa, v_pedido, v_cerveja, 'Cerveja Long Neck', 14.00, 2, v_bar, 'Bar', v_dia + time '19:15'),
      (v_empresa, v_pedido, v_brownie, 'Brownie com Sorvete', 18.90, 1, v_cozinha, 'Cozinha', v_dia + time '19:15'),
      (v_empresa, v_pedido, v_agua, 'Água Mineral', 5.00, 1, v_bar, 'Bar', v_dia + time '19:15');

    v_lote := gen_random_uuid();
    insert into public.movimentacoes_caixa (
      empresa_id, sessao_id, tipo, metodo, valor, descricao, membro_id, criado_em
    ) values (
      v_empresa, v_sessao, 'VENDA', 'CREDITO', 130.68, 'Comanda mesa #' || v_i, v_caixa, v_dia + time '21:20'
    ) returning id into v_mov;

    insert into public.pagamentos (
      empresa_id, sessao_id, comanda_id, metodo, valor, status, movimentacao_id, lote_id, ordem, criado_por, criado_em
    ) values (
      v_empresa, v_sessao, v_comanda, 'CREDITO', 130.68, 'CONFIRMADO', v_mov, v_lote, 1, v_caixa, v_dia + time '21:20'
    );
  end loop;

  -- caixa aberto hoje (para demo de operação)
  insert into public.sessoes_caixa (
    empresa_id, numero, terminal, status, valor_inicial,
    aberta_por, nome_abertura, aberta_em
  ) values (
    v_empresa, 4, 'Principal', 'OPEN', 250.00,
    v_caixa, 'Testando', date_trunc('day', now()) + time '11:05'
  ) returning id into v_sessao;

  insert into public.movimentacoes_caixa (
    empresa_id, sessao_id, tipo, metodo, valor, descricao, membro_id, criado_em
  ) values (
    v_empresa, v_sessao, 'ABERTURA', 'DINHEIRO', 250.00, 'Abertura do dia', v_caixa, date_trunc('day', now()) + time '11:05'
  );

  -- pedido em produção agora (cozinha)
  insert into public.pedidos (
    empresa_id, numero, origem, status_operacional, status_financeiro,
    subtotal, valor_pago, identificacao,
    criado_por, criado_em, confirmado_em, preparo_em
  ) values (
    v_empresa, 1201, 'BALCAO', 'PREPARING', 'UNPAID',
    42.90, 0, 'Mariana',
    v_garcom, now() - interval '18 minutes', now() - interval '18 minutes', now() - interval '12 minutes'
  ) returning id into v_pedido;

  insert into public.itens_pedido (
    empresa_id, pedido_id, produto_id, nome_produto, preco_unitario, quantidade,
    setor_id, nome_setor, enviado_em, observacoes
  ) values
    (v_empresa, v_pedido, v_xburguer, 'X-Burguer', 28.90, 1, v_cozinha, 'Cozinha', now() - interval '18 minutes', 'Sem cebola'),
    (v_empresa, v_pedido, v_refrigerante, 'Refrigerante Lata', 7.00, 2, v_bar, 'Bar', now() - interval '18 minutes', null);

  insert into public.eventos_cozinha (empresa_id, pedido_id, tipo, criado_em)
  values (v_empresa, v_pedido, 'ATUALIZADO', now() - interval '18 minutes');

  insert into public.pedidos (
    empresa_id, numero, origem, status_operacional, status_financeiro,
    subtotal, valor_pago, identificacao,
    criado_por, criado_em, confirmado_em
  ) values (
    v_empresa, 1202, 'BALCAO', 'CONFIRMED', 'UNPAID',
    49.90, 0, 'Rafael',
    v_garcom, now() - interval '6 minutes', now() - interval '6 minutes'
  ) returning id into v_pedido;

  insert into public.itens_pedido (
    empresa_id, pedido_id, produto_id, nome_produto, preco_unitario, quantidade,
    setor_id, nome_setor, enviado_em
  ) values
    (v_empresa, v_pedido, v_feijoada, 'Feijoada Completa', 49.90, 1, v_cozinha, 'Cozinha', now() - interval '6 minutes');

  insert into public.eventos_cozinha (empresa_id, pedido_id, tipo, criado_em)
  values (v_empresa, v_pedido, 'ATUALIZADO', now() - interval '6 minutes');

  update public.sequencias_empresa set valor = 1202 where empresa_id = v_empresa and tipo = 'PEDIDO';
  update public.sequencias_empresa set valor = 3 where empresa_id = v_empresa and tipo = 'COMANDA';
  update public.sequencias_empresa set valor = 4 where empresa_id = v_empresa and tipo = 'CAIXA';

  perform set_config('session_replication_role', 'origin', true);

  insert into public.auditoria (empresa_id, acao, entidade, entidade_id, usuario_id, dados)
  values (
    v_empresa,
    'seed.demo',
    'empresas',
    v_empresa::text,
    null,
    jsonb_build_object('descricao', 'Dados fictícios para demonstração')
  );
end $$;
