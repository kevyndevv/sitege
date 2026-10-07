-- =============================================================================
-- Tabelas antigas (clientes, pedidos): eram de uma versão anterior do projeto,
-- estão vazias e não são usadas pelo site novo. A política original liberava
-- tudo para QUALQUER usuário logado ("using true"). Agora só a administradora.
-- Aplicada em 06/10/2026 pelo SQL Editor. Não apaga dados.
-- =============================================================================
begin;
alter policy "Dono pode tudo em clientes" on public.clientes
  using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "Dono pode tudo em pedidos" on public.pedidos
  using ((select public.is_admin())) with check ((select public.is_admin()));
commit;
