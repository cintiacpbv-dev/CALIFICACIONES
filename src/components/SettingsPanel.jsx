'use client';

/**
 * Parámetros de referencia del cálculo de letalidad. F0 usa por convención
 * 121.1°C / z=10, pero se dejan editables por si el proceso lo requiere; FH
 * es siempre configurable (no tiene un valor "estándar" universal).
 *
 * @param {{
 *   project: { ref_temp_f0:number, z_value_f0:number, ref_temp_fh:number, z_value_fh:number, time_unit:'min'|'s' },
 *   onChange: (fields: object) => void,
 * }} props
 */
export default function SettingsPanel({ project, onChange }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Parámetros de cálculo</h2>
        <span className="card-hint">L(t) = 10^((T − Tref) / z)</span>
      </div>

      <div className="card-body">
        <div className="param-grid">
          <div className="param-group">
            <div className="param-group-title">F0 — referencia</div>
            <div className="param-fields">
              <label className="field">
                <span className="field-label">Tref (°C)</span>
                <input
                  type="number"
                  step="0.1"
                  className="num"
                  value={project.ref_temp_f0}
                  onChange={(e) => onChange({ ref_temp_f0: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                <span className="field-label">z (°C)</span>
                <input
                  type="number"
                  step="0.1"
                  className="num"
                  value={project.z_value_f0}
                  onChange={(e) => onChange({ z_value_f0: Number(e.target.value) })}
                />
              </label>
            </div>
          </div>

          <div className="param-group">
            <div className="param-group-title">FH — referencia</div>
            <div className="param-fields">
              <label className="field">
                <span className="field-label">Tref (°C)</span>
                <input
                  type="number"
                  step="0.1"
                  className="num"
                  value={project.ref_temp_fh}
                  onChange={(e) => onChange({ ref_temp_fh: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                <span className="field-label">z (°C)</span>
                <input
                  type="number"
                  step="0.1"
                  className="num"
                  value={project.z_value_fh}
                  onChange={(e) => onChange({ z_value_fh: Number(e.target.value) })}
                />
              </label>
            </div>
          </div>

          <div className="param-group">
            <div className="param-group-title">Tiempo</div>
            <div className="param-fields">
              <label className="field">
                <span className="field-label">Unidad de la columna Tiempo</span>
                <select
                  value={project.time_unit}
                  onChange={(e) => onChange({ time_unit: e.target.value })}
                >
                  <option value="min">Minutos</option>
                  <option value="s">Segundos</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
