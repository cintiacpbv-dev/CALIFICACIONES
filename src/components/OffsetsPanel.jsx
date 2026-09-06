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
 *             calibration_notes?:string, certificate_file_url?:string}[],
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
    <div className="offsets-panel">
      <div className="offsets-header">
        <h3>Sensores y factores de corrección</h3>
        <button onClick={onAddSensor}>+ Sensor</button>
      </div>

      <table className="offsets-table">
        <thead>
          <tr>
            <th>Sensor</th>
            <th>Offset (°C)</th>
            <th>N° certificado</th>
            <th>Fecha calibración</th>
            <th>Certificado (PDF)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sensors.map((s) => (
            <tr key={s.id}>
              <td>
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => onUpdateSensor(s.id, { name: e.target.value })}
                  style={{ borderLeft: `4px solid ${s.color}` }}
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  value={s.offset_celsius}
                  onChange={(e) =>
                    onUpdateSensor(s.id, { offset_celsius: Number(e.target.value) || 0 })
                  }
                />
              </td>
              <td>
                <input
                  type="text"
                  value={s.calibration_cert_number ?? ''}
                  onChange={(e) => onUpdateSensor(s.id, { calibration_cert_number: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="date"
                  value={s.calibration_date ?? ''}
                  onChange={(e) => onUpdateSensor(s.id, { calibration_date: e.target.value })}
                />
              </td>
              <td>
                {s.certificate_file_url ? (
                  <a href={s.certificate_file_url} target="_blank" rel="noreferrer">
                    Ver PDF
                  </a>
                ) : (
                  <span className="muted">Sin cargar</span>
                )}
                <label className="file-upload-btn small">
                  {s.certificate_file_url ? 'Reemplazar' : 'Subir'}
                  <input
                    type="file"
                    accept="application/pdf"
                    hidden
                    onChange={(e) => e.target.files?.[0] && handleCertUpload(s.id, e.target.files[0])}
                  />
                </label>
              </td>
              <td>
                <button className="danger" onClick={() => onRemoveSensor(s.id)}>
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function nextSensorColor(existingCount) {
  return PALETTE[existingCount % PALETTE.length];
}
