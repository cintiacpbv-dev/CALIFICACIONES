'use client';

/**
 * Resultados F0 / FH por sensor, con los dos métodos de integración:
 * trapecio (recomendado por la bibliografía, el que decide la aceptación) y
 * suma acumulada (el método de las planillas de validación de referencia,
 * para poder conciliar contra corridas históricas).
 *
 * El encabezado destaca el F0 mínimo porque, en un estudio de penetración
 * de calor, el sensor más frío es el que gobierna la aceptación del
 * proceso: es el número que se mira primero. Si la corrida tiene criterios
 * cargados, arriba de todo va el veredicto — la pregunta real no es "cuánto
 * dio" sino "pasa o no pasa".
 *
 * @param {{
 *   report: {rows: object[], acceptance: object, minF0: number, maxF0: number, coldest: object|null},
 *   uncalibrated: Set<string>,
 * }} props
 */
export default function ResultsSummary({ report, uncalibrated }) {
  const { rows, acceptance, minF0, maxF0, coldest } = report;
  const hasData = rows.length > 0 && rows.some((r) => r.f0Trap > 0 || r.fhTrap > 0);
  const showVerdict = acceptance.defined && acceptance.checks.length > 0;

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Resultados</h2>
        <span className="card-hint">Valores en minutos</span>
      </div>

      {showVerdict && (
        <div className={`verdict-banner verdict-${acceptance.verdict}`}>
          <span className="verdict-chip">
            {acceptance.verdict === 'pass' ? 'Cumple' : 'No cumple'}
          </span>
          <div className="verdict-checks">
            {acceptance.checks.map((check) => (
              <div key={check.key} className={`verdict-check is-${check.status}`}>
                <span className="check-mark" aria-hidden="true">
                  {check.status === 'pass' ? '✓' : '✕'}
                </span>
                <span className="check-label">{check.label}</span>
                <span className="check-value">
                  <b>{check.observed}</b> · requisito {check.requirement}
                  {check.detail ? ` · ${check.detail}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
            Cargá temperaturas en la hoja, marcá la ventana de conteo, y el F0 / FH se calcula solo.
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
                  <th scope="col" colSpan={2} className="method-col-group" style={{ textAlign: 'center' }}>
                    T en ventana (°C)
                  </th>
                </tr>
                <tr>
                  <th scope="col" className="num-head">Trapecio</th>
                  <th scope="col" className="num-head">Suma</th>
                  <th scope="col" className="num-head method-col-group">Trapecio</th>
                  <th scope="col" className="num-head">Suma</th>
                  <th scope="col" className="num-head method-col-group">Mín</th>
                  <th scope="col" className="num-head">Máx</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.statusF0 === 'fail' || r.statusTemp === 'fail' ? 'row-fail' : ''}>
                    <td>
                      <div className="sensor-cell">
                        <span className="swatch" style={{ background: r.color }} />
                        <span>{r.name}</span>
                        {r.f0Trap === minF0 && <span className="tag">mín</span>}
                        {uncalibrated?.has(r.id) && (
                          <span className="tag tag-warn" title="Sin puntos de calibración: se usa la lectura cruda">
                            sin calibrar
                          </span>
                        )}
                        {r.statusF0 === 'fail' && <span className="tag tag-fail">F0 bajo</span>}
                        {r.statusTemp === 'fail' && <span className="tag tag-fail">fuera de banda</span>}
                      </div>
                    </td>
                    <td className="num">{r.f0Trap.toFixed(2)}</td>
                    <td className="num">{r.f0Sum.toFixed(2)}</td>
                    <td className="num method-col-group">{r.fhTrap.toFixed(2)}</td>
                    <td className="num">{r.fhSum.toFixed(2)}</td>
                    <td className="num method-col-group">
                      {r.tempMin == null ? '—' : r.tempMin.toFixed(2)}
                    </td>
                    <td className="num">{r.tempMax == null ? '—' : r.tempMax.toFixed(2)}</td>
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
          irregulares — es la que decide el veredicto. <strong>Suma</strong>: réplica del método de
          suma acumulada (F[i]=F[i-1]+tasa·Δt) usado en las planillas de validación de referencia,
          para conciliar contra corridas históricas. Ambos cuentan sólo dentro de la ventana ●
          inicio → ● fin marcada en la hoja de datos.
        </p>
      )}
    </section>
  );
}
