# precodahora-ba ✅

**Cliente não-oficial para consulta de preços do Preço da Hora Bahia**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)  
[![npm](https://img.shields.io/badge/npm-precodahora--ba-red.svg)](https://www.npmjs.com/package/precodahora-ba)

---

## 📦 Sobre

`precodahora-ba` é uma biblioteca Node.js (ESM) que fornece um cliente simples para consultar preços no site Preço da Hora (Bahia). Ela lida com inicialização de sessão, CSRF e requisições necessárias para buscar produtos e sugestões.

- **Nome:** precodahora-ba
- **Versão:** 1.0.0
- **Autor:** kdudev
- **Licença:** MIT

---

## 🚀 Instalação

Instale via npm:

```bash
npm install precodahora-ba
```

ou com yarn:

```bash
yarn add precodahora-ba
```

---

## ✨ Uso (ESM)

```js
import PrecoDaHoraClient from 'precodahora-ba';

const client = new PrecoDaHoraClient({ timeout: 10000 });

(async () => {
  // Sugestões por termo
  const sugestoesResp = await client.getSugestoes('gasolina');
  console.log(sugestoesResp.data);

  // Busca de produtos com filtros
  const buscarResp = await client.buscarProdutos({ termo: 'gasolina', raio: 10, pagina: 1 });
  console.log(buscarResp.data);
})();
```

### Import nomeado

```js
import { PrecoDaHoraClient } from 'precodahora-ba';
```

### Uso em CommonJS (exemplo com import dinâmica)

```js
(async () => {
  const { default: PrecoDaHoraClient } = await import('precodahora-ba');
  const client = new PrecoDaHoraClient();
  const resp = await client.getSugestoes('diesel');
  console.log(resp.data);
})();
```

---

## 🧭 API

### new PrecoDaHoraClient(options?)

Construtor que recebe um objeto de opções:

- `baseUrl` (string) — URL base do serviço. Padrão: `https://precodahora.ba.gov.br/`
- `timeout` (number) — timeout em ms para as requisições. Padrão: `15000`

Retorna uma instância do cliente.

### client.getSugestoes(item)

- `item` (string) — termo para buscar sugestões.
- Retorna uma Promise que resolve com o objeto `axios` response.
- Lança erro se `item` não for fornecido.

### client.buscarProdutos(filters?)

- `filters` (object) — filtros opcionais enviados como formulário.
  - Ex.: `termo`, `gtin`, `cnpj`, `raio`, `precomax`, `precomin`, `pagina`, `ordenar`, etc.
- Retorna uma Promise que resolve com o objeto `axios` response.

> Observação: ambos os métodos retornam o response do `axios`. A propriedade útil com os dados é `response.data`.

---

## ⚠️ Tratamento de erros

As requisições podem lançar erros de rede, timeout ou erros específicos do servidor. Use try/catch para tratar:

```js
try {
  const resp = await client.buscarProdutos({ termo: 'álcool' });
  console.log(resp.data);
} catch (err) {
  console.error('Erro ao buscar produtos:', err.message || err);
}
```

---

## 👩‍💻 Desenvolvimento

- Execute `npm install` para instalar dependências.
- Sinta-se à vontade para abrir issues ou pull requests no repositório: https://github.com/kdudev/precodahora-ba

---

## 📤 Publicar no npm

1. Atualize `package.json` com versão adequada (ex.: `npm version patch`).
2. Faça login no npm: `npm login`.
3. Publique: `npm publish --access public`.

---

## ❤️ Contribuições

Contribuições são bem-vindas. Por favor, abra issues para discutir mudanças maiores antes de criar PRs.

---

## 📄 Licença

Este projeto está licenciado sob a Licença MIT — veja o arquivo `LICENSE` para detalhes.

---

Se quiser, posso também adicionar exemplos de teste, badges de CI ou um arquivo de exemplos em `examples/`. Quer que eu inclua isso também? 🔧