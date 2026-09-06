// Corrección de data cruda por calibración de 2-3 puntos, replicando
// FORECAST.LINEAR de Excel (que es lo que usan las planillas de validación
// reales tomadas como referencia): cada sensor trae del certificado 2 o 3
// pares (TCV = lo que lee la termocupla en el baño de calibración, EQUI =
// el valor real/equivalente del baño), y esos puntos arman una recta que
// corrige cada lectura cruda del proceso.
//
// Con 2 puntos la recta pasa exacta por ambos. Con 3 (u N), es la recta de
// cuadrados mínimos (regresión lineal simple) — igual que hace Excel.

/**
 * Ajusta pendiente e intercepto por cuadrados mínimos sobre puntos (x,y).
 * @param {{x:number, y:number}[]} points
 * @returns {{slope: number, intercept: number}}
 */
function linearRegression(points) {
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }

  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

/**
 * Arma la recta de calibración de un sensor a partir de sus puntos de
 * certificado, replicando exactamente `FORECAST.LINEAR(cruda, TCV, EQUI)`
 * tal como está escrito en las planillas de referencia: la recta se ajusta
 * con x = EQUI (valor real del baño) e y = TCV (lo que leyó el canal en
 * calibración), y esa misma recta se evalúa directo en la lectura cruda del
 * proceso (`applyCalibration`). No es la inversa "pura" del modelo — es
 * la aproximación que usa el método de referencia, válida porque la
 * pendiente da casi 1 (el error de calibración es chico). Se replica tal
 * cual para que los resultados concilien con esas planillas.
 *
 * Con menos de 2 puntos no hay corrección posible (identidad).
 *
 * @param {{tcv:number, equi:number}[]} calibrationPoints
 * @returns {{slope: number, intercept: number} | null}
 */
export function fitCalibration(calibrationPoints) {
  const valid = (calibrationPoints ?? []).filter(
    (p) => Number.isFinite(p?.tcv) && Number.isFinite(p?.equi)
  );
  if (valid.length < 2) return null;
  return linearRegression(valid.map((p) => ({ x: p.equi, y: p.tcv })));
}

/**
 * Aplica la recta de calibración a una lectura cruda. Sin puntos válidos,
 * devuelve la lectura sin modificar (no hay corrección posible todavía).
 *
 * @param {number|null} rawValue
 * @param {{tcv:number, equi:number}[]} calibrationPoints
 */
export function applyCalibration(rawValue, calibrationPoints) {
  if (rawValue == null || Number.isNaN(rawValue)) return null;
  const fit = fitCalibration(calibrationPoints);
  if (!fit) return rawValue;
  return fit.intercept + fit.slope * rawValue;
}

/**
 * Aplica la calibración de cada probe a la matriz completa de data cruda de
 * una corrida, produciendo la "Data Procesada".
 *
 * @param {{ time: number[], series: Record<string, (number|null)[]> }} rawData
 * @param {{ id: string, calibration_points: {tcv:number, equi:number}[] }[]} probes
 */
export function applyCalibrationToDataset(rawData, probes) {
  const series = {};
  for (const probe of probes) {
    const raw = rawData.series?.[probe.id] ?? [];
    series[probe.id] = raw.map((v) => applyCalibration(v, probe.calibration_points));
  }
  return { time: rawData.time ?? [], series };
}
