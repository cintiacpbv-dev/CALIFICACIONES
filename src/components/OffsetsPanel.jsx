'use client';

import { uploadCalibrationCert } from '@/lib/projectsApi';

// Paleta categórica validada (orden fijo, no ciclado por hue), reordenada
// para abrir con el verde de marca sin perder la separación segura para
// daltonismo entre pares adyacentes en fondo claro (mismas 8 familias de
// color del método, sólo cambia el orden).
const PALETTE = [
  '#008300', // verde (marca)
  '#e34948', // rojo
  '#2a78d6', // azul
  '#eb6834', // naranja
  '#4a3aa7', // violeta
  '#eda100', // amarillo
  '#1baf7a', // aqua
  '#e87ba4', // magenta
];

/**
 * Corrección de data cruda por sensor: offset (°C) + datos del certificado
 * de calibración. El offset se suma directo a la temperatura cruda en
 * lib/lethality.js -> applyOffset; esta sección sólo edita ese número y sus
 * metadatos, no toca la data.
 *
 * @param {{
 *   sensors: {id:string, name:string, color:string, offset_celsius:number,
 *             calibration_cert_number?:string, calibration_date?:string,
 *             certificate_file_url?:string}[],
 *   onUpdateSensor: (id: string, fields: object) => void,
 *   onAddSensor: () => void,
 *   onRemoveSensor: (id: string) => void,
 * }} props
 */
export default function OffsetsPanel({ sensors, onUpdateSensor, onAddSensor, onRemoveSensor }) {
  async function handleCertUpload(sensorId, file) {
    try {
      const url = await uploadCalibrationCert(sensorId, file);
      onUpdateSensor(sensorId, { certificate_file_url: url });
    } catch (err) {
      alert('No se pudo subir el certificado: ' + err.message);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Sensores y offsets</h2>
        <span className="card-hint">El offset se suma a la data cruda antes de calcular</span>
        <div className="card-actions">
          <button className="btn btn-primary" onClick={onAddSensor}>
            + Sensor
          </button>
        </div>
      </div>

      <div className="card-body">
        {sensors.length === 0 ? (
          <p className="empty">
            <strong>Sin sensores cargados</strong>
            Cada termocupla es una columna de la hoja y una curva en los gráficos.
          </p>
        ) : (
          <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Sensor</th>
                <th scope="col">Offset (°C)</th>
                <th scope="col">N° certificado</th>
                <th scope="col">Fecha calibración</th>
                <th scope="col">Certificado</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {sensors.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="sensor-cell">
                      <span className="swatch" style={{ background: s.color }} />
                      <input
                        type="text"
                        aria-label="Nombre del sensor"
                        value={s.name}
                        onChange={(e) => onUpdateSensor(s.id, { name: e.target.value })}
                      />
                    </div>
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      className="num"
                      aria-label={`Offset de ${s.name}`}
                      value={s.offset_celsius}
                      onChange={(e) =>
                        onUpdateSensor(s.id, { offset_celsius: Number(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      aria-label={`Certificado de ${s.name}`}
                      placeholder="—"
                      value={s.calibration_cert_number ?? ''}
                      onChange={(e) =>
                        onUpdateSensor(s.id, { calibration_cert_number: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      aria-label={`Fecha de calibración de ${s.name}`}
                      value={s.calibration_date ?? ''}
                      onChange={(e) => onUpdateSensor(s.id, { calibration_date: e.target.value })}
                    />
                  </td>
                  <td>
                    <div className="cert-cell">
                      {s.certificate_file_url ? (
                        <a href={s.certificate_file_url} target="_blank" rel="noreferrer">
                          Ver PDF
                        </a>
                      ) : (
                        <span className="card-hint">Sin cargar</span>
                      )}
                      <label className="file-btn">
                        {s.certificate_file_url ? 'Reemplazar' : 'Subir'}
                        <input
                          type="file"
                          accept="application/pdf"
                          hidden
                          onChange={(e) =>
                            e.target.files?.[0] && handleCertUpload(s.id, e.target.files[0])
                          }
                        />
                      </label>
                    </div>
                  </td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => onRemoveSensor(s.id)}
                      aria-label={`Eliminar ${s.name}`}
                    >
                      Eliminar
                    </button>
                  </td>
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

export function nextSensorColor(existingCount) {
  return PALETTE[existingCount % PALETTE.length];
}
