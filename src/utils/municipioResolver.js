import { readFile } from 'node:fs/promises';

const MUNICIPIOS_FILE_URL = new URL('../../municipios-bahia.json', import.meta.url);

let municipioIndexPromise;

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function loadMunicipioIndex() {
  if (!municipioIndexPromise) {
    municipioIndexPromise = (async () => {
      const raw = await readFile(MUNICIPIOS_FILE_URL, 'utf8');
      const municipios = JSON.parse(raw);

      if (!Array.isArray(municipios)) {
        throw new Error('municipios-bahia.json inválido: esperado array de municípios');
      }

      const byName = new Map();
      const byCode = new Map();

      for (const municipio of municipios) {
        const normalizedName = normalizeText(municipio.localidade);
        const code = String(municipio.codigoIBGE);

        if (normalizedName && !byName.has(normalizedName)) {
          byName.set(normalizedName, municipio);
        }

        if (code) {
          byCode.set(code, municipio);
        }
      }

      return { byName, byCode };
    })();
  }

  return municipioIndexPromise;
}

function toCoordinateResult(municipio) {
  if (!municipio) return null;

  return {
    codigoIBGE: municipio.codigoIBGE,
    localidade: municipio.localidade,
    latitude: municipio.latitude,
    longitude: municipio.longitude
  };
}

export async function resolveMunicipioCoordinates({ municipio, codigoIBGE } = {}) {
  const { byName, byCode } = await loadMunicipioIndex();

  const normalizedName = normalizeText(municipio);
  const normalizedCode = String(codigoIBGE ?? '').trim();

  if (normalizedCode && byCode.has(normalizedCode)) {
    return toCoordinateResult(byCode.get(normalizedCode));
  }

  if (!normalizedName) {
    return null;
  }

  if (byName.has(normalizedName)) {
    return toCoordinateResult(byName.get(normalizedName));
  }

  for (const [key, value] of byName.entries()) {
    if (key.startsWith(normalizedName) || key.includes(normalizedName)) {
      return toCoordinateResult(value);
    }
  }

  return null;
}
