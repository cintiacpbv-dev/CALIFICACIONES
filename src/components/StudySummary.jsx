'use client';

import Link from 'next/link';

/**
 * Resumen del estudio: todas las corridas del equipo en una sola tabla.
 *
 * Un equipo no se califica por una corrida sino por el conjunto (cámara
 * vacía + cargas + setpoints), y lo que se mira al cerrar el informe es
 * siempre lo mismo: cuál fue el peor F0 de cada corrida, si alguna no
 * cumplió, y si el punto frío cae siempre en el mismo sensor — un frío que
 * se repite es una zona real del equipo, uno que salta de corrida en
 * corrida suele ser ruido de colocación.
 *
 * Se arma con el cache `results_summary` / `acceptance_summary` de cada
 * corrida, sin traer la data cruda: con 12 sensores × 60 lecturas × N
 * corridas, traer todo para mostrar una tabla sería absurdo.
 *
 * @param {{
 *   projectId: string,
 *   runs: object[],
 *   probes: {id:string, code:string, color:string}[],
 * }} props
 */
export default function StudySummary({ projectId, runs, probes }) {
  const probeName = new Map(probes.map((p) => [p.id, p.code]));
  const probeColor = new Map(probes.map((p) => [p.id, p.color]));

  const rows = runs.map((run) => {
    const summary = run.results_summary ?? {};
    const entries = Object.entries(summary)
      .map(([id, r]) => ({ id, f0: r?.f0Trap, fh: r?.fhTrap }))
      .filter((e) => Number.isFinite(e.f0));

    const coldest = entries.length ? entries.reduce((a, b) => (b.f0 < a.f0 ? b : a)) : null;
    const hottest = entries.length ? entries.reduce((a, b) => (b.f0 > a.f0 ? b : a)) : null;

    return {
      id: run.id,
      name: run.name,
      load: run.load_description,
      setpoint: run.ref_temp_f0,
      verdict: run.acceptance_summary?.verdict ?? 'unset',
      minF0: coldest?.f0 ?? null,
      maxF0: hottest?.f0 ?? null,
      coldestId: coldest?.id ?? null,
      sensorCount: entries.length,
    };
  });

  const withData = rows.filter((r) => r.minF0 != null);
  if (withData.length < 1) return null;

  // Sensor que aparece como punto frío en más corridas.
  const coldCounts = new Map();
  for (const r of withData) {
    if (r.coldestId) coldCounts.set(r.coldestId, (coldCounts.get(r.coldestId) ?? 0) + 1);
  }
  const recurring = [...coldCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const worstRun = withData.reduce((a, b) => (b.minF0 < a.minF0 ? b : a));
  const failing = rows.filter((r) => r.verdict === 'fail').length;

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Resumen del estudio</h2>
        <span className="card-hint">Peor sensor de cada corrida</span>
      </div>

      <div className="result-strip">
        <div>
          <div className="stat-label">Peor F0 del estudio</div>
          <div className="stat-value accent">
            {worstRun.minF0.toFixed(2)}
            <span className="stat-unit">min</span>
          </div>
          <div className="stat-note">{worstRun.name}</div>
        </div>
        <div>
          <div className="stat-label">Punto frío recurrente</div>
          <div className="stat-value">{recurring ? probeName.get(recurring[0]) ?? '—' : '—'}</div>
          <div className="stat-note">
            {recurring
              ? `Más frío en ${recurring[1]} de ${withData.length} corrida(s)`
              : 'Sin datos suficientes'}
          </div>
        </div>
        <div>
          <div className="stat-label">Corridas que no cumplen</div>
          <div className={`stat-value${failing ? ' danger' : ''}`}>{failing}</div>
          <div className="stat-note">de {rows.length} con criterios evaluados</div>
        </div>
      </div>

      <div className="card-body">
        <div className="results-table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Corrida</th>
                <th scope="col">Carga</th>
                <th scope="col" className="num-head">Setpoint</th>
                <th scope="col" className="num-head">F0 mín</th>
                <th scope="col" className="num-head">F0 máx</th>
                <th scope="col">Punto frío</th>
                <th scope="col">Aceptación</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.verdict === 'fail' ? 'row-fail' : ''}>
                  <td>
                    <Link href={`/proyecto/${projectId}/corrida/${r.id}`} className="cell-link">
                      {r.name}
                    </Link>
                  </td>
                  <td className="cell-muted">{r.load || '—'}</td>
                  <td className="num">{r.setpoint} °C</td>
                  <td className="num">{r.minF0 == null ? '—' : r.minF0.toFixed(2)}</td>
                  <td className="num">{r.maxF0 == null ? '—' : r.maxF0.toFixed(2)}</td>
                  <td>
                    {r.coldestId ? (
                      <span className="sensor-cell">
                        <span
                          className="swatch"
                          style={{ background: probeColor.get(r.coldestId) ?? '#999' }}
                        />
                        {probeName.get(r.coldestId) ?? '—'}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <span className={`pill pill-${r.verdict}`}>
                      {r.verdict === 'pass'
                        ? 'Cumple'
                        : r.verdict === 'fail'
                          ? 'No cumple'
                          : 'Sin criterio'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="method-note">
        F0 por integración de trapecios, dentro de la ventana de conteo de cada corrida. La columna{' '}
        <strong>Aceptación</strong> refleja los criterios cargados en cada corrida: «sin criterio»
        significa que esa corrida todavía no tiene ninguno definido, no que haya fallado.
      </p>
    </section>
  );
}
