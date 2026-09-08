'use client';

import { useRef, useState } from 'react';
import { parseDataFile, parsePastedText } from '@/lib/dataImport';
import { useToast } from './Toast';

/**
 * Hoja de datos interactiva (tipo Minitab): una columna "Tiempo" + una
 * columna por sensor. Tres formas de cargar datos, todas conviven:
 *
 * 1. Edición celda a celda, con navegación por teclado (flechas / Enter /
 *    Tab). Se prefirió una tabla propia a una librería de grid de terceros
 *    (evaluada y descartada: la única versión de react-data-grid compatible
 *    con esta versión de React depende de una API todavía no soportada por
 *    el pipeline de build de Next.js).
 * 2. "Pegar datos": pega un bloque TSV tal cual lo copia Excel.
 * 3. CSV / XLSX: reemplaza la hoja entera de una sola vez.
 *
 * Las celdas son <input type="text"> y no type="number" a propósito: en un
 * input numérico las flechas ↑/↓ incrementan el valor, y acá tienen que
 * mover el cursor entre filas como en cualquier planilla. La validación
 * numérica se hace al confirmar el valor.
 *
 * La ventana de conteo (startIndex..endIndex) se marca a mano acá: en las
 * planillas de validación reales que se tomaron de referencia, F0/FH no
 * cubren todo el registro — arrancan donde empieza la "meseta" de
 * exposición y cortan antes del enfriamiento. Ambos límites se eligen
 * mirando el gráfico, no siguen una regla fija.
 *
 * @param {{
 *   time: number[],
 *   series: Record<string, (number|null)[]>,
 *   sensors: {id: string, name: string, color: string}[],
 *   startIndex: number,
 *   endIndex: number|null,
 *   onChange: (next: {time: number[], series: Record<string, (number|null)[]>}) => void,
 *   onSetStartIndex: (index: number) => void,
 *   onSetEndIndex: (index: number|null) => void,
 * }} props
 */
/**
 * Texto de una celda. Recorta el ruido binario del punto flotante — una
 * lectura de 58.4 pegada desde Excel puede llegar como 58.400000000000006 y
 * llenar la hoja de decimales que nadie escribió. toPrecision(12) deja
 * intacto cualquier dato real de un registrador (5-6 cifras significativas).
 */
function cellText(value) {
  if (value == null || value === '') return '';
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);
  return String(Number(value.toPrecision(12)));
}

export default function DataSheet({
  time,
  series,
  sensors,
  startIndex,
  endIndex,
  onChange,
  onSetStartIndex,
  onSetEndIndex,
}) {
  const toast = useToast();
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  // Texto tal como se está tipeando en la celda con foco. Sin esto, escribir
  // "12." o "-" se perdería: Number("12.") no es finito y la celda se
  // vaciaría sola en medio de la carga.
  const [draft, setDraft] = useState(null);
  const gridRef = useRef(null);

  function setCell(rowIdx, key, rawValue) {
    const trimmed = String(rawValue).trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    const value = parsed != null && !Number.isFinite(parsed) ? null : parsed;
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

  /** Mueve el foco a otra celda de la grilla, si existe. */
  function focusCell(rowIdx, colIdx) {
    const el = gridRef.current?.querySelector(`[data-cell="${rowIdx}-${colIdx}"]`);
    if (el) {
      el.focus();
      el.select?.();
      return true;
    }
    return false;
  }

  /** true si el cursor está en el borde pedido, o si todo el texto está seleccionado. */
  function atEdge(input, side) {
    const { selectionStart, selectionEnd, value } = input;
    const allSelected = selectionStart === 0 && selectionEnd === value.length;
    if (allSelected) return true;
    return side === 'start'
      ? selectionStart === 0 && selectionEnd === 0
      : selectionStart === value.length && selectionEnd === value.length;
  }

  function handleKeyDown(e, rowIdx, colIdx) {
    const cols = sensors.length; // índice máximo: 0 = tiempo, 1..cols = sensores
    switch (e.key) {
      case 'ArrowDown':
      case 'Enter':
        e.preventDefault();
        if (!focusCell(rowIdx + 1, colIdx) && e.key === 'Enter') addRow();
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusCell(rowIdx - 1, colIdx);
        break;
      // ←/→ saltan de columna cuando el cursor ya está en el borde del
      // texto, o cuando la celda recién recibió el foco y su contenido está
      // entero seleccionado (que es como se llega navegando). Estando en
      // medio de un número se comportan como en cualquier input: mueven el
      // cursor, no la celda.
      case 'ArrowLeft':
        if (atEdge(e.target, 'start')) {
          e.preventDefault();
          if (colIdx > 0) focusCell(rowIdx, colIdx - 1);
        }
        break;
      case 'ArrowRight':
        if (atEdge(e.target, 'end')) {
          e.preventDefault();
          if (colIdx < cols) focusCell(rowIdx, colIdx + 1);
        }
        break;
      default:
        break;
    }
  }

  function cellProps(rowIdx, colIdx, key, storedValue) {
    const id = `${rowIdx}-${colIdx}`;
    return {
      type: 'text',
      inputMode: 'decimal',
      autoComplete: 'off',
      'data-cell': id,
      value: draft?.id === id ? draft.text : cellText(storedValue),
      onChange: (e) => {
        setDraft({ id, text: e.target.value });
        setCell(rowIdx, key, e.target.value);
      },
      onFocus: (e) => setDraft({ id, text: e.target.value }),
      onBlur: () => setDraft((d) => (d?.id === id ? null : d)),
      onKeyDown: (e) => handleKeyDown(e, rowIdx, colIdx),
    };
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

    // Si los marcadores quedaban en la fila que se fue, corregirlos: un
    // índice fuera de rango deja el F0 en cero sin explicar por qué.
    const lastRow = nextTime.length - 1;
    if (startIndex > lastRow) onSetStartIndex(Math.max(0, lastRow));
    if (endIndex != null && endIndex > lastRow) onSetEndIndex(null);
  }

  function applyImportedDataset(dataset, origin) {
    // dataset.sensorNames viene del archivo/pegado; se mapea 1:1 por
    // posición a los sensores ya creados. Si hay más columnas que sensores,
    // se ignoran las sobrantes (el usuario debe crear el sensor primero).
    const previous = { time, series, startIndex, endIndex };
    const nextSeries = {};
    sensors.forEach((s, i) => {
      nextSeries[s.id] = dataset.values[i] ?? [];
    });
    onChange({ time: dataset.time, series: nextSeries });
    onSetStartIndex(0);
    onSetEndIndex(null);

    const extra = dataset.sensorNames.length - sensors.length;
    toast.push({
      level: 'success',
      title: `${dataset.time.length} lecturas cargadas desde ${origin}`,
      detail:
        extra > 0
          ? `Se ignoraron ${extra} columna(s): agregá esas termocuplas al equipo y volvé a importar.`
          : 'La ventana de conteo se reinició a la hoja completa.',
      duration: 12000,
      action: {
        label: 'Deshacer',
        onClick: () => {
          onChange({ time: previous.time, series: previous.series });
          onSetStartIndex(previous.startIndex);
          onSetEndIndex(previous.endIndex);
        },
      },
    });
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataset = await parseDataFile(file);
      if (!dataset.time.length) {
        toast.error('El archivo no tiene filas de datos', 'Revisá que la primera fila sea el encabezado y la primera columna el tiempo.');
        return;
      }
      applyImportedDataset(dataset, file.name);
    } catch (err) {
      toast.error('No se pudo leer el archivo', err.message);
    } finally {
      e.target.value = '';
    }
  }

  function handlePasteApply() {
    try {
      const dataset = parsePastedText(pasteText);
      if (!dataset.time.length) {
        toast.error('No se reconoció ninguna fila de datos', 'Pegá el bloque incluyendo la fila de encabezado.');
        return;
      }
      applyImportedDataset(dataset, 'el portapapeles');
      setPasteOpen(false);
      setPasteText('');
    } catch (err) {
      toast.error('No se pudo interpretar el texto pegado', err.message);
    }
  }

  const hasSensors = sensors.length > 0;
  const hasRows = time.length > 0;
  // endIndex null = hasta la última fila
  const effectiveEnd = endIndex ?? time.length - 1;

  function rowClass(rowIdx) {
    if (rowIdx === startIndex) return 'is-start';
    if (rowIdx === effectiveEnd) return 'is-end';
    if (rowIdx < startIndex || rowIdx > effectiveEnd) return 'outside-window';
    return '';
  }

  return (
    <section className="card no-print">
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
            <div className="sheet-scroll" ref={gridRef}>
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
                    <tr key={rowIdx} className={rowClass(rowIdx)}>
                      <td>
                        <div className="sheet-time-cell">
                          <input
                            aria-label={`Tiempo, fila ${rowIdx + 1}`}
                            {...cellProps(rowIdx, 0, 'time', t)}
                          />
                          <div className="marker-row">
                            <button
                              type="button"
                              className={`start-marker-btn${rowIdx === startIndex ? ' is-active' : ''}`}
                              onClick={() => onSetStartIndex(rowIdx)}
                              title="Marcar como inicio del conteo F0/FH"
                            >
                              {rowIdx === startIndex ? '● inicio' : 'inicio'}
                            </button>
                            <button
                              type="button"
                              className={`start-marker-btn${rowIdx === effectiveEnd ? ' is-active' : ''}`}
                              onClick={() => onSetEndIndex(rowIdx === endIndex ? null : rowIdx)}
                              title="Marcar como fin del conteo F0/FH (volver a tocarlo lo quita)"
                            >
                              {rowIdx === effectiveEnd ? '● fin' : 'fin'}
                            </button>
                          </div>
                        </div>
                      </td>
                      {sensors.map((s, colIdx) => (
                        <td key={s.id}>
                          <input
                            aria-label={`${s.name}, fila ${rowIdx + 1}`}
                            {...cellProps(rowIdx, colIdx + 1, s.id, series[s.id]?.[rowIdx])}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="method-note">
              El F0/FH se cuenta sólo dentro de la ventana <strong>● inicio → ● fin</strong>; las
              filas de afuera quedan atenuadas y no aportan letalidad. Por defecto va de la primera
              a la última fila. Tocá <strong>fin</strong> otra vez para volver a «hasta el final».
              En la grilla: <kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd> mueven de fila,{' '}
              <kbd>Tab</kbd> y <kbd>←</kbd> <kbd>→</kbd> de columna.
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
                reinicia la ventana de conteo a la hoja completa (se puede deshacer).
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
