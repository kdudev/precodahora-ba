const DEFAULT_BASE_URL = 'https://precodahora.ba.gov.br/';

function normalizeProxy(proxy) {
  if (!proxy || typeof proxy !== 'object') return proxy;
  return { protocol: 'http', ...proxy };
}

export function createConfig(options = {}) {
  const maxConcurrentPages = Number.isInteger(options.maxConcurrentPages)
    ? Math.max(1, options.maxConcurrentPages)
    : 4;

  const retries = Number.isInteger(options.retries)
    ? Math.max(0, options.retries)
    : 2;

  const retryDelayMs = Number.isInteger(options.retryDelayMs)
    ? Math.max(0, options.retryDelayMs)
    : 400;

  return Object.freeze({
    baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
    timeout: options.timeout ?? 15000,
    retries,
    retryDelayMs,
    maxConcurrentPages,
    proxy: normalizeProxy(options.proxy ?? null),
    proxies: Array.isArray(options.proxies) ? options.proxies.map(normalizeProxy) : []
  });
}

export const config = createConfig();
export default config;
