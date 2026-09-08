'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getRun, saveRunFields } from '@/lib/projectsApi';
import { computeRunResults, summarizeResults } from '@/lib/lethality';
import { buildReport } from '@/lib/reportData';
import { checkDataQuality, uncalibratedProbeIds } from '@/lib/dataQuality';
import { useDebouncedAutosave } from '@/lib/useDebouncedAutosave';
import DataSheet from './DataSheet';
import SettingsPanel from './SettingsPanel';
import AcceptancePanel from './AcceptancePanel';
import RunMetaPanel from './RunMetaPanel';
import DataQualityPanel from './DataQualityPanel';
import TemperatureChart from './TemperatureChart';
import LethalityChart from './LethalityChart';
import ResultsSummary from './ResultsSummary';
import RunReport, { RunReportFooter } from './RunReport';
import AutosaveBadge from './AutosaveBadge';
import { RunSkeleton } from './Skeleton';
import { useToast } from './Toast';

// Campos escalares de la corrida que se editan en pantalla y se
// autoguardan. Se manejan como un único objeto `fields` (en vez de un
// useState por campo) porque el autoguardado y el informe los necesitan
// todos juntos, y agregar un campo nuevo no debería tocar cinco lugares.
const RUN_FIELDS = [
  'name',
  'ref_temp_f0',
  'z_value_f0',
  'ref_temp_fh',
  'z_value_fh',
  'time_unit',
  'f0_min_required',
  'fh_min_required',
  'temp_low_limit',
  'temp_high_limit',
  'run_date',
  'batch_code',
  'cycle_code',
  'load_description',
  'operator',
  'notes',
];

function pickRunFields(run) {
  const out = {};
  for (const key of RUN_FIELDS) out[key] = run[key] ?? null;
  return out;
}

/**
 * Workspace de una corrida: hoja de datos, ventana de conteo, parámetros
 * F0/FH propios de esta corrida (el mismo equipo puede correr a 115°C en
 * una corrida y 121°C en otra), criterios de aceptación, condición de
 * trabajo, gráficos, resultados y exportación del informe.
 *
 * La calibración de los sensores NO vive acá — es del equipo (ver
 * CalibrationPanel en la página del proyecto) y se aplica tal cual esté
 * definida al momento de calcular.
 *
 * Flujo de datos: rawData + fields + startIndex/endIndex son la única
 * fuente de verdad en memoria. `results`, `report` y los avisos de calidad
 * son 100% derivados (useMemo). El autoguardado persiste todo en `runs` con
 * debounce compartido.
 */
export default function RunWorkspace({ runId }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [project, setProject] = useState(null);
  const [probes, setProbes] = useState([]);
  const [rawData, setRawData] = useState({ time: [], series: {} });
  const [fields, setFields] = useState(null);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRun(runId)
      .then(({ run, probes, project }) => {
        if (cancelled) return;
        setProject(project);
        setRawData(run.raw_data ?? { time: [], series: {} });
        setFields(pickRunFields(run));
        setStartIndex(run.start_index ?? 0);
        setEndIndex(run.end_index ?? null);
        // Todas las corridas de un proyecto usan las mismas termocuplas —
        // ver nota en supabase/schema.sql.
        setProbes(probes);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const updateFields = useCallback((patch) => setFields((prev) => ({ ...prev, ...patch })), []);

  const sensors = useMemo(
    () => probes.map((p) => ({ id: p.id, name: p.code, color: p.color })),
    [probes]
  );

  const results = useMemo(() => {
    if (!fields) return {};
    return computeRunResults(rawData, probes, {
      refTempF0: fields.ref_temp_f0,
      zValueF0: fields.z_value_f0,
      refTempFh: fields.ref_temp_fh,
      zValueFh: fields.z_value_fh,
      timeUnit: fields.time_unit,
      startIndex,
      endIndex,
    });
  }, [rawData, probes, fields, startIndex, endIndex]);

  const report = useMemo(() => {
    if (!fields) return null;
    return buildReport({
      project,
      run: fields,
      probes,
      sensors,
      results,
      rawData,
      startIndex,
      endIndex,
    });
  }, [project, fields, probes, sensors, results, rawData, startIndex, endIndex]);

  const issues = useMemo(
    () => checkDataQuality({ rawData, probes, startIndex, endIndex }),
    [rawData, probes, startIndex, endIndex]
  );

  const uncalibrated = useMemo(() => uncalibratedProbeIds(probes), [probes]);

  const correctedSeries = useMemo(() => {
    const out = {};
    for (const [probeId, r] of Object.entries(results)) out[probeId] = r.corrected;
    return out;
  }, [results]);

  const startTime = rawData.time?.[startIndex] ?? null;
  const endTime = endIndex == null ? null : (rawData.time?.[endIndex] ?? null);

  // --- Autoguardado -------------------------------------------------------
  const snapshot = useMemo(
    () => ({ rawData, probes, fields, startIndex, endIndex }),
    [rawData, probes, fields, startIndex, endIndex]
  );

  const saveSnapshot = useCallback(
    async ({ rawData, probes, fields, startIndex, endIndex }) => {
      if (!fields) return;
      const computed = computeRunResults(rawData, probes, {
        refTempF0: fields.ref_temp_f0,
        zValueF0: fields.z_value_f0,
        refTempFh: fields.ref_temp_fh,
        zValueFh: fields.z_value_fh,
        timeUnit: fields.time_unit,
        startIndex,
        endIndex,
      });
      const snapshotReport = buildReport({
        project: null,
        run: fields,
        probes,
        sensors: probes.map((p) => ({ id: p.id, name: p.code, color: p.color })),
        results: computed,
        rawData,
        startIndex,
        endIndex,
      });
      await saveRunFields(runId, {
        ...fields,
        raw_data: rawData,
        start_index: startIndex,
        end_index: endIndex,
        results_summary: summarizeResults(computed),
        // Cache para que el resumen del estudio muestre cumple/no cumple sin
        // tener que traer la data cruda de cada corrida.
        acceptance_summary: {
          verdict: snapshotReport.acceptance.verdict,
          checks: snapshotReport.acceptance.checks,
        },
      });
    },
    [runId]
  );

  const autosaveStatus = useDebouncedAutosave(snapshot, saveSnapshot);

  async function handleExportExcel() {
    // El módulo de exportación arrastra SheetJS: se carga recién al pedir el
    // informe para no sumarle ~250 kB al bundle inicial de la corrida.
    setExporting(true);
    try {
      const { exportRunToExcel } = await import('@/lib/exportExcel');
      exportRunToExcel({ project, run: fields, probes, sensors, results, rawData, startIndex, endIndex });
      toast.success('Informe Excel generado', 'Incluye data cruda, corregida, calibración y ambos métodos.');
    } catch (err) {
      toast.error('No se pudo generar el Excel', err.message);
    } finally {
      setExporting(false);
    }
  }

  function handlePrint() {
    // El PDF lo genera el navegador ("Guardar como PDF" en el diálogo de
    // impresión): los gráficos son SVG y así salen vectoriales, en vez de
    // pixelados como quedarían si se rasterizaran a canvas.
    window.print();
  }

  if (loading) return <RunSkeleton />;

  if (loadError || !fields) {
    return (
      <div className="page">
        <div className="notice notice-error">
          <div>
            <strong>No se pudo abrir la corrida.</strong> {loadError}
          </div>
        </div>
      </div>
    );
  }

  const hasResults = report && report.rows.some((r) => r.f0Trap > 0 || r.fhTrap > 0);

  return (
    <>
      <header className="appbar no-print">
        <Link href={project?.id ? `/proyecto/${project.id}` : '/'} className="brand">
          <span className="brand-mark">F0</span>
          <span className="brand-name">Letalidad térmica</span>
        </Link>
        <span className="appbar-divider" />
        <input
          className="input project-name-input"
          aria-label="Nombre de la corrida"
          value={fields.name ?? ''}
          onChange={(e) => updateFields({ name: e.target.value })}
        />
        <span className="appbar-spacer" />
        <div className="appbar-actions">
          <button className="btn btn-sm" onClick={handleExportExcel} disabled={!hasResults || exporting}>
            {exporting ? 'Generando…' : 'Exportar Excel'}
          </button>
          <button className="btn btn-sm" onClick={handlePrint} disabled={!hasResults}>
            Informe PDF
          </button>
        </div>
        <AutosaveBadge status={autosaveStatus} />
      </header>

      <div className="page">
        <RunReport report={report} project={project} run={fields} />

        <div className="stack">
          <div className="group-label no-print">Entrada de datos</div>

          {probes.length === 0 ? (
            <div className="card no-print">
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

          <DataQualityPanel issues={issues} />

          <div className="no-print">
            <RunMetaPanel run={fields} onChange={updateFields} />
          </div>
          <div className="no-print">
            <SettingsPanel run={fields} onChange={updateFields} />
          </div>
          <div className="no-print">
            <AcceptancePanel run={fields} onChange={updateFields} />
          </div>

          <div className="group-label no-print">Resultados</div>

          <ResultsSummary report={report} uncalibrated={uncalibrated} />

          <TemperatureChart
            time={rawData.time}
            correctedSeries={correctedSeries}
            sensors={sensors}
            timeUnit={fields.time_unit}
            startTime={startIndex > 0 ? startTime : null}
            endTime={endTime}
            tempLowLimit={fields.temp_low_limit}
            tempHighLimit={fields.temp_high_limit}
          />

          <LethalityChart
            time={rawData.time}
            results={results}
            sensors={sensors}
            timeUnit={fields.time_unit}
            startTime={startIndex > 0 ? startTime : null}
            endTime={endTime}
            f0MinRequired={fields.f0_min_required}
            fhMinRequired={fields.fh_min_required}
          />

          <RunReportFooter />
        </div>
      </div>
    </>
  );
}
