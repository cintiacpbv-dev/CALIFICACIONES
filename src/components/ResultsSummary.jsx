'use client';

/**
 * Resultados F0 / FH por sensor.
 *
 * El encabezado destaca el F0 mínimo porque, en un estudio de penetración
 * de calor, el sensor más frío es el que gobierna la aceptación del proceso:
 * es el número que se mira primero.
 *
 * @param {{
 *   sensors: {id:string, name:string, color:string}[],
 *   results: Record<string, {f0:number, fh:number}>,
 * }} props
 */
export default function ResultsSummary({ sensors, results }) {
  const rows = sensors.map((s) => ({
    ...s,
    f0: results[s.id]?.f0 ?? 0,
    fh: results[s.id]?.fh ?? 0,
  }));

  const hasData = rows.length > 0 && rows.some((r) => r.f0 > 0 || r.fh > 0);
  const f0Values = rows.map((r) => r.f0);
  const minF0 = hasData ? Math.min(...f0Values) : 0;
  const maxF0 = hasData ? Math.max(...f0Values) : 0;
  const coldest = hasData ? rows.find((r) => r.f0 === minF0) : null;

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
            Cargá temperaturas en la hoja y el F0 / FH se calcula solo.
          </p>
        ) : (
          <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Sensor</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  F0 (min)
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  FH (min)
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
                      {r.f0 === minF0 && <span className="tag">mín</span>}
                    </div>
                  </td>
                  <td>
                    <div className="bar-cell">
                      <span className="bar-track">
                        <span
                          className="bar-fill"
                          style={{
                            inlineSize: maxF0 > 0 ? `${(r.f0 / maxF0) * 100}%` : '0%',
                            background: r.color,
                          }}
                        />
                      </span>
                      <span className="bar-value">{r.f0.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="num">{r.fh.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </section>
  );
}
