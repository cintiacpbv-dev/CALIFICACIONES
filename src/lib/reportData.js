import { fitCalibration } from './calibration';
import { evaluateAcceptance, windowTempRange } from './acceptance';

// Modelo único del informe de una corrida. Lo consumen tanto la exportación
// a Excel (src/lib/exportExcel.js) como el informe imprimible
// (src/components/RunReport.jsx), para que los dos digan exactamente lo
// mismo y no se desincronicen.
//
// Todo lo que hay acá es derivado: nada de esto se persiste.

/** Formatea una fecha ISO (o Date) a dd/mm/aaaa; vacío si no hay. */
export function formatDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const nn = (v) => (v == null || v === '' ? '—' : v);

/**
 * @param {{
 *   project: {name:string, equipment_code?:string, description?:string},
 *   run: object,
 *   probes: object[],
 *   sensors: {id:string,name:string,color:string}[],
 *   results: Record<string, object>,
 *   rawData: {time:number[], series:Record<string,(number|null)[]>},
 *   startIndex: number,
 *   endIndex: number|null,
 * }} args
 */
export function buildReport({ project, run, probes, sensors, results, rawData, startIndex, endIndex }) {
  const time = rawData?.time ?? [];
  const effectiveEnd = endIndex == null ? time.length - 1 : endIndex;

  const acceptance = evaluateAcceptance({
    sensors,
    results,
    criteria: run,
    startIndex,
    endIndex,
  });

  const rows = sensors.map((s) => {
    const r = results[s.id] ?? {};
    const range = windowTempRange(r.corrected ?? [], startIndex, endIndex);
    const per = acceptance.perSensor[s.id] ?? {};
    return {
      id: s.id,
      name: s.name,
      color: s.color,
      f0Trap: r.f0Trap ?? 0,
      f0Sum: r.f0Sum ?? 0,
      fhTrap: r.fhTrap ?? 0,
      fhSum: r.fhSum ?? 0,
      tempMin: range?.min ?? null,
      tempMax: range?.max ?? null,
      statusF0: per.f0 ?? 'unset',
      statusFh: per.fh ?? 'unset',
      statusTemp: per.temp ?? 'unset',
    };
  });

  const f0Values = rows.map((r) => r.f0Trap);
  const minF0 = f0Values.length ? Math.min(...f0Values) : 0;
  const maxF0 = f0Values.length ? Math.max(...f0Values) : 0;
  const coldest = rows.find((r) => r.f0Trap === minF0) ?? null;

  // Encabezado: pares etiqueta/valor, en el orden en que se leen en el
  // informe. Mismo orden en Excel y en la impresión.
  const header = [
    ['Equipo', nn(project?.name)],
    ['Código de equipo', nn(project?.equipment_code)],
    ['Descripción', nn(project?.description)],
    ['Corrida', nn(run?.name)],
    ['Fecha del ensayo', nn(formatDate(run?.run_date))],
    ['Lote / protocolo', nn(run?.batch_code)],
    ['Ciclo', nn(run?.cycle_code)],
    ['Carga', nn(run?.load_description)],
    ['Operador', nn(run?.operator)],
  ];

  const params = [
    ['F0 — Tref (°C)', run?.ref_temp_f0],
    ['F0 — z (°C)', run?.z_value_f0],
    ['FH — Tref (°C)', run?.ref_temp_fh],
    ['FH — z (°C)', run?.z_value_fh],
    ['Unidad de la columna Tiempo', run?.time_unit === 's' ? 'segundos' : 'minutos'],
    ['Ventana de conteo — fila inicio', startIndex + 1],
    [
      'Ventana de conteo — fila fin',
      time.length ? effectiveEnd + 1 + (endIndex == null ? ' (última)' : '') : '—',
    ],
    ['Ventana de conteo — tiempo', time.length ? `${nn(time[startIndex])} → ${nn(time[effectiveEnd])}` : '—'],
    ['Lecturas totales', time.length],
    ['Lecturas dentro de la ventana', Math.max(0, effectiveEnd - startIndex + 1)],
  ];

  const calibration = probes.map((p) => {
    const fit = fitCalibration(p.calibration_points);
    const pts = (p.calibration_points ?? [])
      .filter((q) => q?.equi != null && q?.tcv != null)
      .map((q) => `${q.equi} → ${q.tcv}`)
      .join(' · ');
    return {
      code: p.code,
      points: pts || '—',
      equation: fit
        ? `corregida = ${fit.intercept.toFixed(4)} + ${fit.slope.toFixed(6)} × cruda`
        : 'sin corrección (menos de 2 puntos)',
      certNumber: nn(p.calibration_cert_number),
      certDate: nn(formatDate(p.calibration_date)),
    };
  });

  return { header, params, rows, calibration, acceptance, minF0, maxF0, coldest, effectiveEnd };
}

/** Nombre de archivo seguro para la descarga del informe. */
export function reportFileName(project, run, extension) {
  const parts = [project?.equipment_code || project?.name || 'equipo', run?.name || 'corrida'];
  const slug = parts
    .join('-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const stamp = new Date().toISOString().slice(0, 10);
  return `F0-${slug}-${stamp}.${extension}`;
}
