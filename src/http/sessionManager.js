import { Cookie } from 'tough-cookie';
import { parse } from 'node-html-parser';

export async function initializeSession(client, page) {
  const response = await client.get(page);

  const cookies = (response.headers['set-cookie'] || [])
    .map(Cookie.parse)
    .filter(Boolean)
    .map(c => `${c.key}=${c.value}`)
    .join('; ');

  const html = parse(response.data);
  const validateElement = html.querySelector('#validate');

  if (!validateElement) {
    throw new Error(
      'Falha ao inicializar sessão: token CSRF não encontrado'
    );
  }

  const csrfToken = validateElement.getAttribute('data-id');

  client.defaults.headers['X-CSRFToken'] = csrfToken;
  client.defaults.headers.Cookie = cookies;
}
