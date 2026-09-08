'use client';

/**
 * "Condición de trabajo" de la corrida. Los campos salen del encabezado de
 * las planillas de validación reales que se tomaron de referencia: sin
 * fecha, lote/protocolo, ciclo y descripción de carga, el informe exportado
 * no sirve como anexo — el número de F0 solo no dice a qué carga
 * corresponde.
 *
 * Ninguno es obligatorio: la app calcula igual. Los vacíos salen como "—"
 * en el informe.
 *
 * @param {{ run: object, onChange: (fields: object) => void }} props
 */
export default function RunMetaPanel({ run, onChange }) {
  const set = (field) => (e) => onChange({ [field]: e.target.value || null });

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Condición de trabajo</h2>
        <span className="card-hint">Encabezado del informe exportado</span>
      </div>

      <div className="card-body">
        <div className="meta-grid">
          <label className="field">
            <span className="field-label">Fecha del ensayo</span>
            <input type="date" value={run.run_date ?? ''} onChange={set('run_date')} />
          </label>
          <label className="field">
            <span className="field-label">Lote / protocolo</span>
            <input
              type="text"
              value={run.batch_code ?? ''}
              onChange={set('batch_code')}
              placeholder="ej. PROT-2026-014"
            />
          </label>
          <label className="field">
            <span className="field-label">Ciclo</span>
            <input
              type="text"
              value={run.cycle_code ?? ''}
              onChange={set('cycle_code')}
              placeholder="ej. Ciclo 2 — 121 °C / 15 min"
            />
          </label>
          <label className="field">
            <span className="field-label">Operador</span>
            <input
              type="text"
              value={run.operator ?? ''}
              onChange={set('operator')}
              placeholder="Iniciales o nombre"
            />
          </label>
          <label className="field span-2">
            <span className="field-label">Descripción de la carga</span>
            <input
              type="text"
              value={run.load_description ?? ''}
              onChange={set('load_description')}
              placeholder="ej. Cámara vacía / 120 viales de 10 mL en 2 bandejas"
            />
          </label>
        </div>

        <label className="field">
          <span className="field-label">Observaciones</span>
          <textarea
            rows={2}
            value={run.notes ?? ''}
            onChange={set('notes')}
            placeholder="Desvíos, incidencias, comentarios que van al informe"
          />
        </label>
      </div>
    </section>
  );
}
