# precodahora-ba

**Cliente Node.js não-oficial para consulta de preços do [Preço da Hora Bahia](https://precodahora.ba.gov.br/)**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/badge/npm-precodahora--ba-red.svg)](https://www.npmjs.com/package/precodahora-ba)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

---

## Sumário

- [Sobre](#-sobre)
- [Destaques](#-destaques)
- [Instalação](#-instalação)
- [Início rápido](#-início-rápido)
- [Configuração](#-configuração)
- [Referência da API](#-referência-da-api)
  - [new PrecoDaHoraClient(options)](#new-precodahoraclientoptions)
  - [sugestao(item)](#sugestaoitem)
  - [produto(params)](#produtoparams)
  - [buscarProdutos(filters, options)](#buscarprodutosfilters-options)
  - [buscarProdutosTodasPaginas(filters, options)](#buscarprodutostodaspaginasfilters-options)
  - [buscarCombustiveis(filters, options)](#buscarcombustiveisfilters-options)
  - [buscarCombustiveisTodasPaginas(filters, options)](#buscarcombustiveistodaspaginasfilters-options)
  - [resolverMunicipio(municipioOuCodigo)](#resolvermunicipiomunicipioucodigo)
- [Proxies](#-proxies)
- [Tratamento de erros](#-tratamento-de-erros)
- [Testes](#-testes)
- [Desenvolvimento](#-desenvolvimento)
- [Licença](#-licença)

---

## 📦 Sobre

`precodahora-ba` é uma biblioteca Node.js (ESM) que encapsula toda a complexidade de comunicação com o portal [Preço da Hora Bahia](https://precodahora.ba.gov.br/): inicialização de sessão, gerenciamento de cookies, tokens CSRF, retry automático com backoff exponencial, rotação de proxies e paginação paralela.

Com ela você consulta produtos, combustíveis e sugestões de qualquer município baiano passando apenas o nome da cidade — as coordenadas são resolvidas automaticamente a partir de uma base local com os **417 municípios da Bahia**.

- **Versão:** 1.0.0
- **Autor:** kdudev
- **Licença:** MIT

---

## ✨ Destaques

| Recurso | Detalhe |
|---|---|
| Sessão automática | Warm-up de sessão e renovação de CSRF a cada retry |
| Retry com backoff | Exponencial: `retryDelayMs × 2^tentativa` nos status 401, 429, 5xx e erros de rede |
| Paginação paralela | Pool de workers configurável para coletar todas as páginas ao mesmo tempo |
| Resolução de município | Informe `municipio: 'itambe'` — latitude/longitude preenchidos automaticamente |
| Rotação de proxies | Lista de proxies em round-robin, `protocol: 'http'` adicionado automaticamente quando omitido |
| ESM nativo | `type: "module"`, sem transpilação, Node.js ≥ 18 |

---

## 🚀 Instalação

```bash
npm install precodahora-ba
```

```bash
yarn add precodahora-ba
```

> Requer Node.js ≥ 18.

---

## ⚡ Início rápido

```js
import PrecoDaHoraClient from 'precodahora-ba';

const client = new PrecoDaHoraClient();

// Sugestões de produtos
const sugestoes = await client.sugestao('acém');
console.log(sugestoes);
// [{ gtin: 2900000099463, descricao: 'ACEM COSSO ESPECIAL KG', foto: '...' }, ...]

// Busca paginada completa (todas as páginas em paralelo)
const resultado = await client.buscarProdutosTodasPaginas({
  termo: 'acém',
  municipio: 'salvador',
  raio: 10,
  ordenar: 'preco.asc'
});

console.log(`${resultado.resultado.length} itens de ${resultado.totalRegistros} encontrados`);
console.log(resultado.resultado[0]);
```

### Import nomeado

```js
import { PrecoDaHoraClient } from 'precodahora-ba';
```

### CommonJS (import dinâmico)

```js
const { default: PrecoDaHoraClient } = await import('precodahora-ba');
```

---

## ⚙️ Configuração

```js
const client = new PrecoDaHoraClient({
  timeout:            15000, // ms para timeout de cada requisição (padrão: 15000)
  retries:            2,     // tentativas extras em erros transitórios (padrão: 2)
  retryDelayMs:       400,   // atraso base do backoff exponencial em ms (padrão: 400)
  maxConcurrentPages: 4,     // páginas coletadas em paralelo (padrão: 4)
  proxy:              null,  // proxy único no formato axios (padrão: null)
  proxies:            [],    // lista de proxies em rotação round-robin (padrão: [])
  baseUrl:            'https://precodahora.ba.gov.br/' // (padrão)
});
```

---

## 🧭 Referência da API

### `new PrecoDaHoraClient(options?)`

Cria uma instância do cliente.

| Opção | Tipo | Padrão | Descrição |
|---|---|---|---|
| `baseUrl` | `string` | `'https://precodahora.ba.gov.br/'` | URL base do serviço |
| `timeout` | `number` | `15000` | Timeout em ms por requisição |
| `retries` | `number` | `2` | Tentativas extras em erros transitórios |
| `retryDelayMs` | `number` | `400` | Atraso base do backoff exponencial |
| `maxConcurrentPages` | `number` | `4` | Máximo de páginas em paralelo |
| `proxy` | `object \| null` | `null` | Proxy fixo (formato axios) |
| `proxies` | `array` | `[]` | Lista de proxies para rotação round-robin |

---

### `sugestao(item)`

Retorna sugestões de produtos a partir de um texto parcial ou completo.

```js
const sugestoes = await client.sugestao('gasolina');
// Array diretamente:
// [{ gtin, descricao, foto }, ...]
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `item` | `string` | sim | Texto de busca (ex: `'ÁGUA'`, `'ABAC'`) |

**Retorno:** `Promise<Array<{ gtin, descricao, foto }>>` — lista de sugestões diretamente (não é a resposta axios bruta).

**Erros:** lança `Error` se `item` for vazio, `null` ou não informado.

---

### `produto(params)`

Interface compatível com a [hourlyprice-api](https://gitlab.com/luk4smn/hourlyprice-api). Realiza uma busca de página única e retorna o resultado já extraído (sem precisar acessar `.data`).

```js
const { codigo, resultado, totalRegistros, totalPaginas } = await client.produto({
  gtin: 7891055317303,
  municipio: 'feira de santana',
  raio: 15,
  ordenar: 'preco.asc'
});
```

| Parâmetro | Tipo | Padrão | Descrição |
|---|---|---|---|
| `termo` | `string` | `''` | Termo de busca livre |
| `gtin` | `number` | — | GTIN / código de barras (EAN) |
| `cnpj` | `string` | `''` | CNPJ do estabelecimento |
| `horas` | `number` | `72` | Janela de tempo das notas fiscais |
| `anp` | `string` | `''` | Código ANP (combustíveis) |
| `municipio` | `string` | — | Nome do município (resolve lat/lon automaticamente) |
| `codigoIBGE` | `number\|string` | — | Código IBGE do município (alternativa ao nome) |
| `latitude` | `number` | — | Latitude manual (quando não usar município) |
| `longitude` | `number` | — | Longitude manual |
| `raio` | `number` | `15` | Raio de busca em km |
| `precomax` | `number` | `0` | Preço máximo (`0` = sem limite) |
| `precomin` | `number` | `0` | Preço mínimo |
| `ordenar` | `string` | `'preco.asc'` | `'preco.asc'` ou `'preco.desc'` |
| `pagina` | `number` | `1` | Número da página |

**Retorno:**
```js
{
  codigo: 80,
  resultado: [...],     // itens da página
  totalRegistros: 423,
  totalPaginas: 4
}
```

**Erros:**
- Lança `Error` se nenhum filtro principal for informado (`termo`, `gtin` ou `anp`).
- Lança `Error` se `latitude`/`longitude` forem omitidos sem `municipio` ou `codigoIBGE`.
- Lança `Error` se o município não for encontrado na base.

---

### `buscarProdutos(filters, options?)`

Busca de página única. Retorna a resposta axios bruta (`response.data` contém os dados).

```js
const resp = await client.buscarProdutos({
  termo: 'arroz 5kg',
  municipio: 'vitoria da conquista',
  raio: 20,
  pagina: 1
});

console.log(resp.data.resultado);
```

Quando `options.allPages: true`, delega para `buscarProdutosTodasPaginas` e retorna o objeto agregado.

```js
const dados = await client.buscarProdutos(
  { termo: 'arroz 5kg', municipio: 'salvador' },
  { allPages: true, concurrency: 3 }
);
```

| Opção | Tipo | Padrão | Descrição |
|---|---|---|---|
| `allPages` | `boolean` | `false` | Coleta e agrega todas as páginas |
| `concurrency` | `number` | `maxConcurrentPages` | Páginas em paralelo (quando `allPages: true`) |
| `maxPages` | `number` | ilimitado | Limita o número máximo de páginas coletadas |

---

### `buscarProdutosTodasPaginas(filters, options?)`

Coleta todas as páginas disponíveis em paralelo e agrega os itens em um único `resultado`.

```js
const dados = await client.buscarProdutosTodasPaginas(
  {
    termo: 'frango',
    municipio: 'salvador',
    raio: 15,
    ordenar: 'preco.asc'
  },
  {
    concurrency: 4,  // até 4 páginas ao mesmo tempo
    maxPages: 3      // (opcional) limitar a 3 páginas
  }
);

console.log(dados.resultado.length);   // itens coletados
console.log(dados.totalRegistros);     // total reportado pela API
console.log(dados.paginasColetadas);   // páginas efetivamente coletadas
```

**Retorno:**
```js
{
  resultado: [...],        // todos os itens agregados
  totalRegistros: 423,     // total reportado pela API
  totalPaginas: 4,         // total de páginas disponíveis
  paginasColetadas: 4,     // páginas coletadas
  registrosdaPagina: 100,  // quantidade real coletada
  paginas: [...]           // payload bruto de cada página
}
```

> `buscarProdutosCompletos(filters, options)` é um alias de `buscarProdutosTodasPaginas`.

---

### `buscarCombustiveis(filters, options?)`

Busca de combustíveis por `termo` (nome) e/ou `anp` (código ANP). O `termo` tem padrão `'gasolina'`.

```js
// Por nome
const resp = await client.buscarCombustiveis({
  termo: 'etanol',
  municipio: 'feira de santana',
  raio: 10
});

// Por código ANP
const resp = await client.buscarCombustiveis({
  anp: '320101001',
  municipio: 'salvador'
});

// Todas as páginas
const resp = await client.buscarCombustiveis(
  { termo: 'diesel', municipio: 'salvador' },
  { allPages: true }
);
```

**Estrutura de cada item retornado:**
```js
{
  produto: {
    descricao: 'ZMANGUEIRA GASOLINA',
    precoUnitario: 5.89,
    precoLiquido: 5.89,
    precoBruto: 5.89,
    unidade: 'UNID',
    data: '2026-05-05 17:30:00-00:00',
    intervalo: 'há 2 hora(s)',
    anp: null,
    gtin: null,
    ncm: 87141000,
    foto: 'https://api.precodahora.ba.gov.br/v1/images/default'
  },
  estabelecimento: {
    nomeEstabelecimento: 'POSTO EXEMPLO LTDA',
    endLogradouro: 'AV. DAS FLORES',
    endNumero: '100',
    bairro: 'CENTRO',
    municipio: 'SALVADOR',
    uf: 'BA',
    cnpj: 12345678000199,
    latitude: -12.9714,
    longitude: -38.5014,
    distancia: 1.5
  }
}
```

---

### `buscarCombustiveisTodasPaginas(filters, options?)`

Equivalente a `buscarProdutosTodasPaginas` com foco em combustíveis. Exige `termo` ou `anp`.

```js
const combustiveis = await client.buscarCombustiveisTodasPaginas({
  termo: 'gasolina',
  municipio: 'salvador',
  raio: 15,
  ordenar: 'preco.asc'
});

// A API retorna no máximo 4 páginas × 25 itens = 100 itens por consulta
console.log(combustiveis.resultado.length);
console.log(combustiveis.totalRegistros); // total real na base
```

---

### `resolverMunicipio(municipioOuCodigo)`

Resolve um município da Bahia para suas coordenadas. Consulta a base local `municipios-bahia.json` (417 municípios) com cache em memória após o primeiro carregamento.

```js
// Por nome — aceita acentuação, maiúsculas/minúsculas e busca parcial
const coords = await client.resolverMunicipio('itambe');
// { codigoIBGE: 2915403, localidade: 'ITAMBE', latitude: -15.227, longitude: -40.633 }

// Por código IBGE
const coords = await client.resolverMunicipio(2927408);
// { codigoIBGE: 2927408, localidade: 'SALVADOR', latitude: -12.9714, longitude: -38.5014 }

// Município não encontrado
const coords = await client.resolverMunicipio('Cidade Inexistente');
// null
```

**Retorno:**
```js
{
  codigoIBGE: number | string,
  localidade: string,           // nome em maiúsculas
  latitude: number,
  longitude: number
}
// ou null se não encontrado
```

> A resolução é tolerante: aceita nomes com ou sem acento, maiúsculos ou minúsculos, e faz busca por prefixo e substring quando o nome exato não é encontrado.

---

## 🔄 Proxies

### Proxy único fixo

```js
const client = new PrecoDaHoraClient({
  proxy: {
    host: '10.10.10.10',
    port: 3128,
    auth: { username: 'usuario', password: 'senha' }
  }
});
```

### Rotação round-robin

Cada requisição usa o próximo proxy da lista, em ciclo.

```js
const client = new PrecoDaHoraClient({
  proxies: [
    { host: '1.1.1.1', port: 8080, auth: { username: 'u', password: 'p' } },
    { host: '2.2.2.2', port: 8080, auth: { username: 'u', password: 'p' } },
    { host: '3.3.3.3', port: 8080, auth: { username: 'u', password: 'p' } },
  ]
});
```

> O campo `protocol` é opcional: quando omitido, `'http'` é adicionado automaticamente.

---

## ⚠️ Tratamento de erros

A biblioteca faz retry automático nos seguintes casos:

- **Status HTTP:** `401`, `403`, `408`, `409`, `419`, `425`, `429`, `500`, `502`, `503`, `504`
- **Erros de rede** (sem resposta do servidor, timeout, EPROTO)

O atraso entre tentativas segue backoff exponencial: `retryDelayMs × 2^tentativa`.  
A sessão (cookie + CSRF) é renovada automaticamente a cada retry.

Para erros de **validação de parâmetros** (campo obrigatório ausente, município inválido), a biblioteca lança `Error` imediatamente, sem retry.

```js
try {
  const dados = await client.buscarProdutosTodasPaginas({
    termo: 'álcool',
    municipio: 'salvador'
  });
  console.log(dados.resultado);
} catch (err) {
  if (err.response) {
    // Erro HTTP após todos os retries
    console.error(`HTTP ${err.response.status}`);
  } else {
    // Erro de validação, município não encontrado, rede etc.
    console.error(err.message);
  }
}
```

---

## 🧪 Testes

A suite de testes usa o test runner nativo do Node.js (sem dependências externas de teste).

```bash
npm test
```

**30 testes** cobrindo:

- `createConfig` — valores padrão, normalização de proxies, imutabilidade, limites mínimos
- `serializeForm` — serialização, filtragem de `null`/`undefined`, encoding de caracteres especiais
- `resolveMunicipioCoordinates` — busca por nome, código IBGE, acentuação, busca parcial, priorização de código sobre nome
- `PrecoDaHoraClient` — instanciação, validações de entrada em todos os métodos públicos

---

## 👨‍💻 Desenvolvimento

```bash
# Instalar dependências
npm install

# Rodar testes
npm test

# Testar combustíveis em Salvador
node scripts/teste-combustivel.mjs

# Buscar acém em múltiplas cidades (sequencial, log incremental)
node scripts/teste-acem-cidades.mjs
```

### Publicar no npm

```bash
npm version patch        # ou minor / major
npm login
npm publish --access public
```

---

## 📄 Licença

MIT © [kdudev](https://github.com/kdudev)