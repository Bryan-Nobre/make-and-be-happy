-- Módulos opcionais no menu (além do pacote self-service).
-- Vazio = só Dashboard, Pedidos/PDV, Caixa, Estoque e Configurações.
-- A visibilidade no menu é UX; a autorização real continua em RLS/papel.

alter table public.empresas
  add column if not exists modulos_extras text[] not null default '{}';

alter table public.empresas
  drop constraint if exists empresas_modulos_extras_validos;

alter table public.empresas
  add constraint empresas_modulos_extras_validos
  check (
    modulos_extras <@ array[
      'mesas',
      'cozinha',
      'produtos',
      'clientes',
      'relatorios'
    ]::text[]
  );

comment on column public.empresas.modulos_extras is
  'Módulos opcionais exibidos no menu. Pacote base (dashboard, pdv, caixa, estoque, configuracoes) é sempre visível.';
