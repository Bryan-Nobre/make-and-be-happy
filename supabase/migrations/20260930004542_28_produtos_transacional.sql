-- ============================================================
-- Produtos: salvar/duplicar em uma única transação, preço > 0 e
-- bloqueio de venda com categoria ou setor inativo.
-- ============================================================

-- ------------------------------------------------------------
-- Preço de produto precisa ser maior que zero.
-- ------------------------------------------------------------
alter table public.produtos drop constraint produtos_preco_check;
alter table public.produtos add constraint produtos_preco_check check (preco > 0);

-- ------------------------------------------------------------
-- Grava os vínculos do produto com grupos de adicionais.
-- ------------------------------------------------------------
create or replace function app.definir_grupos_produto(
  p_empresa uuid,
  p_produto uuid,
  p_grupos uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.produto_grupo_adicional
  where empresa_id = p_empresa and produto_id = p_produto;

  insert into public.produto_grupo_adicional (empresa_id, produto_id, grupo_id, ordem)
  select p_empresa, p_produto, g.grupo_id, (g.ordem - 1)::integer
  from unnest(coalesce(p_grupos, '{}'::uuid[])) with ordinality as g(grupo_id, ordem);
end;
$$;

revoke execute on function app.definir_grupos_produto(uuid, uuid, uuid[]) from public, anon;

-- ------------------------------------------------------------
-- salvar_produto: cria ou edita o produto e seus vínculos. Tudo ou
-- nada; a auditoria de preço (gatilho) roda na mesma transação.
-- ------------------------------------------------------------
create or replace function public.salvar_produto(
  p_empresa uuid,
  p_produto uuid,
  p_nome text,
  p_descricao text,
  p_preco numeric,
  p_codigo text,
  p_categoria uuid,
  p_setor uuid,
  p_grupos uuid[]
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

  if p_preco is null or p_preco <= 0 then
    raise exception 'Informe um preço maior que zero.';
  end if;
  if coalesce(cardinality(p_grupos), 0) <> (select count(distinct g) from unnest(coalesce(p_grupos, '{}'::uuid[])) g) then
    raise exception 'O mesmo grupo de adicionais foi escolhido duas vezes.';
  end if;

  begin
    if p_produto is null then
      insert into public.produtos (
        empresa_id, nome, descricao, preco, codigo, categoria_id, setor_id
      )
      values (
        p_empresa, btrim(coalesce(p_nome, '')),
        nullif(btrim(coalesce(p_descricao, '')), ''),
        round(p_preco, 2), nullif(btrim(coalesce(p_codigo, '')), ''),
        p_categoria, p_setor
      )
      returning id into v_id;
    else
      update public.produtos
      set nome = btrim(coalesce(p_nome, '')),
          descricao = nullif(btrim(coalesce(p_descricao, '')), ''),
          preco = round(p_preco, 2),
          codigo = nullif(btrim(coalesce(p_codigo, '')), ''),
          categoria_id = p_categoria,
          setor_id = p_setor
      where empresa_id = p_empresa and id = p_produto
      returning id into v_id;

      if v_id is null then
        raise exception 'Produto não encontrado.';
      end if;
    end if;

    perform app.definir_grupos_produto(p_empresa, v_id, p_grupos);
  exception
    when unique_violation then
      raise exception 'Este código já está em uso por outro produto.';
    when foreign_key_violation then
      raise exception 'Categoria, setor ou grupo de adicionais inválido.';
    when check_violation or not_null_violation then
      raise exception 'Confira os dados do produto: nome (2 a 120 caracteres), preço, código e descrição.';
  end;

  return v_id;
end;
$$;

revoke execute on function public.salvar_produto(uuid, uuid, text, text, numeric, text, uuid, uuid, uuid[]) from public, anon;
grant execute on function public.salvar_produto(uuid, uuid, text, text, numeric, text, uuid, uuid, uuid[]) to authenticated, service_role;

-- ------------------------------------------------------------
-- duplicar_produto: cópia inativa e sem código, com os mesmos
-- grupos, na mesma transação.
-- ------------------------------------------------------------
create or replace function public.duplicar_produto(p_produto uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origem public.produtos;
  v_id uuid;
  v_grupos uuid[];
begin
  select * into v_origem from public.produtos where id = p_produto;
  if not found or not app.eh_membro(v_origem.empresa_id) then
    raise exception 'Produto não encontrado.';
  end if;
  perform app.exigir_papel(v_origem.empresa_id, array['owner', 'admin']::public.papel_usuario[]);

  insert into public.produtos (
    empresa_id, nome, descricao, preco, categoria_id, setor_id, imagem_url, ativo
  )
  values (
    v_origem.empresa_id, left(v_origem.nome || ' (cópia)', 120), v_origem.descricao,
    v_origem.preco, v_origem.categoria_id, v_origem.setor_id, v_origem.imagem_url, false
  )
  returning id into v_id;

  select coalesce(array_agg(grupo_id order by ordem), '{}'::uuid[]) into v_grupos
  from public.produto_grupo_adicional
  where empresa_id = v_origem.empresa_id and produto_id = p_produto;

  perform app.definir_grupos_produto(v_origem.empresa_id, v_id, v_grupos);

  return v_id;
end;
$$;

revoke execute on function public.duplicar_produto(uuid) from public, anon;
grant execute on function public.duplicar_produto(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- Venda: produto com categoria ou setor inativo não entra em
-- pedido enviado à produção.
-- ------------------------------------------------------------
create or replace function app.inserir_itens(p_empresa uuid, p_pedido uuid, p_itens jsonb, p_enviado boolean)
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

    select p.id, p.nome, p.preco, p.ativo, p.disponivel, p.setor_id,
           s.nome as nome_setor, s.ativo as setor_ativo,
           c.nome as nome_categoria, c.ativa as categoria_ativa
    into v_produto
    from public.produtos p
    join public.categorias c
      on c.empresa_id = p.empresa_id and c.id = p.categoria_id
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
    if not v_produto.categoria_ativa then
      raise exception 'O produto "%" pertence à categoria "%", que está inativa.',
        v_produto.nome, v_produto.nome_categoria;
    end if;
    if v_produto.setor_id is not null and not v_produto.setor_ativo then
      raise exception 'O produto "%" está ligado ao setor "%", que está inativo.',
        v_produto.nome, v_produto.nome_setor;
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

-- Rascunho: a categoria ou o setor podem ter sido desativados depois
-- que o item entrou no pedido. A confirmação revalida.
create or replace function public.confirmar_pedido(p_pedido uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos;
  v_itens integer;
  v_invalido record;
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

  select i.nome_produto, c.nome as categoria, c.ativa as categoria_ativa,
         s.nome as setor, s.ativo as setor_ativo
  into v_invalido
  from public.itens_pedido i
  join public.produtos p on p.empresa_id = i.empresa_id and p.id = i.produto_id
  join public.categorias c on c.empresa_id = p.empresa_id and c.id = p.categoria_id
  left join public.setores_cozinha s on s.empresa_id = i.empresa_id and s.id = i.setor_id
  where i.pedido_id = p_pedido
    and i.enviado_em is null
    and (not c.ativa or (i.setor_id is not null and not s.ativo))
  limit 1;

  if found then
    if not v_invalido.categoria_ativa then
      raise exception 'O produto "%" pertence à categoria "%", que está inativa.',
        v_invalido.nome_produto, v_invalido.categoria;
    end if;
    raise exception 'O produto "%" está ligado ao setor "%", que está inativo.',
      v_invalido.nome_produto, v_invalido.setor;
  end if;

  update public.itens_pedido
  set enviado_em = now()
  where pedido_id = p_pedido and enviado_em is null;

  update public.pedidos set status_operacional = 'CONFIRMED' where id = p_pedido;
end;
$$;
