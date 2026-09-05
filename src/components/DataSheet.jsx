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
 *    API todavía no soportada por el pipeline de build de Next.js). Una
 *    tabla de <input> cubre la misma necesidad sin ese riesgo de versión.
 * 2. "Pegar / importar datos": pega un bloque TSV (tal cual copia Excel) o
 *    sube un CSV/XLSX, y reemplaza la hoja entera de una sola vez. Es el
 *    camino robusto para cargar un lote completo, sin depender de eventos
 *    de portapapeles celda por celda (frágiles entre navegadores).
 *
 * @param {{
 *   time: number[],
 *   series: Record<string, (number|null)[]>,
 *   sensors: {id: string, name: string, color: string}[],
 *   onChange: (next: {time: number[], series: Record<string, (number|null)[]>}) => void,
 * }} props
 */
export default function DataSheet({ time, series, sensors, onChange }) {
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
    const dataset = parsePastedText(pasteText);
    applyImportedDataset(dataset);
    setPasteOpen(false);
    setPasteText('');
  }

  return (
    <div className="data-sheet">
      <div className="data-sheet-toolbar">
        <button onClick={addRow}>+ Fila</button>
        <button onClick={removeLastRow}>- Fila</button>
        <button onClick={() => setPasteOpen(true)}>Pegar datos</button>
        <label className="file-upload-btn">
          Cargar CSV / Excel
          <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleFileUpload} hidden />
        </label>
      </div>

      <div className="sheet-scroll">
        <table className="sheet-table">
          <thead>
            <tr>
              <th>Tiempo</th>
              {sensors.map((s) => (
                <th key={s.id} style={{ borderBottom: `3px solid ${s.color}` }}>
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {time.map((t, rowIdx) => (
              <tr key={rowIdx}>
                <td>
                  <input
                    type="number"
                    value={t ?? ''}
                    onChange={(e) => setCell(rowIdx, 'time', e.target.value)}
                  />
                </td>
                {sensors.map((s) => (
                  <td key={s.id}>
                    <input
                      type="number"
                      step="0.01"
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

      {pasteOpen && (
        <div className="modal-backdrop" onClick={() => setPasteOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Pegar datos</h3>
            <p>
              Pega el bloque copiado de Excel (primera columna = Tiempo, luego una columna por
              sensor, en el mismo orden que las columnas de la hoja). Esto reemplaza los datos
              actuales.
            </p>
            <textarea
              rows={12}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'Tiempo\tSensor 1\tSensor 2\n0\t20.1\t19.8\n1\t45.3\t44.9'}
            />
            <div className="modal-actions">
              <button onClick={() => setPasteOpen(false)}>Cancelar</button>
              <button className="primary" onClick={handlePasteApply} disabled={!pasteText.trim()}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
