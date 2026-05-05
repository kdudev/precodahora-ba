import { Cookie } from 'tough-cookie';
import { parse } from 'node-html-parser';

function extractCookies(response) {
  return (response.headers['set-cookie'] || [])
    .map(Cookie.parse)
    .filter(Boolean)
    .map(c => `${c.key}=${c.value}`);
}

function extractCsrfToken(response) {
  const html = parse(response.data);
  const validateElement = html.querySelector('#validate');
  return validateElement?.getAttribute('data-id');
}

export async function initializeSession(client, page) {
  const rootResponse = await client.get('/');
  const pageResponse = page === '/' ? rootResponse : await client.get(page);

  const cookies = [...extractCookies(rootResponse), ...extractCookies(pageResponse)]
    .filter(Boolean)
    .join('; ');

  const csrfToken = extractCsrfToken(pageResponse) || extractCsrfToken(rootResponse);

  if (!csrfToken) {
    throw new Error(
      'Falha ao inicializar sessão: token CSRF não encontrado'
    );
  }

  client.defaults.headers['X-CSRFToken'] = csrfToken;
  client.defaults.headers.Cookie = cookies;
}
