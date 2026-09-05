// Motor de cálculo de letalidad térmica (F0 / FH).
//
// F(t) = integral( 10 ^ ((T(t) - Tref) / z) ) dt
//
// F0 usa por convención Tref = 121.1 °C y z = 10 °C (esterilización por
// vapor). FH es la misma fórmula con una temperatura de referencia y una z
// configurables por proyecto (otro producto/proceso). Ambas comparten esta
// misma función genérica: F0 y FH no son matemáticas distintas, son el mismo
// cálculo con distintos parámetros de referencia.

/**
 * Tasa de letalidad instantánea (adimensional) para una temperatura dada.
 * @param {number} tempC
 * @param {number} refTemp
 * @param {number} zValue
 */
export function lethalRate(tempC, refTemp, zValue) {
  if (tempC == null || Number.isNaN(tempC)) return 0;
  return 10 ** ((tempC - refTemp) / zValue);
}

/**
 * Convierte un vector de tiempo a minutos según la unidad declarada del
 * proyecto. F0/FH se expresan siempre en minutos.
 * @param {number[]} time
 * @param {'s'|'min'} unit
 */
export function toMinutes(time, unit) {
  if (unit === 's') return time.map((t) => t / 60);
  return time;
}

/**
 * Calcula la curva de letalidad acumulada (para graficar) y el valor F final,
 * integrando por trapecios sobre pasos de tiempo no necesariamente uniformes.
 *
 * @param {number[]} timeMinutes Vector de tiempo en minutos, ascendente.
 * @param {(number|null)[]} temps Vector de temperatura (misma longitud que timeMinutes).
 * @param {number} refTemp Temperatura de referencia (°C).
 * @param {number} zValue Valor z (°C).
 * @returns {{ cumulative: number[], finalValue: number }}
 */
export function computeCumulativeLethality(timeMinutes, temps, refTemp, zValue) {
  const n = Math.min(timeMinutes.length, temps.length);
  const cumulative = new Array(n).fill(0);
  if (n === 0) return { cumulative, finalValue: 0 };

  let acc = 0;
  cumulative[0] = 0;
  for (let i = 1; i < n; i++) {
    const dt = timeMinutes[i] - timeMinutes[i - 1];
    if (!(dt > 0) || temps[i] == null || temps[i - 1] == null) {
      cumulative[i] = acc;
      continue;
    }
    const l0 = lethalRate(temps[i - 1], refTemp, zValue);
    const l1 = lethalRate(temps[i], refTemp, zValue);
    acc += ((l0 + l1) / 2) * dt;
    cumulative[i] = acc;
  }

  return { cumulative, finalValue: acc };
}

/**
 * Calcula F0 y FH para un único sensor a partir de su serie ya corregida.
 *
 * @param {number[]} time Vector de tiempo crudo (en la unidad del proyecto).
 * @param {(number|null)[]} correctedTemps Temperatura ya con el offset aplicado.
 * @param {{ refTempF0: number, zValueF0: number, refTempFh: number, zValueFh: number, timeUnit: 'min'|'s' }} params
 */
export function computeF0Fh(time, correctedTemps, params) {
  const timeMinutes = toMinutes(time, params.timeUnit);

  const f0 = computeCumulativeLethality(
    timeMinutes,
    correctedTemps,
    params.refTempF0,
    params.zValueF0
  );
  const fh = computeCumulativeLethality(
    timeMinutes,
    correctedTemps,
    params.refTempFh,
    params.zValueFh
  );

  return {
    f0Cumulative: f0.cumulative,
    f0: f0.finalValue,
    fhCumulative: fh.cumulative,
    fh: fh.finalValue,
  };
}

/**
 * Aplica el offset de corrección de un sensor a su serie de temperatura
 * cruda. Los huecos (null/undefined/NaN) se preservan tal cual: no se
 * inventan datos donde no los hay.
 *
 * @param {(number|null|undefined)[]} rawValues
 * @param {number} offsetCelsius
 * @returns {(number|null)[]}
 */
export function applyOffset(rawValues, offsetCelsius) {
  const offset = Number(offsetCelsius) || 0;
  return rawValues.map((v) =>
    v == null || Number.isNaN(v) ? null : v + offset
  );
}

/**
 * Aplica los offsets de todos los sensores a la matriz completa de data
 * cruda del proyecto, produciendo la "Data Corregida".
 *
 * @param {{ time: number[], series: Record<string, (number|null)[]> }} rawData
 * @param {{ id: string, offset_celsius: number }[]} sensors
 * @returns {{ time: number[], series: Record<string, (number|null)[]> }}
 */
export function applyOffsetsToDataset(rawData, sensors) {
  const series = {};
  for (const sensor of sensors) {
    const raw = rawData.series?.[sensor.id] ?? [];
    series[sensor.id] = applyOffset(raw, sensor.offset_celsius);
  }
  return { time: rawData.time ?? [], series };
}

/**
 * Calcula F0/FH de todos los sensores de un proyecto a partir de la data
 * cruda + offsets + parámetros de referencia. Es la función que orquesta
 * todo el módulo y la que llaman las pantallas de resultados/gráficos.
 *
 * @param {{ time: number[], series: Record<string, (number|null)[]> }} rawData
 * @param {{ id: string, offset_celsius: number }[]} sensors
 * @param {{ refTempF0: number, zValueF0: number, refTempFh: number, zValueFh: number, timeUnit: 'min'|'s' }} params
 * @returns {Record<string, { f0: number, fh: number, f0Cumulative: number[], fhCumulative: number[], corrected: (number|null)[] }>}
 */
export function computeProjectResults(rawData, sensors, params) {
  const corrected = applyOffsetsToDataset(rawData, sensors);
  const results = {};

  for (const sensor of sensors) {
    const correctedTemps = corrected.series[sensor.id] ?? [];
    const { f0, fh, f0Cumulative, fhCumulative } = computeF0Fh(
      rawData.time ?? [],
      correctedTemps,
      params
    );
    results[sensor.id] = { f0, fh, f0Cumulative, fhCumulative, corrected: correctedTemps };
  }

  return results;
}

/** Reduce computeProjectResults a solo {f0, fh} por sensor, para persistir en results_summary. */
export function summarizeResults(results) {
  const summary = {};
  for (const [sensorId, r] of Object.entries(results)) {
    summary[sensorId] = { f0: r.f0, fh: r.fh };
  }
  return summary;
}
