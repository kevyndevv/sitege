-- =============================================================================
-- Moldura da foto da página inicial, escolhida no painel (Configurações).
--
-- Não apaga nada: só acrescenta uma coluna com valor padrão "madeira" e
-- permite que a dona (papel authenticated + RLS de admin) altere esse campo.
-- A leitura pública já está liberada para a tabela inteira.
-- =============================================================================
begin;

alter table public.business_settings
  add column if not exists hero_frame text not null default 'madeira'
  check (hero_frame in ('madeira', 'arco', 'polaroid', 'renda', 'dourada'));

comment on column public.business_settings.hero_frame is
  'Moldura da foto da página inicial: madeira, arco, polaroid, renda ou dourada.';

grant update (hero_frame) on public.business_settings to authenticated;

commit;
