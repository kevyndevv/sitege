/**
 * Opções dos cookies de sessão do painel:
 *  - httpOnly: o JavaScript do navegador NÃO consegue ler a sessão (protege contra XSS);
 *  - secure (em produção): os cookies só trafegam por HTTPS;
 *  - sameSite=lax: não são enviados em requisições disparadas por outros sites (CSRF).
 * Por isso login, envio de fotos e leitura de dados do painel acontecem no servidor.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
