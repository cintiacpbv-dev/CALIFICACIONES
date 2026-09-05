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
    <div className="settings-panel">
      <fieldset>
        <legend>F0 (referencia)</legend>
        <label>
          Temp. referencia (°C)
          <input
            type="number"
            step="0.1"
            value={project.ref_temp_f0}
            onChange={(e) => onChange({ ref_temp_f0: Number(e.target.value) })}
          />
        </label>
        <label>
          z (°C)
          <input
            type="number"
            step="0.1"
            value={project.z_value_f0}
            onChange={(e) => onChange({ z_value_f0: Number(e.target.value) })}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>FH (referencia)</legend>
        <label>
          Temp. referencia (°C)
          <input
            type="number"
            step="0.1"
            value={project.ref_temp_fh}
            onChange={(e) => onChange({ ref_temp_fh: Number(e.target.value) })}
          />
        </label>
        <label>
          z (°C)
          <input
            type="number"
            step="0.1"
            value={project.z_value_fh}
            onChange={(e) => onChange({ z_value_fh: Number(e.target.value) })}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Tiempo</legend>
        <label>
          Unidad
          <select
            value={project.time_unit}
            onChange={(e) => onChange({ time_unit: e.target.value })}
          >
            <option value="min">Minutos</option>
            <option value="s">Segundos</option>
          </select>
        </label>
      </fieldset>
    </div>
  );
}
