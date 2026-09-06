'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getRun, saveRunFields } from '@/lib/projectsApi';
import { computeRunResults, summarizeResults } from '@/lib/lethality';
import { useDebouncedAutosave } from '@/lib/useDebouncedAutosave';
import DataSheet from './DataSheet';
import SettingsPanel from './SettingsPanel';
import TemperatureChart from './TemperatureChart';
import LethalityChart from './LethalityChart';
import ResultsSummary from './ResultsSummary';
import AutosaveBadge from './AutosaveBadge';

/**
 * Workspace de una corrida: hoja de datos, marca de inicio de conteo,
 * parámetros F0/FH propios de esta corrida (el mismo equipo puede correr a
 * 115°C en una corrida y 121°C en otra), gráficos y resultados.
 *
 * La calibración de los sensores NO vive acá — es del equipo (ver
 * CalibrationPanel en la página del proyecto) y se aplica tal cual esté
 * definida al momento de calcular.
 *
 * Flujo de datos: rawData + settings + startIndex son la única fuente de
 * verdad en memoria. `results` es 100% derivado (useMemo). El autoguardado
 * persiste todo en `runs` con debounce compartido.
 */
export default function RunWorkspace({ runId }) {
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState(null);
  const [probes, setProbes] = useState([]);
  const [rawData, setRawData] = useState({ time: [], series: {} });
  const [settings, setSettings] = useState(null);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(null);
  const [name, setName] = useState('');

  useEffect(() => {
    let cancelled = false;
    getRun(runId).then(({ run, probes }) => {
      if (cancelled) return;
      setProjectId(run.project_id);
      setRawData(run.raw_data ?? { time: [], series: {} });
      setSettings({
        ref_temp_f0: run.ref_temp_f0,
        z_value_f0: run.z_value_f0,
        ref_temp_fh: run.ref_temp_fh,
        z_value_fh: run.z_value_fh,
        time_unit: run.time_unit,
      });
      setStartIndex(run.start_index ?? 0);
      setEndIndex(run.end_index ?? null);
      setName(run.name);
      // Todas las corridas de un proyecto usan las mismas termocuplas —
      // ver nota en supabase/schema.sql.
      setProbes(probes);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const sensors = useMemo(
    () => probes.map((p) => ({ id: p.id, name: p.code, color: p.color })),
    [probes]
  );

  const results = useMemo(() => {
    if (!settings) return {};
    return computeRunResults(rawData, probes, {
      refTempF0: settings.ref_temp_f0,
      zValueF0: settings.z_value_f0,
      refTempFh: settings.ref_temp_fh,
      zValueFh: settings.z_value_fh,
      timeUnit: settings.time_unit,
      startIndex,
      endIndex,
    });
  }, [rawData, probes, settings, startIndex, endIndex]);

  const correctedSeries = useMemo(() => {
    const out = {};
    for (const [probeId, r] of Object.entries(results)) out[probeId] = r.corrected;
    return out;
  }, [results]);

  const startTime = rawData.time?.[startIndex] ?? null;
  const endTime = endIndex == null ? null : (rawData.time?.[endIndex] ?? null);

  // --- Autoguardado -------------------------------------------------------
  const snapshot = useMemo(
    () => ({ rawData, probes, settings, startIndex, endIndex, name }),
    [rawData, probes, settings, startIndex, endIndex, name]
  );

  const saveSnapshot = useCallback(
    async ({ rawData, probes, settings, startIndex, endIndex, name }) => {
      if (!settings) return;
      await saveRunFields(runId, {
        name,
        raw_data: rawData,
        start_index: startIndex,
        end_index: endIndex,
        results_summary: summarizeResults(
          computeRunResults(rawData, probes, {
            refTempF0: settings.ref_temp_f0,
            zValueF0: settings.z_value_f0,
            refTempFh: settings.ref_temp_fh,
            zValueFh: settings.z_value_fh,
            timeUnit: settings.time_unit,
            startIndex,
            endIndex,
          })
        ),
        ref_temp_f0: settings.ref_temp_f0,
        z_value_f0: settings.z_value_f0,
        ref_temp_fh: settings.ref_temp_fh,
        z_value_fh: settings.z_value_fh,
        time_unit: settings.time_unit,
      });
    },
    [runId]
  );

  const autosaveStatus = useDebouncedAutosave(snapshot, saveSnapshot);

  if (loading || !settings) {
    return (
      <div className="page">
        <p className="empty">Cargando corrida…</p>
      </div>
    );
  }

  return (
    <>
      <header className="appbar">
        <Link href={projectId ? `/proyecto/${projectId}` : '/'} className="brand">
          <span className="brand-mark">F0</span>
          <span className="brand-name">Letalidad térmica</span>
        </Link>
        <span className="appbar-divider" />
        <input
          className="input project-name-input"
          aria-label="Nombre de la corrida"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <span className="appbar-spacer" />
        <AutosaveBadge status={autosaveStatus} />
      </header>

      <div className="page">
        <div className="stack">
          <div className="group-label">Entrada de datos</div>

          {probes.length === 0 ? (
            <div className="card">
              <p className="empty">
                <strong>Este equipo todavía no tiene termocuplas</strong>
                Cargalas desde la página del proyecto (panel de calibración) antes de traer datos
                acá.
              </p>
            </div>
          ) : (
            <DataSheet
              time={rawData.time}
              series={rawData.series}
              sensors={sensors}
              startIndex={startIndex}
              endIndex={endIndex}
              onChange={setRawData}
              onSetStartIndex={setStartIndex}
              onSetEndIndex={setEndIndex}
            />
          )}

          <SettingsPanel run={settings} onChange={(f) => setSettings((prev) => ({ ...prev, ...f }))} />

          <div className="group-label">Resultados</div>

          <ResultsSummary sensors={sensors} results={results} />

          <TemperatureChart
            time={rawData.time}
            correctedSeries={correctedSeries}
            sensors={sensors}
            timeUnit={settings.time_unit}
            startTime={startIndex > 0 ? startTime : null}
            endTime={endTime}
          />

          <LethalityChart
            time={rawData.time}
            results={results}
            sensors={sensors}
            timeUnit={settings.time_unit}
            startTime={startIndex > 0 ? startTime : null}
            endTime={endTime}
          />
        </div>
      </div>
    </>
  );
}
