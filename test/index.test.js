import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createConfig } from '../src/config.js';
import { serializeForm } from '../src/utils/serialize.js';
import { resolveMunicipioCoordinates } from '../src/utils/municipioResolver.js';
import PrecoDaHoraClient from '../src/index.js';

// ---------------------------------------------------------------------------
// createConfig
// ---------------------------------------------------------------------------

describe('createConfig', () => {
  it('retorna valores padrão quando nenhuma opção é passada', () => {
    const cfg = createConfig();

    assert.equal(cfg.timeout, 15000);
    assert.equal(cfg.retries, 2);
    assert.equal(cfg.retryDelayMs, 400);
    assert.equal(cfg.maxConcurrentPages, 4);
    assert.equal(cfg.proxy, null);
    assert.deepEqual(cfg.proxies, []);
    assert.equal(cfg.baseUrl, 'https://precodahora.ba.gov.br/');
  });

  it('respeita as opções fornecidas', () => {
    const cfg = createConfig({ timeout: 5000, retries: 0, retryDelayMs: 200, maxConcurrentPages: 2 });

    assert.equal(cfg.timeout, 5000);
    assert.equal(cfg.retries, 0);
    assert.equal(cfg.retryDelayMs, 200);
    assert.equal(cfg.maxConcurrentPages, 2);
  });

  it('normaliza proxy sem protocol adicionando "http"', () => {
    const cfg = createConfig({ proxy: { host: '1.2.3.4', port: 8080 } });

    assert.equal(cfg.proxy.protocol, 'http');
    assert.equal(cfg.proxy.host, '1.2.3.4');
  });

  it('normaliza lista de proxies adicionando "http" em cada item', () => {
    const cfg = createConfig({
      proxies: [
        { host: '1.1.1.1', port: 3000 },
        { protocol: 'socks5', host: '2.2.2.2', port: 4000 }
      ]
    });

    assert.equal(cfg.proxies[0].protocol, 'http');
    assert.equal(cfg.proxies[1].protocol, 'socks5'); // não sobrescreve se já tem
  });

  it('retorna objeto congelado (imutável)', () => {
    const cfg = createConfig();
    assert.throws(() => { cfg.timeout = 999; });
  });

  it('garante maxConcurrentPages mínimo de 1', () => {
    const cfg = createConfig({ maxConcurrentPages: 0 });
    assert.equal(cfg.maxConcurrentPages, 1);
  });

  it('garante retries mínimo de 0', () => {
    const cfg = createConfig({ retries: -5 });
    assert.equal(cfg.retries, 0);
  });
});

// ---------------------------------------------------------------------------
// serializeForm
// ---------------------------------------------------------------------------

describe('serializeForm', () => {
  it('serializa campos simples em query string', () => {
    const result = serializeForm({ termo: 'arroz', pagina: 1 });
    assert.equal(result, 'termo=arroz&pagina=1');
  });

  it('filtra valores null e undefined', () => {
    const result = serializeForm({ a: 'ok', b: null, c: undefined, d: 0 });
    assert.equal(result, 'a=ok&d=0');
  });

  it('encoda caracteres especiais', () => {
    const result = serializeForm({ termo: 'acém bovino' });
    assert.ok(result.includes('ac%C3%A9m'));
    assert.ok(result.includes('bovino'));
  });

  it('retorna string vazia para objeto vazio', () => {
    assert.equal(serializeForm({}), '');
  });

  it('retorna string vazia quando todos os valores são null/undefined', () => {
    assert.equal(serializeForm({ a: null, b: undefined }), '');
  });
});

// ---------------------------------------------------------------------------
// resolveMunicipioCoordinates
// ---------------------------------------------------------------------------

describe('resolveMunicipioCoordinates', () => {
  it('resolve Salvador pelo nome', async () => {
    const result = await resolveMunicipioCoordinates({ municipio: 'Salvador' });

    assert.ok(result !== null, 'Deve encontrar Salvador');
    assert.equal(result.localidade, 'SALVADOR');
    assert.ok(typeof result.latitude === 'number');
    assert.ok(typeof result.longitude === 'number');
    assert.ok(typeof result.codigoIBGE === 'number' || typeof result.codigoIBGE === 'string');
  });

  it('resolve Salvador pelo código IBGE 2927408', async () => {
    const result = await resolveMunicipioCoordinates({ codigoIBGE: 2927408 });

    assert.ok(result !== null);
    assert.equal(result.localidade, 'SALVADOR');
  });

  it('resolve nome com acentuação', async () => {
    const result = await resolveMunicipioCoordinates({ municipio: 'Feira de Santana' });

    assert.ok(result !== null, 'Deve encontrar Feira de Santana');
    assert.ok(result.localidade.toLowerCase().includes('feira'));
  });

  it('resolve busca parcial (início do nome)', async () => {
    const result = await resolveMunicipioCoordinates({ municipio: 'Vitoria da' });

    assert.ok(result !== null, 'Deve encontrar Vitória da Conquista via busca parcial');
  });

  it('retorna null para município inexistente', async () => {
    const result = await resolveMunicipioCoordinates({ municipio: 'Cidade Fantasma XYZABC' });
    assert.equal(result, null);
  });

  it('retorna null para chamada sem parâmetros', async () => {
    const result = await resolveMunicipioCoordinates({});
    assert.equal(result, null);
  });

  it('prioriza código IBGE sobre nome quando ambos passados', async () => {
    // Código de Salvador com nome de outra cidade — deve retornar Salvador
    const result = await resolveMunicipioCoordinates({ municipio: 'Feira de Santana', codigoIBGE: 2927408 });

    assert.ok(result !== null);
    assert.equal(result.localidade, 'SALVADOR');
  });
});

// ---------------------------------------------------------------------------
// PrecoDaHoraClient — validações (sem rede)
// ---------------------------------------------------------------------------

describe('PrecoDaHoraClient', () => {
  const client = new PrecoDaHoraClient({ timeout: 1 }); // timeout mínimo para não esperar

  describe('constructor', () => {
    it('instancia sem erros com opções padrão', () => {
      assert.ok(new PrecoDaHoraClient() instanceof PrecoDaHoraClient);
    });

    it('instancia com array de proxies', () => {
      const c = new PrecoDaHoraClient({
        proxies: [{ host: '1.2.3.4', port: 3000, auth: { username: 'u', password: 'p' } }]
      });
      assert.ok(c instanceof PrecoDaHoraClient);
    });
  });

  describe('sugestao()', () => {
    it('lança erro quando item é vazio', async () => {
      await assert.rejects(
        () => client.sugestao(''),
        (err) => {
          assert.ok(err instanceof Error);
          assert.ok(err.message.includes('item'));
          return true;
        }
      );
    });

    it('lança erro quando item é null', async () => {
      await assert.rejects(
        () => client.sugestao(null),
        (err) => err instanceof Error
      );
    });

    it('lança erro quando item não é passado', async () => {
      await assert.rejects(
        () => client.sugestao(),
        (err) => err instanceof Error
      );
    });
  });

  describe('buscarProdutos() — validação de parâmetros', () => {
    it('lança erro quando nenhum filtro principal é informado', async () => {
      await assert.rejects(
        () => client.buscarProdutos({ municipio: 'salvador' }),
        (err) => {
          assert.ok(err instanceof Error);
          assert.ok(err.message.includes('termo') || err.message.includes('gtin') || err.message.includes('anp'));
          return true;
        }
      );
    });

    it('lança erro quando latitude/longitude são omitidos sem município', async () => {
      await assert.rejects(
        () => client.buscarProdutos({ termo: 'arroz' }),
        (err) => {
          assert.ok(err instanceof Error);
          assert.ok(err.message.includes('latitude') || err.message.includes('longitude') || err.message.includes('municipio'));
          return true;
        }
      );
    });

    it('lança erro para município inválido', async () => {
      await assert.rejects(
        () => client.buscarProdutos({ termo: 'arroz', municipio: 'CIDADE_INVALIDA_XYZABC' }),
        (err) => {
          assert.ok(err instanceof Error);
          assert.ok(err.message.toLowerCase().includes('munic'));
          return true;
        }
      );
    });
  });

  describe('resolverMunicipio()', () => {
    it('resolve pelo nome como string', async () => {
      const result = await client.resolverMunicipio('Salvador');
      assert.ok(result !== null);
      assert.ok(typeof result.latitude === 'number');
      assert.ok(typeof result.longitude === 'number');
    });

    it('resolve pelo código IBGE como inteiro', async () => {
      const result = await client.resolverMunicipio(2927408);
      assert.ok(result !== null);
      assert.equal(result.localidade, 'SALVADOR');
    });

    it('retorna null para cidade inexistente', async () => {
      const result = await client.resolverMunicipio('Atlantida XYZABC');
      assert.equal(result, null);
    });
  });
});
