'use client';

import { uploadCalibrationCert } from '@/lib/projectsApi';
import { fitCalibration } from '@/lib/calibration';
import { useToast } from './Toast';

// Paleta categórica validada (orden fijo, no ciclado por hue), abierta con
// el verde de marca sin perder la separación segura para daltonismo entre
// pares adyacentes en fondo claro.
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

export function nextProbeColor(existingCount) {
  return PALETTE[existingCount % PALETTE.length];
}

/**
 * Calibración de las termocuplas del equipo: 2 o 3 puntos por sensor.
 * En las planillas de referencia las dos columnas son:
 *   EQUI = lo que leyó ESTE canal en el punto de calibración (mismo
 *          dominio que la data cruda de la corrida: la data en vivo va en
 *          esa misma columna).
 *   TCV  = el valor certificado del patrón en ese punto (el "verdadero").
 * Con esos puntos se arma la recta que corrige cada lectura cruda — ver
 * lib/calibration.js. Vive a nivel proyecto porque el mismo certificado se
 * reutiliza en todas las corridas del equipo.
 *
 * @param {{
 *   probes: {id:string, code:string, color:string,
 *            calibration_points:{tcv:number,equi:number}[],
 *            calibration_cert_number?:string, calibration_date?:string,
 *            certificate_file_url?:string}[],
 *   onUpdateProbe: (id: string, fields: object) => void,
 *   onAddProbe: () => void,
 *   onRemoveProbe: (id: string) => void,
 * }} props
 */
export default function CalibrationPanel({ probes, onUpdateProbe, onAddProbe, onRemoveProbe }) {
  const toast = useToast();

  async function handleCertUpload(probeId, file) {
    try {
      const url = await uploadCalibrationCert(probeId, file);
      onUpdateProbe(probeId, { certificate_file_url: url });
      toast.success('Certificado subido', file.name);
    } catch (err) {
      toast.error('No se pudo subir el certificado', err.message);
    }
  }

  function updatePoint(probe, index, field, value) {
    const points = probe.calibration_points.map((p, i) =>
      i === index ? { ...p, [field]: value === '' ? null : Number(value) } : p
    );
    onUpdateProbe(probe.id, { calibration_points: points });
  }

  function addPoint(probe) {
    if (probe.calibration_points.length >= 3) return;
    onUpdateProbe(probe.id, {
      calibration_points: [...probe.calibration_points, { tcv: null, equi: null }],
    });
  }

  function removePoint(probe, index) {
    onUpdateProbe(probe.id, {
      calibration_points: probe.calibration_points.filter((_, i) => i !== index),
    });
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Termocuplas y calibración</h2>
        <span className="card-hint">2-3 puntos por sensor: lectura del canal ↔ valor del patrón</span>
        <div className="card-actions">
          <button className="btn btn-primary" onClick={onAddProbe}>
            + Termocupla
          </button>
        </div>
      </div>

      <div className="card-body">
        {probes.length === 0 ? (
          <p className="empty">
            <strong>Sin termocuplas cargadas</strong>
            Cada una es una columna de la hoja de datos en todas las corridas del equipo.
          </p>
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            {probes.map((probe) => {
              const fit = fitCalibration(probe.calibration_points);
              return (
                <div key={probe.id} className="probe-row">
                  <div className="probe-row-head">
                    <span className="swatch" style={{ background: probe.color }} />
                    <input
                      type="text"
                      className="probe-code-input"
                      aria-label="Código de la termocupla"
                      value={probe.code}
                      onChange={(e) => onUpdateProbe(probe.id, { code: e.target.value })}
                    />
                    {fit ? (
                      <span className="card-hint mono">
                        corregida = {fit.intercept.toFixed(3)} + {fit.slope.toFixed(4)} × cruda
                      </span>
                    ) : (
                      <span className="tag tag-warn">
                        sin calibrar — se usa la lectura cruda
                      </span>
                    )}
                    <div className="card-actions">
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => onRemoveProbe(probe.id)}
                        aria-label={`Eliminar ${probe.code}`}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Punto</th>
                          <th scope="col">EQUI — lectura del canal (°C)</th>
                          <th scope="col">TCV — valor patrón (°C)</th>
                          <th scope="col" aria-label="Acciones" />
                        </tr>
                      </thead>
                      <tbody>
                        {probe.calibration_points.map((p, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                className="num"
                                aria-label={`Lectura del canal (EQUI), punto ${i + 1}`}
                                value={p.equi ?? ''}
                                onChange={(e) => updatePoint(probe, i, 'equi', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                className="num"
                                aria-label={`Valor patrón (TCV), punto ${i + 1}`}
                                value={p.tcv ?? ''}
                                onChange={(e) => updatePoint(probe, i, 'tcv', e.target.value)}
                              />
                            </td>
                            <td>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => removePoint(probe, i)}
                                aria-label={`Quitar punto ${i + 1}`}
                              >
                                Quitar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="probe-row-foot">
                    <button
                      className="btn btn-sm"
                      onClick={() => addPoint(probe)}
                      disabled={probe.calibration_points.length >= 3}
                    >
                      + Punto de calibración
                    </button>

                    <input
                      type="text"
                      className="cert-number-input"
                      placeholder="N° certificado"
                      aria-label={`Certificado de ${probe.code}`}
                      value={probe.calibration_cert_number ?? ''}
                      onChange={(e) =>
                        onUpdateProbe(probe.id, { calibration_cert_number: e.target.value })
                      }
                    />
                    <input
                      type="date"
                      aria-label={`Fecha de calibración de ${probe.code}`}
                      value={probe.calibration_date ?? ''}
                      onChange={(e) => onUpdateProbe(probe.id, { calibration_date: e.target.value })}
                    />
                    {probe.certificate_file_url ? (
                      <a href={probe.certificate_file_url} target="_blank" rel="noreferrer">
                        Ver PDF
                      </a>
                    ) : (
                      <span className="card-hint">Sin certificado</span>
                    )}
                    <label className="file-btn">
                      {probe.certificate_file_url ? 'Reemplazar' : 'Subir'}
                      <input
                        type="file"
                        accept="application/pdf"
                        hidden
                        onChange={(e) =>
                          e.target.files?.[0] && handleCertUpload(probe.id, e.target.files[0])
                        }
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
