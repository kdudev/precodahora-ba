import { createConfig } from './config.js';
import { createHttpClient } from './http/httpClient.js';
import { initializeSession } from './http/sessionManager.js';
import { serializeForm } from './utils/serialize.js';

export default class PrecoDaHoraClient {
  #client;
  #sessionReady = false;
  #config;

  constructor(options = {}) {
    this.#config = createConfig(options);
    this.#client = createHttpClient(this.#config);
  }

  async #ensureSession(page) {
    if (this.#sessionReady) return;

    await initializeSession(this.#client, page);
    this.#sessionReady = true;
  }

  /**
   * Retorna sugestões de produtos
   */
  async getSugestoes(item) {
    if (!item) {
      throw new Error('O parâmetro "item" é obrigatório');
    }

    await this.#ensureSession('/');

    return this.#client.post(
      '/sugestao/',
      serializeForm({ item })
    );
  }

  /**
   * Consulta produtos com filtros
   */
  async buscarProdutos(filters = {}) {
    await this.#ensureSession('/produtos/');

    const payload = serializeForm({
      termo: '',
      gtin: '',
      cnpj: '',
      horas: '',
      anp: '',
      codmun: '',
      latitude: '',
      longitude: '',
      raio: '',
      precomax: 0,
      precomin: 0,
      pagina: '',
      ordenar: '',
      categorias: '',
      processo: '',
      totalCategorias: '',
      totalRegistros: '',
      totalPaginas: '',
      pageview: '',
      ...filters
    });

    return this.#client.post('/produtos/', payload);
  }
}
