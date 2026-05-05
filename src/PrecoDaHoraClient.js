import { createConfig } from './config.js';
import { createHttpClient } from './http/httpClient.js';
import { initializeSession } from './http/sessionManager.js';
import { resolveMunicipioCoordinates } from './utils/municipioResolver.js';
import { serializeForm } from './utils/serialize.js';

const RETRYABLE_STATUS = new Set([401, 403, 408, 409, 419, 425, 429, 500, 502, 503, 504]);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

export default class PrecoDaHoraClient {
  #client;
  #sessionReady = false;
  #config;
  #proxyCursor = 0;

  constructor(options = {}) {
    this.#config = createConfig(options);
    this.#client = createHttpClient(this.#config);
  }

  async #ensureSession(page, { force = false } = {}) {
    if (this.#sessionReady && !force) return;

    await initializeSession(this.#client, page);
    this.#sessionReady = true;
  }

  #pickProxy() {
    if (this.#config.proxies.length > 0) {
      const proxy = this.#config.proxies[this.#proxyCursor % this.#config.proxies.length];
      this.#proxyCursor += 1;
      return proxy;
    }

    return this.#config.proxy ?? undefined;
  }

  #buildRequestConfig() {
    const proxy = this.#pickProxy();

    if (proxy === undefined) {
      return undefined;
    }

    return { proxy: proxy ?? false };
  }

  #shouldRetry(error) {
    if (!error?.response) return true;
    return RETRYABLE_STATUS.has(error.response.status);
  }

  async #postWithRetry(url, payload, sessionPage) {
    const maxRetries = this.#config.retries;
    let attempt = 0;

    while (attempt <= maxRetries) {
      await this.#ensureSession(sessionPage, { force: attempt > 0 });

      try {
        const requestConfig = this.#buildRequestConfig();
        return await this.#client.post(url, payload, requestConfig);
      } catch (error) {
        if (attempt >= maxRetries || !this.#shouldRetry(error)) {
          throw error;
        }

        const waitMs = this.#config.retryDelayMs * (2 ** attempt);
        attempt += 1;
        await sleep(waitMs);
      }
    }

    throw new Error('Falha inesperada ao enviar requisição');
  }

  async #buildProductPayload(filters = {}) {
    const payloadData = {
      termo: '',
      gtin: '',
      cnpj: '',
      horas: 72,
      anp: '',
      codmun: '',
      latitude: '',
      longitude: '',
      raio: 15,
      precomax: 0,
      precomin: 0,
      pagina: 1,
      ordenar: 'preco.asc',
      categorias: '',
      processo: 'carregar',
      totalCategorias: '',
      totalRegistros: 0,
      totalPaginas: 0,
      pageview: 'lista',
      ...filters
    };

    const municipioInformado = filters.municipio ?? filters.localidade;
    const codigoIBGEInformado = filters.codigoIBGE ?? payloadData.codmun;

    delete payloadData.municipio;
    delete payloadData.localidade;
    delete payloadData.codigoIBGE;

    const latitudeVazia = payloadData.latitude === '' || payloadData.latitude === undefined || payloadData.latitude === null;
    const longitudeVazia = payloadData.longitude === '' || payloadData.longitude === undefined || payloadData.longitude === null;

    if ((latitudeVazia || longitudeVazia) && (municipioInformado || codigoIBGEInformado)) {
      const municipioResolvido = await resolveMunicipioCoordinates({
        municipio: municipioInformado,
        codigoIBGE: codigoIBGEInformado
      });

      if (!municipioResolvido) {
        throw new Error('Município não encontrado na base da Bahia para preencher latitude/longitude');
      }

      payloadData.latitude = municipioResolvido.latitude;
      payloadData.longitude = municipioResolvido.longitude;
      payloadData.codmun = payloadData.codmun || municipioResolvido.codigoIBGE;
    }

    const hasTermo = String(payloadData.termo ?? '').trim().length > 0;
    const hasGtin = String(payloadData.gtin ?? '').trim().length > 0;
    const hasAnp = String(payloadData.anp ?? '').trim().length > 0;

    if (!hasTermo && !hasGtin && !hasAnp) {
      throw new Error('Informe ao menos um filtro principal: "termo", "gtin" ou "anp"');
    }

    if (payloadData.latitude === '' || payloadData.longitude === '') {
      throw new Error('Os campos "latitude" e "longitude" são obrigatórios para buscar produtos (ou informe "municipio")');
    }

    return serializeForm(payloadData);
  }

  async #buscarPagina(filters = {}) {
    const payload = await this.#buildProductPayload(filters);
    return this.#postWithRetry('/produtos/', payload, '/produtos/');
  }

  async resolverMunicipio(municipioOuCodigo) {
    const query = Number.isInteger(municipioOuCodigo)
      ? { codigoIBGE: municipioOuCodigo }
      : { municipio: municipioOuCodigo };

    return resolveMunicipioCoordinates(query);
  }

  /**
   * Valida e extrai o payload da resposta da API.
   * A API retorna { codigo: 80 } para sucesso.
   * Lança erro com a mensagem da API quando codigo != 80.
   */
  #parseApiResponse(response) {
    const data = response?.data ?? response;

    if (data?.codigo !== undefined && data.codigo !== 80) {
      throw new Error(`API retornou código de erro ${data.codigo}: ${data.mensagem ?? 'sem mensagem'}`);
    }

    return {
      codigo: data?.codigo,
      resultado: data?.resultado ?? [],
      totalRegistros: data?.totalRegistros ?? 0,
      totalPaginas: data?.totalPaginas ?? 0,
    };
  }

  /**
   * Retorna sugestões de produtos a partir de uma entrada parcial ou completa.
   * Inspirado na hourlyprice-api — retorna diretamente o array de sugestões.
   *
   * @param {string} item Texto para buscar sugestões (ex: "ÁGUA", "ABAC")
   * @returns {Promise<Array>} Lista de sugestões
   */
  async sugestao(item) {
    const termo = typeof item === 'object' ? item.item : item;

    if (!termo) {
      throw new Error('O parâmetro "item" é obrigatório');
    }

    const payload = serializeForm({ item: termo });
    const response = await this.#postWithRetry('/sugestao/', payload, '/');
    return this.#parseApiResponse(response).resultado;
  }

  /** @deprecated Use sugestao(item) */
  async getSugestoes(item) {
    return this.sugestao(item);
  }

  /**
   * Interface compatível com a hourlyprice-api.
   * Aceita os mesmos parâmetros e retorna { codigo, resultado, totalRegistros, totalPaginas }.
   *
   * @param {object} params
   * @param {string}  [params.termo]          Termo de busca livre
   * @param {number}  [params.gtin]           GTIN / código de barras
   * @param {string}  [params.cnpj]           CNPJ do estabelecimento
   * @param {number}  [params.horas=72]       Janela de tempo das notas fiscais
   * @param {string}  [params.anp]            Código ANP (combustíveis)
   * @param {string}  [params.codmun]         Código IBGE do município
   * @param {string}  [params.municipio]      Nome do município (resolvido automaticamente)
   * @param {number}  [params.latitude]       Latitude do ponto de busca
   * @param {number}  [params.longitude]      Longitude do ponto de busca
   * @param {number}  [params.raio=15]        Raio em km
   * @param {number}  [params.precomax=0]     Preço máximo (0 = sem limite)
   * @param {number}  [params.precomin=0]     Preço mínimo
   * @param {string}  [params.ordenar]        "preco.asc" ou "preco.desc"
   * @param {number}  [params.pagina=1]       Número da página
   * @returns {Promise<{codigo, resultado, totalRegistros, totalPaginas}>}
   */
  async produto(params = {}) {
    const response = await this.#buscarPagina(params);
    return this.#parseApiResponse(response);
  }

  /**
   * Consulta produtos com filtros
   */
  async buscarProdutos(filters = {}, options = {}) {
    if (options.allPages) {
      return this.buscarProdutosTodasPaginas(filters, options);
    }

    return this.#buscarPagina(filters);
  }

  /**
   * Consulta combustíveis por código ANP (ou filtros complementares)
   */
  async buscarCombustiveis(filters = {}, options = {}) {
    const fuelFilters = {
      termo: 'gasolina',
      gtin: '',
      ...filters
    };

    const hasFuelTerm = String(fuelFilters.termo ?? '').trim().length > 0;
    const hasFuelAnp = String(fuelFilters.anp ?? '').trim().length > 0;

    if (!hasFuelTerm && !hasFuelAnp) {
      throw new Error('Informe ao menos um filtro para combustíveis: "termo" ou "anp"');
    }

    if (options.allPages) {
      return this.buscarCombustiveisTodasPaginas(fuelFilters, options);
    }

    return this.#buscarPagina(fuelFilters);
  }

  /**
   * Consulta combustíveis em todas as páginas e agrega os resultados
   */
  async buscarCombustiveisTodasPaginas(filters = {}, options = {}) {
    const fuelFilters = {
      termo: 'gasolina',
      gtin: '',
      ...filters
    };

    const hasFuelTerm = String(fuelFilters.termo ?? '').trim().length > 0;
    const hasFuelAnp = String(fuelFilters.anp ?? '').trim().length > 0;

    if (!hasFuelTerm && !hasFuelAnp) {
      throw new Error('Informe ao menos um filtro para combustíveis: "termo" ou "anp"');
    }

    return this.buscarProdutosTodasPaginas(fuelFilters, options);
  }

  /**
   * Consulta todas as páginas em paralelo e agrega os resultados
   */
  async buscarProdutosTodasPaginas(filters = {}, options = {}) {
    const firstResponse = await this.#buscarPagina({
      ...filters,
      pagina: 1,
      processo: 'carregar'
    });

    const firstData = firstResponse.data ?? {};
    const discoveredPages = toPositiveInteger(firstData.totalPaginas, 1);
    const maxPages = Number.isInteger(options.maxPages)
      ? Math.max(1, options.maxPages)
      : discoveredPages;
    const totalPages = Math.min(discoveredPages, maxPages);

    const pages = new Array(totalPages);
    pages[0] = firstData;

    const remainingPages = [];
    for (let page = 2; page <= totalPages; page += 1) {
      remainingPages.push(page);
    }

    if (remainingPages.length > 0) {
      const concurrency = Number.isInteger(options.concurrency)
        ? Math.max(1, options.concurrency)
        : this.#config.maxConcurrentPages;

      let index = 0;
      const workers = Array.from({ length: Math.min(concurrency, remainingPages.length) }, async () => {
        while (index < remainingPages.length) {
          const currentIndex = index;
          index += 1;

          const pageNumber = remainingPages[currentIndex];
          const pageResponse = await this.#buscarPagina({
            ...filters,
            pagina: pageNumber,
            processo: 'carregar',
            totalRegistros: firstData.totalRegistros ?? 0,
            totalPaginas: firstData.totalPaginas ?? totalPages
          });

          pages[pageNumber - 1] = pageResponse.data ?? {};
        }
      });

      await Promise.all(workers);
    }

    const resultado = pages.flatMap(page => (Array.isArray(page?.resultado) ? page.resultado : []));

    return {
      ...firstData,
      resultado,
      registrosdaPagina: resultado.length,
      totalPaginas: totalPages,
      paginas: pages,
      paginasColetadas: pages.length
    };
  }

  async buscarProdutosCompletos(filters = {}, options = {}) {
    return this.buscarProdutosTodasPaginas(filters, options);
  }
}
