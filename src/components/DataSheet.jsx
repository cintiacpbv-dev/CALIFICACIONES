'use client';

import { useState } from 'react';
import { parseDataFile, parsePastedText } from '@/lib/dataImport';

/**
 * Hoja de datos interactiva (tipo Minitab): una columna "Tiempo" + una
 * columna por sensor. Dos formas de cargar datos, ambas conviven:
 *
 * 1. Edición celda a celda con una tabla editable simple — se prefirió a una
 *    librería de grid de terceros (evaluada y descartada: la única versión
 *    de react-data-grid compatible con esta versión de React depende de una
 *    API todavía no soportada por el pipeline de build de Next.js).
 * 2. "Pegar / importar datos": pega un bloque TSV (tal cual copia Excel) o
 *    sube un CSV/XLSX, y reemplaza la hoja entera de una sola vez. Es el
 *    camino robusto para cargar un lote completo, sin depender de eventos
 *    de portapapeles celda por celda (frágiles entre navegadores).
 *
 * La fila de inicio de conteo (startIndex) se marca a mano acá: en las
 * planillas de validación reales que se tomaron de referencia, F0/FH no
 * arrancan en t=0 sino en la fila donde arranca la "meseta" de exposición,
 * y esa fila se elige mirando el gráfico — no sigue una regla fija.
 *
 * @param {{
 *   time: number[],
 *   series: Record<string, (number|null)[]>,
 *   sensors: {id: string, name: string, color: string}[],
 *   startIndex: number,
 *   onChange: (next: {time: number[], series: Record<string, (number|null)[]>}) => void,
 *   onSetStartIndex: (index: number) => void,
 * }} props
 */
export default function DataSheet({ time, series, sensors, startIndex, onChange, onSetStartIndex }) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  function setCell(rowIdx, key, rawValue) {
    const value = rawValue === '' ? null : Number(rawValue);
    if (key === 'time') {
      const nextTime = [...time];
      nextTime[rowIdx] = value;
      onChange({ time: nextTime, series });
      return;
    }
    const nextSeries = { ...series, [key]: [...(series[key] ?? [])] };
    nextSeries[key][rowIdx] = value;
    onChange({ time, series: nextSeries });
  }

  function addRow() {
    const lastTime = time.length ? time[time.length - 1] : 0;
    const step = time.length > 1 ? time[time.length - 1] - time[time.length - 2] : 1;
    const nextTime = [...time, (lastTime ?? 0) + (Number.isFinite(step) ? step : 1)];
    const nextSeries = {};
    for (const s of sensors) nextSeries[s.id] = [...(series[s.id] ?? []), null];
    onChange({ time: nextTime, series: nextSeries });
  }

  function removeLastRow() {
    if (!time.length) return;
    const nextTime = time.slice(0, -1);
    const nextSeries = {};
    for (const s of sensors) nextSeries[s.id] = (series[s.id] ?? []).slice(0, -1);
    onChange({ time: nextTime, series: nextSeries });
  }

  function applyImportedDataset(dataset) {
    // dataset.sensorNames viene del archivo/pegado; se mapea 1:1 por
    // posición a los sensores ya creados. Si hay más columnas que sensores,
    // se ignoran las sobrantes (el usuario debe crear el sensor primero).
    const nextSeries = {};
    sensors.forEach((s, i) => {
      nextSeries[s.id] = dataset.values[i] ?? [];
    });
    onChange({ time: dataset.time, series: nextSeries });
    onSetStartIndex(0);
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataset = await parseDataFile(file);
      applyImportedDataset(dataset);
    } catch (err) {
      alert(err.message);
    } finally {
      e.target.value = '';
    }
  }

  function handlePasteApply() {
    applyImportedDataset(parsePastedText(pasteText));
    setPasteOpen(false);
    setPasteText('');
  }

  const hasSensors = sensors.length > 0;
  const hasRows = time.length > 0;

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Hoja de datos</h2>
        <span className="card-hint">
          {hasRows ? `${time.length} lecturas · ${sensors.length} sensores` : 'Sin datos'}
        </span>
        <div className="card-actions">
          <button className="btn btn-ghost" onClick={removeLastRow} disabled={!hasRows}>
            − Fila
          </button>
          <button className="btn btn-ghost" onClick={addRow} disabled={!hasSensors}>
            + Fila
          </button>
          <button className="btn" onClick={() => setPasteOpen(true)} disabled={!hasSensors}>
            Pegar datos
          </button>
          <label className={`btn btn-primary${hasSensors ? '' : ' is-disabled'}`}>
            Cargar CSV / Excel
            <input
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              onChange={handleFileUpload}
              disabled={!hasSensors}
              hidden
            />
          </label>
        </div>
      </div>

      <div className="card-body flush">
        {!hasSensors ? (
          <p className="empty">
            <strong>Todavía no hay sensores</strong>
            Agregá al menos una termocupla en el panel de calibración del proyecto.
          </p>
        ) : !hasRows ? (
          <p className="empty">
            <strong>La hoja está vacía</strong>
            Pegá los datos desde Excel, cargá un CSV, o agregá filas a mano.
          </p>
        ) : (
          <>
            <div className="sheet-scroll">
              <table className="sheet-table">
                <thead>
                  <tr>
                    <th scope="col">Tiempo</th>
                    {sensors.map((s) => (
                      <th key={s.id} scope="col">
                        <span className="sheet-swatch" style={{ background: s.color }} />
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {time.map((t, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className={
                        rowIdx === startIndex ? 'is-start' : rowIdx < startIndex ? 'before-start' : ''
                      }
                    >
                      <td>
                        <div className="sheet-time-cell">
                          <input
                            type="number"
                            aria-label={`Tiempo, fila ${rowIdx + 1}`}
                            value={t ?? ''}
                            onChange={(e) => setCell(rowIdx, 'time', e.target.value)}
                          />
                          <button
                            type="button"
                            className={`start-marker-btn${rowIdx === startIndex ? ' is-active' : ''}`}
                            onClick={() => onSetStartIndex(rowIdx)}
                            title="Marcar como inicio del conteo F0/FH"
                          >
                            {rowIdx === startIndex ? '● Inicio F0/FH' : 'Marcar inicio'}
                          </button>
                        </div>
                      </td>
                      {sensors.map((s) => (
                        <td key={s.id}>
                          <input
                            type="number"
                            step="0.01"
                            aria-label={`${s.name}, fila ${rowIdx + 1}`}
                            value={series[s.id]?.[rowIdx] ?? ''}
                            onChange={(e) => setCell(rowIdx, s.id, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="method-note">
              Las filas antes de <strong>● Inicio F0/FH</strong> quedan atenuadas: no aportan
              letalidad. Por defecto arranca en la fila 0.
            </p>
          </>
        )}
      </div>

      {pasteOpen && (
        <div className="modal-backdrop" onClick={() => setPasteOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-head">
              <h2 className="card-title">Pegar datos</h2>
            </div>
            <div className="modal-body">
              <p>
                Pegá el bloque copiado de Excel: primera columna <strong>Tiempo</strong>, después una
                columna por sensor en el mismo orden que la hoja. Reemplaza los datos actuales y
                reinicia la marca de inicio a la fila 0.
              </p>
              <textarea
                rows={10}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={'Tiempo\tSensor 1\tSensor 2\n0\t20.1\t19.8\n1\t45.3\t44.9'}
              />
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setPasteOpen(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handlePasteApply} disabled={!pasteText.trim()}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
