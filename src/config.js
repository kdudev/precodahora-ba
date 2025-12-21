const DEFAULT_BASE_URL = 'https://precodahora.ba.gov.br/';

export function createConfig(options = {}) {
  return Object.freeze({
    baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
    timeout: options.timeout ?? 15000
  });
}

export const config = createConfig();
export default config;
