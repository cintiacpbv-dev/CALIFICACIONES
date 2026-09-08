import { fitCalibration } from './calibration';

// Chequeos de integridad de los datos de una corrida.
//
// El motor de letalidad es tolerante: si un Δt no es positivo o una celda
// está vacía, saltea ese intervalo y sigue. Eso evita que la app explote,
// pero también hace que un dato mal pegado produzca un F0 más bajo SIN
// avisar. Estos chequeos existen para que eso nunca pase en silencio: cada
// condición que altera el resultado se reporta explícitamente.
//
// Devuelve una lista de { id, level, title, detail }. `level`:
//   'error'   — el resultado que se está mostrando es incorrecto o cero.
//   'warning' — el resultado es válido pero se calculó sobre datos parciales.

const MAX_LISTED = 6;

/** Une una lista de referencias en texto legible, recortando si son muchas. */
function listOf(items) {
  if (items.length <= MAX_LISTED) return items.join(', ');
  return `${items.slice(0, MAX_LISTED).join(', ')} y ${items.length - MAX_LISTED} más`;
}

/**
 * @param {{
 *   rawData: {time:(number|null)[], series:Record<string,(number|null)[]>},
 *   probes: {id:string, code:string, calibration_points:{tcv:number,equi:number}[]}[],
 *   startIndex: number,
 *   endIndex: number|null,
 * }} args
 */
export function checkDataQuality({ rawData, probes, startIndex, endIndex }) {
  const issues = [];
  const time = rawData?.time ?? [];
  const n = time.length;
  if (n === 0) return issues;

  const first = Math.max(0, startIndex ?? 0);
  const last = endIndex == null ? n - 1 : Math.min(endIndex, n - 1);

  // --- Ventana invertida o vacía ------------------------------------------
  if (last < first) {
    issues.push({
      id: 'window-inverted',
      level: 'error',
      title: 'La ventana de conteo está invertida',
      detail:
        'El marcador ● fin quedó antes que el ● inicio, así que no se integra ningún intervalo y el F0/FH da 0. Movelos para que el fin caiga en una fila posterior.',
    });
  }

  // --- Tiempo faltante ----------------------------------------------------
  const missingTime = [];
  for (let i = 0; i < n; i++) {
    if (time[i] == null || !Number.isFinite(time[i])) missingTime.push(i + 1);
  }
  if (missingTime.length) {
    issues.push({
      id: 'time-missing',
      level: 'error',
      title: `Hay ${missingTime.length} fila(s) sin tiempo`,
      detail: `Filas ${listOf(missingTime.map(String))}. Sin tiempo no se puede calcular el Δt de esos intervalos: quedan fuera de la integral y bajan el F0.`,
    });
  }

  // --- Tiempo desordenado -------------------------------------------------
  // El motor exige Δt > 0 para sumar un intervalo. Un tiempo que retrocede o
  // se repite hace que ese paso NO aporte letalidad y el resultado quede
  // silenciosamente bajo.
  const outOfOrder = [];
  const duplicated = [];
  for (let i = 1; i < n; i++) {
    const prev = time[i - 1];
    const cur = time[i];
    if (prev == null || cur == null || !Number.isFinite(prev) || !Number.isFinite(cur)) continue;
    if (cur < prev) outOfOrder.push(i + 1);
    else if (cur === prev) duplicated.push(i + 1);
  }
  if (outOfOrder.length) {
    issues.push({
      id: 'time-out-of-order',
      level: 'error',
      title: 'La columna Tiempo no está ordenada',
      detail: `El tiempo retrocede en la(s) fila(s) ${listOf(outOfOrder.map(String))}. Esos intervalos no suman letalidad, así que el F0/FH mostrado queda por debajo del real. Ordená los datos por tiempo antes de interpretar el resultado.`,
    });
  }
  if (duplicated.length) {
    issues.push({
      id: 'time-duplicated',
      level: 'warning',
      title: 'Hay tiempos repetidos',
      detail: `Mismo valor de tiempo que la fila anterior en ${listOf(duplicated.map(String))}. Δt = 0, así que esas filas no aportan letalidad.`,
    });
  }

  // --- Huecos dentro de la ventana ----------------------------------------
  // Sólo importan los huecos INTERIORES: una celda vacía entre dos lecturas
  // válidas es un dato que falta. Que la serie no llegue hasta el final del
  // registro es normal (sensor agregado después, canal apagado).
  const gapy = [];
  for (const probe of probes) {
    const serie = rawData?.series?.[probe.id] ?? [];
    let seen = false;
    let holes = 0;
    let pendingHoles = 0;
    for (let i = first; i <= last; i++) {
      const v = serie[i];
      const ok = v != null && Number.isFinite(v);
      if (ok) {
        holes += pendingHoles;
        pendingHoles = 0;
        seen = true;
      } else if (seen) {
        pendingHoles++;
      }
    }
    if (holes > 0) gapy.push(`${probe.code} (${holes})`);
  }
  if (gapy.length) {
    issues.push({
      id: 'series-gaps',
      level: 'warning',
      title: 'Hay lecturas faltantes dentro de la ventana',
      detail: `Celdas vacías entre valores válidos en ${listOf(gapy)}. Esos intervalos se saltean: el F0/FH de esos sensores está calculado sobre menos tiempo del que muestra la ventana.`,
    });
  }

  // --- Sensores sin calibración -------------------------------------------
  const uncalibrated = probes
    .filter((p) => {
      const serie = rawData?.series?.[p.id] ?? [];
      const hasData = serie.some((v) => v != null && Number.isFinite(v));
      return hasData && !fitCalibration(p.calibration_points);
    })
    .map((p) => p.code);
  if (uncalibrated.length) {
    issues.push({
      id: 'uncalibrated',
      level: 'warning',
      title: 'Hay sensores sin calibración cargada',
      detail: `Sin corrección aplicada en ${listOf(uncalibrated)}: se está usando la lectura cruda tal cual. Cargá al menos 2 puntos del certificado en el panel de calibración del equipo.`,
    });
  }

  return issues;
}

/** Ids de los probes que no tienen recta de calibración utilizable. */
export function uncalibratedProbeIds(probes) {
  return new Set((probes ?? []).filter((p) => !fitCalibration(p.calibration_points)).map((p) => p.id));
}
