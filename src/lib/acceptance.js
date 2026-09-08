// Evaluación de criterios de aceptación de una corrida.
//
// Los criterios salen de las planillas de validación reales que se tomaron
// de referencia: el horno de despirogenado traía una banda LI/LS (240-260°C)
// que la temperatura debía respetar durante la exposición, y el estudio de
// penetración exige un F0 mínimo en el punto más frío. Acá se evalúan de la
// misma forma:
//
//   - F0 / FH mínimo: se exige al SENSOR MÁS FRÍO. En un estudio de
//     penetración de calor el peor sensor gobierna la aceptación: si el más
//     frío llega, todos llegan.
//   - Banda de temperatura: se evalúa SÓLO dentro de la ventana de conteo
//     (● inicio → ● fin). Fuera de la meseta la temperatura obviamente está
//     abajo del límite inferior — evaluar el registro completo daría
//     siempre "no cumple".
//
// Un criterio en null/vacío significa "no definido": no se evalúa y no
// cuenta ni a favor ni en contra del veredicto global.
//
// El método de integración usado para el veredicto es el TRAPECIO, el
// recomendado por la bibliografía. La columna "suma" queda para conciliar
// contra históricos, no para decidir.

/** true si el valor es un criterio realmente cargado (no null/vacío/NaN). */
export function isCriterion(value) {
  return value != null && value !== '' && Number.isFinite(Number(value));
}

/**
 * Mín/máx de una serie corregida dentro de la ventana [startIndex, endIndex].
 * Devuelve null si no hay ningún valor numérico en la ventana.
 *
 * @param {(number|null)[]} corrected
 * @param {number} startIndex
 * @param {number|null} endIndex Inclusivo. null = hasta la última fila.
 */
export function windowTempRange(corrected, startIndex, endIndex) {
  const n = corrected?.length ?? 0;
  const first = Math.max(0, startIndex ?? 0);
  const last = endIndex == null ? n - 1 : Math.min(endIndex, n - 1);
  let min = Infinity;
  let max = -Infinity;
  for (let i = first; i <= last; i++) {
    const v = corrected[i];
    if (v == null || !Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === Infinity) return null;
  return { min, max };
}

/**
 * Evalúa los criterios de una corrida contra los resultados calculados.
 *
 * @param {{
 *   sensors: {id:string, name:string, color:string}[],
 *   results: Record<string, {f0Trap:number, fhTrap:number, corrected:(number|null)[]}>,
 *   criteria: {f0_min_required?:number|null, fh_min_required?:number|null,
 *              temp_low_limit?:number|null, temp_high_limit?:number|null},
 *   startIndex: number,
 *   endIndex: number|null,
 * }} args
 * @returns {{
 *   defined: boolean,
 *   verdict: 'pass'|'fail'|'unset',
 *   checks: {key:string, label:string, requirement:string, observed:string,
 *            status:'pass'|'fail', detail?:string}[],
 *   perSensor: Record<string, {f0:'pass'|'fail'|'unset', temp:'pass'|'fail'|'unset'}>,
 * }}
 */
export function evaluateAcceptance({ sensors, results, criteria, startIndex, endIndex }) {
  const c = criteria ?? {};
  const checks = [];
  const perSensor = {};

  const rows = sensors.map((s) => {
    const r = results[s.id] ?? {};
    return {
      ...s,
      f0: Number.isFinite(r.f0Trap) ? r.f0Trap : 0,
      fh: Number.isFinite(r.fhTrap) ? r.fhTrap : 0,
      range: windowTempRange(r.corrected ?? [], startIndex, endIndex),
    };
  });

  const hasData = rows.length > 0 && rows.some((r) => r.range != null);

  const f0Min = isCriterion(c.f0_min_required) ? Number(c.f0_min_required) : null;
  const fhMin = isCriterion(c.fh_min_required) ? Number(c.fh_min_required) : null;
  const tLow = isCriterion(c.temp_low_limit) ? Number(c.temp_low_limit) : null;
  const tHigh = isCriterion(c.temp_high_limit) ? Number(c.temp_high_limit) : null;

  const defined = f0Min != null || fhMin != null || tLow != null || tHigh != null;

  for (const r of rows) {
    perSensor[r.id] = {
      f0: f0Min == null ? 'unset' : r.f0 >= f0Min ? 'pass' : 'fail',
      fh: fhMin == null ? 'unset' : r.fh >= fhMin ? 'pass' : 'fail',
      temp:
        tLow == null && tHigh == null
          ? 'unset'
          : r.range == null
            ? 'fail'
            : (tLow == null || r.range.min >= tLow) && (tHigh == null || r.range.max <= tHigh)
              ? 'pass'
              : 'fail',
    };
  }

  if (!defined || !hasData) {
    return { defined, verdict: 'unset', checks, perSensor };
  }

  if (f0Min != null) {
    const worst = rows.reduce((a, b) => (b.f0 < a.f0 ? b : a));
    checks.push({
      key: 'f0',
      label: 'F0 en el punto más frío',
      requirement: `≥ ${f0Min} min`,
      observed: `${worst.f0.toFixed(2)} min`,
      status: worst.f0 >= f0Min ? 'pass' : 'fail',
      detail: worst.name,
    });
  }

  if (fhMin != null) {
    const worst = rows.reduce((a, b) => (b.fh < a.fh ? b : a));
    checks.push({
      key: 'fh',
      label: 'FH en el punto más frío',
      requirement: `≥ ${fhMin} min`,
      observed: `${worst.fh.toFixed(2)} min`,
      status: worst.fh >= fhMin ? 'pass' : 'fail',
      detail: worst.name,
    });
  }

  if (tLow != null) {
    const withRange = rows.filter((r) => r.range != null);
    const coldest = withRange.length
      ? withRange.reduce((a, b) => (b.range.min < a.range.min ? b : a))
      : null;
    checks.push({
      key: 'tLow',
      label: 'Temperatura mínima en la ventana',
      requirement: `≥ ${tLow} °C`,
      observed: coldest ? `${coldest.range.min.toFixed(2)} °C` : '—',
      status: coldest && coldest.range.min >= tLow ? 'pass' : 'fail',
      detail: coldest?.name,
    });
  }

  if (tHigh != null) {
    const withRange = rows.filter((r) => r.range != null);
    const hottest = withRange.length
      ? withRange.reduce((a, b) => (b.range.max > a.range.max ? b : a))
      : null;
    checks.push({
      key: 'tHigh',
      label: 'Temperatura máxima en la ventana',
      requirement: `≤ ${tHigh} °C`,
      observed: hottest ? `${hottest.range.max.toFixed(2)} °C` : '—',
      status: hottest && hottest.range.max <= tHigh ? 'pass' : 'fail',
      detail: hottest?.name,
    });
  }

  const verdict = checks.every((k) => k.status === 'pass') ? 'pass' : 'fail';
  return { defined, verdict, checks, perSensor };
}
