import { applyCalibrationToDataset } from './calibration';

// Motor de cálculo de letalidad térmica (F0 / FH).
//
// F(t) = integral( 10 ^ ((T(t) - Tref) / z) ) dt
//
// F0 usa por convención Tref = 121.1 °C y z = 10 °C (esterilización por
// vapor). FH es la misma fórmula con una temperatura de referencia y una z
// configurables por corrida — el análisis de planillas de validación reales
// (autoclave 115/121°C, horno de despirogenado a 250°C/z=54) confirma que
// son el mismo cálculo, sólo cambian los parámetros de referencia.
//
// Dos métodos de integración, ambos disponibles:
//
// - "trapecio": integración por trapecios, numéricamente más precisa y
//   tolerante a intervalos de tiempo irregulares. Es el método recomendado
//   por la bibliografía.
// - "suma": suma acumulada rectangular (F[i] = F[i-1] + tasa[i]·Δt), el
//   método encontrado en las planillas de validación reales que se tomaron
//   de referencia. Se ofrece para poder conciliar contra esos históricos;
//   asume pasos de tiempo razonablemente regulares.
//
// Ambos aceptan una VENTANA de conteo `[startIndex, endIndex]`: en las
// planillas reales el conteo de F0/FH no cubre todo el registro, sino sólo
// el tramo de exposición — arranca en una fila elegida a mano y CORTA
// cuando termina la meseta, antes del enfriamiento. Verificado contra una
// corrida real: integrar hasta el final del registro sobreestima el F0 un
// 4,6%. Ninguno de los dos límites sigue una regla fija de
// temperatura/tiempo, así que se marcan a mano desde la hoja de datos.
// endIndex es inclusivo; null/undefined = hasta la última fila.

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
 * Convierte un vector de tiempo a minutos según la unidad declarada de la
 * corrida. F0/FH se expresan siempre en minutos.
 * @param {number[]} time
 * @param {'s'|'min'} unit
 */
export function toMinutes(time, unit) {
  if (unit === 's') return time.map((t) => t / 60);
  return time;
}

/**
 * Integración por trapecios sobre la ventana [startIndex, endIndex]. Las
 * filas fuera de la ventana no aportan letalidad: antes quedan en 0,
 * después mantienen el acumulado final.
 *
 * @param {number[]} timeMinutes
 * @param {(number|null)[]} temps
 * @param {number} refTemp
 * @param {number} zValue
 * @param {number} startIndex
 * @param {number|null} endIndex Inclusivo. null = hasta la última fila.
 */
export function computeCumulativeLethalityTrapezoidal(
  timeMinutes,
  temps,
  refTemp,
  zValue,
  startIndex = 0,
  endIndex = null
) {
  const n = Math.min(timeMinutes.length, temps.length);
  const cumulative = new Array(n).fill(0);
  if (n === 0) return { cumulative, finalValue: 0 };
  const first = Math.max(0, startIndex);
  const last = endIndex == null ? n - 1 : Math.min(endIndex, n - 1);

  // Se arranca en first+1: el primer intervalo que cae DENTRO de la ventana
  // es (first -> first+1). Empezar en `first` sumaría el intervalo anterior
  // a la fila marcada como inicio, que es justamente lo que se quiere
  // excluir (en la rampa de subida eso mete media letalidad de más).
  let acc = 0;
  for (let i = Math.max(1, first + 1); i <= last; i++) {
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
  for (let i = last + 1; i < n; i++) cumulative[i] = acc;

  return { cumulative, finalValue: acc };
}

/**
 * Suma acumulada rectangular, replicando el método de las planillas de
 * referencia: F[i] = F[i-1] + tasa[i]·Δt. A diferencia del trapecio, el
 * primer punto acumulado (startIndex) ya lleva la letalidad de ese primer
 * paso — no arranca en 0 — porque así está armado en el método original
 * (no hay un "punto anterior" con el que promediar).
 *
 * @param {number[]} timeMinutes
 * @param {(number|null)[]} temps
 * @param {number} refTemp
 * @param {number} zValue
 * @param {number} startIndex
 * @param {number|null} endIndex Inclusivo. null = hasta la última fila.
 */
export function computeCumulativeLethalitySum(
  timeMinutes,
  temps,
  refTemp,
  zValue,
  startIndex = 0,
  endIndex = null
) {
  const n = Math.min(timeMinutes.length, temps.length);
  const cumulative = new Array(n).fill(0);
  const first = Math.max(0, startIndex);
  if (n === 0 || first >= n) return { cumulative, finalValue: 0 };
  const last = endIndex == null ? n - 1 : Math.min(endIndex, n - 1);

  // Δt del primer paso: contra la fila anterior si existe, si no, contra la
  // siguiente (o 1 minuto si es la única fila).
  const firstDt =
    first > 0
      ? timeMinutes[first] - timeMinutes[first - 1]
      : (timeMinutes[first + 1] ?? timeMinutes[first] + 1) - timeMinutes[first];

  let acc = 0;
  for (let i = first; i <= last; i++) {
    const dt = i === first ? firstDt : timeMinutes[i] - timeMinutes[i - 1];
    if (!(dt > 0) || temps[i] == null) {
      cumulative[i] = acc;
      continue;
    }
    acc += lethalRate(temps[i], refTemp, zValue) * dt;
    cumulative[i] = acc;
  }
  for (let i = last + 1; i < n; i++) cumulative[i] = acc;

  return { cumulative, finalValue: acc };
}

/**
 * Calcula F0 y FH (los dos métodos de integración) para un único sensor a
 * partir de su serie ya corregida por calibración.
 *
 * @param {number[]} time
 * @param {(number|null)[]} correctedTemps
 * @param {{ refTempF0: number, zValueF0: number, refTempFh: number, zValueFh: number, timeUnit: 'min'|'s', startIndex?: number, endIndex?: number|null }} params
 */
export function computeF0Fh(time, correctedTemps, params) {
  const timeMinutes = toMinutes(time, params.timeUnit);
  const startIndex = params.startIndex ?? 0;
  const endIndex = params.endIndex ?? null;

  const f0Trap = computeCumulativeLethalityTrapezoidal(
    timeMinutes,
    correctedTemps,
    params.refTempF0,
    params.zValueF0,
    startIndex,
    endIndex
  );
  const f0Sum = computeCumulativeLethalitySum(
    timeMinutes,
    correctedTemps,
    params.refTempF0,
    params.zValueF0,
    startIndex,
    endIndex
  );
  const fhTrap = computeCumulativeLethalityTrapezoidal(
    timeMinutes,
    correctedTemps,
    params.refTempFh,
    params.zValueFh,
    startIndex,
    endIndex
  );
  const fhSum = computeCumulativeLethalitySum(
    timeMinutes,
    correctedTemps,
    params.refTempFh,
    params.zValueFh,
    startIndex,
    endIndex
  );

  return {
    f0TrapCumulative: f0Trap.cumulative,
    f0Trap: f0Trap.finalValue,
    f0SumCumulative: f0Sum.cumulative,
    f0Sum: f0Sum.finalValue,
    fhTrapCumulative: fhTrap.cumulative,
    fhTrap: fhTrap.finalValue,
    fhSumCumulative: fhSum.cumulative,
    fhSum: fhSum.finalValue,
  };
}

/**
 * Calcula F0/FH (ambos métodos) de todos los probes de una corrida, a
 * partir de la data cruda + calibración + parámetros de referencia. Es la
 * función que orquesta todo el módulo.
 *
 * @param {{ time: number[], series: Record<string, (number|null)[]> }} rawData
 * @param {{ id: string, calibration_points: {tcv:number,equi:number}[] }[]} probes
 * @param {{ refTempF0: number, zValueF0: number, refTempFh: number, zValueFh: number, timeUnit: 'min'|'s', startIndex?: number, endIndex?: number|null }} params
 */
export function computeRunResults(rawData, probes, params) {
  const corrected = applyCalibrationToDataset(rawData, probes);
  const results = {};

  for (const probe of probes) {
    const correctedTemps = corrected.series[probe.id] ?? [];
    const r = computeF0Fh(rawData.time ?? [], correctedTemps, params);
    results[probe.id] = { ...r, corrected: correctedTemps };
  }

  return results;
}

/** Reduce computeRunResults a solo los valores finales por probe, para persistir en results_summary. */
export function summarizeResults(results) {
  const summary = {};
  for (const [probeId, r] of Object.entries(results)) {
    summary[probeId] = { f0Trap: r.f0Trap, f0Sum: r.f0Sum, fhTrap: r.fhTrap, fhSum: r.fhSum };
  }
  return summary;
}
