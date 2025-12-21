import axios from 'axios';
import userAgent from 'useragent-from-seed';

export function createHttpClient(config) {
  return axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeout,
    withCredentials: true,
    headers: {
      Accept: '*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Origin: config.baseUrl,
      Referer: config.baseUrl,
      'User-Agent': userAgent(),
      'X-Requested-With': 'XMLHttpRequest'
    },
    xsrfCookieName: 'X-CSRFToken'
  });
}
