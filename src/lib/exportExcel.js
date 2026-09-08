import * as XLSX from 'xlsx';
import { buildReport, reportFileName } from './reportData';

// Exportación del informe de una corrida a un único .xlsx, pensado para
// adjuntar al protocolo de calificación: el archivo tiene que alcanzar para
// que alguien reproduzca el número sin abrir la app. Por eso incluye no
// sólo los resultados sino también la data cruda, la corregida, la recta de
// calibración de cada sensor y los parámetros exactos con los que se
// calculó (Tref, z, ventana de conteo).

const HOJAS = {
  informe: 'Informe',
  resultados: 'Resultados',
  calibracion: 'Calibración',
  cruda: 'Data cruda',
  corregida: 'Data corregida',
  acumulada: 'Letalidad acumulada',
};

const VERDICT_LABEL = { pass: 'CUMPLE', fail: 'NO CUMPLE', unset: 'sin criterio' };
const STATUS_LABEL = { pass: 'cumple', fail: 'no cumple', unset: '—' };

/** Redondea para el archivo sin arrastrar el ruido de punto flotante. */
function round(value, decimals = 4) {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(decimals));
}

function sheetFromRows(rows, colWidths) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  if (colWidths) sheet['!cols'] = colWidths.map((w) => ({ wch: w }));
  return sheet;
}

/**
 * Arma el libro del informe. Separado de la descarga para poder verificar
 * el contenido sin depender del navegador.
 *
 * @param {{
 *   project: object, run: object, probes: object[],
 *   sensors: {id:string,name:string,color:string}[],
 *   results: Record<string, object>,
 *   rawData: {time:number[], series:Record<string,(number|null)[]>},
 *   startIndex: number, endIndex: number|null,
 * }} args
 */
export function buildRunWorkbook(args) {
  const { project, run, sensors, results, rawData, startIndex, endIndex } = args;
  const report = buildReport(args);
  const time = rawData?.time ?? [];
  const effectiveEnd = endIndex == null ? time.length - 1 : endIndex;
  const inWindow = (i) => (i >= startIndex && i <= effectiveEnd ? 'sí' : 'no');

  const book = XLSX.utils.book_new();

  // --- Informe ------------------------------------------------------------
  const informe = [
    ['INFORME DE LETALIDAD TÉRMICA (F0 / FH)'],
    [],
    ['CONDICIÓN DE TRABAJO'],
    ...report.header,
    [],
    ['PARÁMETROS DE CÁLCULO'],
    ...report.params,
    [],
    ['RESULTADO GLOBAL'],
    ['F0 mínimo (trapecio)', round(report.minF0, 3), 'min'],
    ['Sensor más frío', report.coldest?.name ?? '—'],
    ['F0 máximo (trapecio)', round(report.maxF0, 3), 'min'],
    ['Dispersión entre sensores', round(report.maxF0 - report.minF0, 3), 'min'],
    [],
    ['CRITERIOS DE ACEPTACIÓN'],
  ];

  if (report.acceptance.checks.length === 0) {
    informe.push(['Sin criterios de aceptación definidos para esta corrida.']);
  } else {
    informe.push(['Criterio', 'Requisito', 'Obtenido', 'Sensor', 'Estado']);
    for (const check of report.acceptance.checks) {
      informe.push([
        check.label,
        check.requirement,
        check.observed,
        check.detail ?? '',
        STATUS_LABEL[check.status],
      ]);
    }
    informe.push([]);
    informe.push(['VEREDICTO', VERDICT_LABEL[report.acceptance.verdict]]);
  }

  if (run?.notes) {
    informe.push([], ['OBSERVACIONES'], [run.notes]);
  }

  informe.push(
    [],
    ['Generado', new Date().toLocaleString('es-AR')],
    [
      'Método',
      'Trapecio = integración por trapecios (recomendada por bibliografía). ' +
        'Suma = F[i]=F[i-1]+10^((T-Tref)/z)·Δt, réplica del método de las planillas de validación. ' +
        'Ambos cuentan sólo dentro de la ventana declarada arriba.',
    ]
  );

  XLSX.utils.book_append_sheet(book, sheetFromRows(informe, [34, 26, 18, 16, 14]), HOJAS.informe);

  // --- Resultados ---------------------------------------------------------
  const resultados = [
    ['Sensor', 'F0 trapecio (min)', 'F0 suma (min)', 'FH trapecio (min)', 'FH suma (min)',
     'T mín en ventana (°C)', 'T máx en ventana (°C)', 'F0 vs criterio', 'Temp. vs criterio'],
    ...report.rows.map((r) => [
      r.name,
      round(r.f0Trap, 3),
      round(r.f0Sum, 3),
      round(r.fhTrap, 3),
      round(r.fhSum, 3),
      round(r.tempMin, 2),
      round(r.tempMax, 2),
      STATUS_LABEL[r.statusF0],
      STATUS_LABEL[r.statusTemp],
    ]),
  ];
  XLSX.utils.book_append_sheet(
    book,
    sheetFromRows(resultados, [14, 17, 15, 17, 15, 20, 20, 15, 17]),
    HOJAS.resultados
  );

  // --- Calibración --------------------------------------------------------
  const calibracion = [
    ['Sensor', 'Puntos EQUI → TCV (°C)', 'Recta aplicada', 'N° certificado', 'Fecha certificado'],
    ...report.calibration.map((c) => [c.code, c.points, c.equation, c.certNumber, c.certDate]),
    [],
    ['EQUI = lectura del canal en el punto de calibración; TCV = valor certificado del patrón.'],
    ['La recta se ajusta por cuadrados mínimos sobre esos puntos (equivalente a FORECAST.LINEAR de Excel).'],
  ];
  XLSX.utils.book_append_sheet(book, sheetFromRows(calibracion, [12, 30, 44, 18, 18]), HOJAS.calibracion);

  // --- Data cruda / corregida ---------------------------------------------
  const dataHeader = [`Tiempo (${run?.time_unit === 's' ? 's' : 'min'})`, ...sensors.map((s) => s.name), 'En ventana'];

  const cruda = [
    dataHeader,
    ...time.map((t, i) => [
      t,
      ...sensors.map((s) => rawData?.series?.[s.id]?.[i] ?? null),
      inWindow(i),
    ]),
  ];
  XLSX.utils.book_append_sheet(
    book,
    sheetFromRows(cruda, [12, ...sensors.map(() => 10), 11]),
    HOJAS.cruda
  );

  const corregida = [
    dataHeader,
    ...time.map((t, i) => [
      t,
      ...sensors.map((s) => round(results[s.id]?.corrected?.[i], 4)),
      inWindow(i),
    ]),
  ];
  XLSX.utils.book_append_sheet(
    book,
    sheetFromRows(corregida, [12, ...sensors.map(() => 10), 11]),
    HOJAS.corregida
  );

  // --- Letalidad acumulada ------------------------------------------------
  // Cuatro columnas por sensor (F0/FH × trapecio/suma): con esto se puede
  // reconciliar celda a celda contra una planilla histórica.
  const acumHeader = [dataHeader[0]];
  for (const s of sensors) {
    acumHeader.push(`${s.name} F0 trap`, `${s.name} F0 suma`, `${s.name} FH trap`, `${s.name} FH suma`);
  }
  const acumulada = [
    acumHeader,
    ...time.map((t, i) => {
      const row = [t];
      for (const s of sensors) {
        const r = results[s.id] ?? {};
        row.push(
          round(r.f0TrapCumulative?.[i], 4),
          round(r.f0SumCumulative?.[i], 4),
          round(r.fhTrapCumulative?.[i], 4),
          round(r.fhSumCumulative?.[i], 4)
        );
      }
      return row;
    }),
  ];
  XLSX.utils.book_append_sheet(
    book,
    sheetFromRows(acumulada, [12, ...sensors.flatMap(() => [12, 12, 12, 12])]),
    HOJAS.acumulada
  );

  return book;
}

/** Arma el informe y dispara la descarga del .xlsx en el navegador. */
export function exportRunToExcel(args) {
  const book = buildRunWorkbook(args);
  XLSX.writeFile(book, reportFileName(args.project, args.run, 'xlsx'));
}
