import axios from 'axios';
import http from 'node:http';
import https from 'node:https';
import userAgent from 'useragent-from-seed';

export function createHttpClient(config) {
  const httpAgent = new http.Agent({ keepAlive: true });
  const httpsAgent = new https.Agent({ keepAlive: true });

  const proxy = config.proxy ?? false;

  return axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeout,
    withCredentials: true,
    httpAgent,
    httpsAgent,
    proxy,
    headers: {
      Accept: '*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      Connection: 'keep-alive',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Origin: config.baseUrl,
      Referer: config.baseUrl,
      'User-Agent': userAgent(),
      'X-Requested-With': 'XMLHttpRequest'
    },
    xsrfCookieName: 'X-CSRFToken'
  });
}
