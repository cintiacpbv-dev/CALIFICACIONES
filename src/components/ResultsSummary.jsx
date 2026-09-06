'use client';

/**
 * Resultados F0 / FH por sensor, con los dos métodos de integración:
 * trapecio (recomendado por la bibliografía, número principal) y suma
 * acumulada (el método de las planillas de validación de referencia, para
 * poder conciliar contra corridas históricas).
 *
 * El encabezado destaca el F0 mínimo (trapecio) porque, en un estudio de
 * penetración de calor, el sensor más frío es el que gobierna la
 * aceptación del proceso: es el número que se mira primero.
 *
 * @param {{
 *   sensors: {id:string, name:string, color:string}[],
 *   results: Record<string, {f0Trap:number, f0Sum:number, fhTrap:number, fhSum:number}>,
 * }} props
 */
export default function ResultsSummary({ sensors, results }) {
  const rows = sensors.map((s) => ({
    ...s,
    f0Trap: results[s.id]?.f0Trap ?? 0,
    f0Sum: results[s.id]?.f0Sum ?? 0,
    fhTrap: results[s.id]?.fhTrap ?? 0,
    fhSum: results[s.id]?.fhSum ?? 0,
  }));

  const hasData = rows.length > 0 && rows.some((r) => r.f0Trap > 0 || r.fhTrap > 0);
  const f0Values = rows.map((r) => r.f0Trap);
  const minF0 = hasData ? Math.min(...f0Values) : 0;
  const maxF0 = hasData ? Math.max(...f0Values) : 0;
  const coldest = hasData ? rows.find((r) => r.f0Trap === minF0) : null;

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Resultados</h2>
        <span className="card-hint">Valores en minutos</span>
      </div>

      {hasData && (
        <div className="result-strip">
          <div>
            <div className="stat-label">F0 mínimo</div>
            <div className="stat-value accent">
              {minF0.toFixed(2)}
              <span className="stat-unit">min</span>
            </div>
            <div className="stat-note">{coldest?.name} · punto más frío</div>
          </div>
          <div>
            <div className="stat-label">F0 máximo</div>
            <div className="stat-value">
              {maxF0.toFixed(2)}
              <span className="stat-unit">min</span>
            </div>
            <div className="stat-note">Δ {(maxF0 - minF0).toFixed(2)} min entre sensores</div>
          </div>
          <div>
            <div className="stat-label">Sensores</div>
            <div className="stat-value">{rows.length}</div>
            <div className="stat-note">con data corregida</div>
          </div>
        </div>
      )}

      <div className="card-body">
        {!hasData ? (
          <p className="empty">
            <strong>Todavía no hay resultados</strong>
            Cargá temperaturas en la hoja, marcá el inicio del conteo, y el F0 / FH se calcula solo.
          </p>
        ) : (
          <div className="results-table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" rowSpan={2} style={{ verticalAlign: 'bottom' }}>
                    Sensor
                  </th>
                  <th scope="col" colSpan={2} style={{ textAlign: 'center' }}>
                    F0 (min)
                  </th>
                  <th scope="col" colSpan={2} className="method-col-group" style={{ textAlign: 'center' }}>
                    FH (min)
                  </th>
                </tr>
                <tr>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Trapecio
                  </th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Suma
                  </th>
                  <th scope="col" className="method-col-group" style={{ textAlign: 'right' }}>
                    Trapecio
                  </th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Suma
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="sensor-cell">
                        <span className="swatch" style={{ background: r.color }} />
                        <span>{r.name}</span>
                        {r.f0Trap === minF0 && <span className="tag">mín</span>}
                      </div>
                    </td>
                    <td className="num">{r.f0Trap.toFixed(2)}</td>
                    <td className="num">{r.f0Sum.toFixed(2)}</td>
                    <td className="num method-col-group">{r.fhTrap.toFixed(2)}</td>
                    <td className="num">{r.fhSum.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {hasData && (
        <p className="method-note">
          <strong>Trapecio</strong>: integración recomendada por la bibliografía, tolera intervalos
          irregulares. <strong>Suma</strong>: réplica del método de suma acumulada (F[i]=F[i-1]+tasa·Δt)
          usado en las planillas de validación de referencia — sirve para conciliar contra corridas
          históricas. Ambos cuentan sólo dentro de la ventana ● inicio → ● fin marcada en la hoja de
          datos.
        </p>
      )}
    </section>
  );
}
