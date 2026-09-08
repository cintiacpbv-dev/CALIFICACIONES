import Papa from 'papaparse';

// SheetJS pesa ~250 kB y sólo hace falta si el usuario sube un .xlsx. Se
// carga bajo demanda para no meterlo en el bundle inicial de la corrida.
async function loadXlsx() {
  return import('xlsx');
}

/**
 * Convierte una matriz de filas (array de arrays, primera fila = encabezado)
 * en el formato interno {time, series, sensorNames}. La primera columna es
 * "Tiempo"; cada columna siguiente es un sensor.
 *
 * @param {any[][]} rows
 * @returns {{ time: number[], sensorNames: string[], values: number[][] }}
 *   values[i] es la serie del sensor i, en el mismo orden que sensorNames.
 */
function matrixToDataset(rows) {
  if (!rows.length) return { time: [], sensorNames: [], values: [] };

  const [header, ...body] = rows;
  const sensorNames = header.slice(1).map((h, i) => String(h ?? `Sensor ${i + 1}`).trim());

  const time = [];
  const values = sensorNames.map(() => []);

  for (const row of body) {
    if (row.every((cell) => cell === null || cell === undefined || cell === '')) continue;
    const t = Number(row[0]);
    time.push(Number.isFinite(t) ? t : null);
    for (let i = 0; i < sensorNames.length; i++) {
      const raw = row[i + 1];
      const n = raw === '' || raw == null ? null : Number(raw);
      values[i].push(Number.isFinite(n) ? n : null);
    }
  }

  return { time, sensorNames, values };
}

/** Parsea un archivo CSV (File o texto) a {time, sensorNames, values}. */
export function parseCsv(fileOrText) {
  return new Promise((resolve, reject) => {
    Papa.parse(fileOrText, {
      complete: (result) => resolve(matrixToDataset(result.data)),
      error: reject,
      skipEmptyLines: true,
    });
  });
}

/** Parsea la primera hoja de un archivo Excel (.xlsx/.xls) a {time, sensorNames, values}. */
export async function parseExcel(file) {
  const XLSX = await loadXlsx();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  return matrixToDataset(rows);
}

/** Detecta el tipo de archivo por extensión y lo parsea. */
export async function parseDataFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    return parseCsv(file);
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseExcel(file);
  }
  throw new Error('Formato no soportado. Usa CSV o Excel (.xlsx/.xls).');
}

/**
 * Parsea texto pegado del portapapeles (TSV, como copia Excel) al mismo
 * formato {time, sensorNames, values}.
 * @param {string} text
 */
export function parsePastedText(text) {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(/\t|,/).map((cell) => cell.trim()));
  return matrixToDataset(rows);
}
