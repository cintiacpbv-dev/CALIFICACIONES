'use client';

/**
 * Criterios de aceptación de la corrida. Un campo vacío = criterio no
 * definido: no se evalúa y no cuenta como incumplimiento (mostrar "no
 * cumple" por un criterio que nadie cargó sería peor que no mostrar nada).
 *
 * El F0/FH mínimo se exige al SENSOR MÁS FRÍO — es el que gobierna la
 * aceptación de un estudio de penetración de calor. La banda de temperatura
 * se evalúa sólo dentro de la ventana de conteo; fuera de la meseta la
 * temperatura obviamente está por debajo del límite inferior.
 *
 * @param {{ run: object, onChange: (fields: object) => void }} props
 */
export default function AcceptancePanel({ run, onChange }) {
  const set = (field) => (e) => {
    const v = e.target.value;
    onChange({ [field]: v === '' ? null : Number(v) });
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Criterios de aceptación</h2>
        <span className="card-hint">Vacío = sin criterio, no se evalúa</span>
      </div>

      <div className="card-body">
        <div className="param-grid">
          <div className="param-group">
            <div className="param-group-title">Letalidad mínima</div>
            <div className="param-fields">
              <label className="field">
                <span className="field-label">F0 mínimo (min)</span>
                <input
                  type="number"
                  step="0.1"
                  className="num"
                  value={run.f0_min_required ?? ''}
                  onChange={set('f0_min_required')}
                  placeholder="ej. 15"
                />
              </label>
              <label className="field">
                <span className="field-label">FH mínimo (min)</span>
                <input
                  type="number"
                  step="0.1"
                  className="num"
                  value={run.fh_min_required ?? ''}
                  onChange={set('fh_min_required')}
                  placeholder="ej. 3"
                />
              </label>
            </div>
          </div>

          <div className="param-group">
            <div className="param-group-title">Banda de temperatura</div>
            <div className="param-fields">
              <label className="field">
                <span className="field-label">Límite inferior (°C)</span>
                <input
                  type="number"
                  step="0.1"
                  className="num"
                  value={run.temp_low_limit ?? ''}
                  onChange={set('temp_low_limit')}
                  placeholder="ej. 121"
                />
              </label>
              <label className="field">
                <span className="field-label">Límite superior (°C)</span>
                <input
                  type="number"
                  step="0.1"
                  className="num"
                  value={run.temp_high_limit ?? ''}
                  onChange={set('temp_high_limit')}
                  placeholder="ej. 124"
                />
              </label>
            </div>
          </div>
        </div>

        <p className="method-note">
          El <strong>F0/FH mínimo</strong> se exige al sensor más frío: si el peor llega, todos
          llegan. La <strong>banda de temperatura</strong> se evalúa sólo dentro de la ventana ●
          inicio → ● fin y se dibuja sobre el gráfico de temperatura. El veredicto usa el método
          del <strong>trapecio</strong>; la columna «suma» queda para conciliar históricos.
        </p>
      </div>
    </section>
  );
}
