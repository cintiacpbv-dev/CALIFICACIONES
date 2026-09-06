'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  createSensor,
  deleteSensor,
  getProject,
  saveProjectFields,
  saveSensorFields,
} from '@/lib/projectsApi';
import { computeProjectResults, summarizeResults } from '@/lib/lethality';
import { useDebouncedAutosave } from '@/lib/useDebouncedAutosave';
import { nextSensorColor } from './OffsetsPanel';
import DataSheet from './DataSheet';
import OffsetsPanel from './OffsetsPanel';
import SettingsPanel from './SettingsPanel';
import TemperatureChart from './TemperatureChart';
import LethalityChart from './LethalityChart';
import ResultsSummary from './ResultsSummary';
import AutosaveBadge from './AutosaveBadge';

/**
 * Workspace de un proyecto: junta la hoja de datos, los offsets, los
 * parámetros F0/FH, los gráficos y el resumen, y orquesta el autoguardado.
 *
 * Flujo de datos (unidireccional): rawData + sensors + projectSettings son
 * la única fuente de verdad en memoria. `results` es 100% derivado
 * (useMemo) — nunca se edita directamente. El autoguardado persiste
 * rawData/settings/resultados-resumen en `projects` y los campos de cada
 * sensor en `sensors`, con un debounce compartido para no golpear Supabase
 * en cada tecla.
 */
export default function ProjectWorkspace({ projectId }) {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState({ time: [], series: {} });
  const [sensors, setSensors] = useState([]);
  const [settings, setSettings] = useState(null);
  const [name, setName] = useState('');

  useEffect(() => {
    let cancelled = false;
    getProject(projectId).then(({ project, sensors }) => {
      if (cancelled) return;
      setRawData(project.raw_data ?? { time: [], series: {} });
      setSettings({
        ref_temp_f0: project.ref_temp_f0,
        z_value_f0: project.z_value_f0,
        ref_temp_fh: project.ref_temp_fh,
        z_value_fh: project.z_value_fh,
        time_unit: project.time_unit,
      });
      setName(project.name);
      setSensors(sensors);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const results = useMemo(() => {
    if (!settings) return {};
    return computeProjectResults(rawData, sensors, {
      refTempF0: settings.ref_temp_f0,
      zValueF0: settings.z_value_f0,
      refTempFh: settings.ref_temp_fh,
      zValueFh: settings.z_value_fh,
      timeUnit: settings.time_unit,
    });
  }, [rawData, sensors, settings]);

  const correctedSeries = useMemo(() => {
    const out = {};
    for (const [sensorId, r] of Object.entries(results)) out[sensorId] = r.corrected;
    return out;
  }, [results]);

  // --- Autoguardado -------------------------------------------------------
  const snapshot = useMemo(
    () => ({ rawData, sensors, settings, name }),
    [rawData, sensors, settings, name]
  );

  const saveSnapshot = useCallback(
    async ({ rawData, sensors, settings, name }) => {
      if (!settings) return;
      await Promise.all([
        saveProjectFields(projectId, {
          name,
          raw_data: rawData,
          results_summary: summarizeResults(
            computeProjectResults(rawData, sensors, {
              refTempF0: settings.ref_temp_f0,
              zValueF0: settings.z_value_f0,
              refTempFh: settings.ref_temp_fh,
              zValueFh: settings.z_value_fh,
              timeUnit: settings.time_unit,
            })
          ),
          ref_temp_f0: settings.ref_temp_f0,
          z_value_f0: settings.z_value_f0,
          ref_temp_fh: settings.ref_temp_fh,
          z_value_fh: settings.z_value_fh,
          time_unit: settings.time_unit,
        }),
        ...sensors.map((s) =>
          saveSensorFields(s.id, {
            name: s.name,
            color: s.color,
            sort_order: s.sort_order,
            offset_celsius: s.offset_celsius,
            calibration_cert_number: s.calibration_cert_number,
            calibration_date: s.calibration_date || null,
            calibration_notes: s.calibration_notes,
            certificate_file_url: s.certificate_file_url,
          })
        ),
      ]);
    },
    [projectId]
  );

  const autosaveStatus = useDebouncedAutosave(snapshot, saveSnapshot);

  // --- Acciones sobre sensores (crear/borrar son inmediatas, no debounce) --
  async function handleAddSensor() {
    const sensor = await createSensor(projectId, {
      name: `Sensor ${sensors.length + 1}`,
      color: nextSensorColor(sensors.length),
      sortOrder: sensors.length,
    });
    setSensors((prev) => [...prev, sensor]);
    setRawData((prev) => ({
      ...prev,
      series: { ...prev.series, [sensor.id]: prev.time.map(() => null) },
    }));
  }

  async function handleRemoveSensor(id) {
    if (!confirm('Eliminar este sensor y sus datos?')) return;
    await deleteSensor(id);
    setSensors((prev) => prev.filter((s) => s.id !== id));
    setRawData((prev) => {
      const series = { ...prev.series };
      delete series[id];
      return { ...prev, series };
    });
  }

  function handleUpdateSensor(id, fields) {
    setSensors((prev) => prev.map((s) => (s.id === id ? { ...s, ...fields } : s)));
  }

  if (loading || !settings) {
    return (
      <div className="page">
        <p className="empty">Cargando proyecto…</p>
      </div>
    );
  }

  return (
    <>
      <header className="appbar">
        <Link href="/" className="brand">
          <span className="brand-mark">F0</span>
          <span className="brand-name">Letalidad térmica</span>
        </Link>
        <span className="appbar-divider" />
        <input
          className="input project-name-input"
          aria-label="Nombre del proyecto"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <span className="appbar-spacer" />
        <AutosaveBadge status={autosaveStatus} />
      </header>

      <div className="page">
        <div className="stack">
          <div className="group-label">Entrada de datos</div>

          <DataSheet
            time={rawData.time}
            series={rawData.series}
            sensors={sensors}
            onChange={setRawData}
          />

          <OffsetsPanel
            sensors={sensors}
            onUpdateSensor={handleUpdateSensor}
            onAddSensor={handleAddSensor}
            onRemoveSensor={handleRemoveSensor}
          />

          <SettingsPanel
            project={settings}
            onChange={(f) => setSettings((prev) => ({ ...prev, ...f }))}
          />

          <div className="group-label">Resultados</div>

          <ResultsSummary sensors={sensors} results={results} />

          <TemperatureChart
            time={rawData.time}
            correctedSeries={correctedSeries}
            sensors={sensors}
            timeUnit={settings.time_unit}
          />

          <LethalityChart
            time={rawData.time}
            results={results}
            sensors={sensors}
            timeUnit={settings.time_unit}
          />
        </div>
      </div>
    </>
  );
}
