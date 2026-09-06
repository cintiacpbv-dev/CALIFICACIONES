'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createProbe,
  createRun,
  deleteProbe,
  deleteRun,
  getProjectOverview,
  saveProbeFields,
  saveProjectFields,
} from '@/lib/projectsApi';
import { useDebouncedAutosave } from '@/lib/useDebouncedAutosave';
import CalibrationPanel, { nextProbeColor } from './CalibrationPanel';
import AutosaveBadge from './AutosaveBadge';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** F0 más bajo (trapecio) entre los sensores de una corrida. */
function minF0(resultsSummary) {
  const values = Object.values(resultsSummary ?? {})
    .map((r) => r?.f0Trap)
    .filter((v) => typeof v === 'number' && v > 0);
  return values.length ? Math.min(...values) : null;
}

/**
 * Vista de un proyecto = un equipo en calificación: datos del equipo,
 * termocuplas con su calibración (CalibrationPanel — se aplica a todas las
 * corridas), y la lista de corridas del estudio (cámara vacía, cargada,
 * distintos setpoints…).
 */
export default function ProjectWorkspace({ projectId }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [probes, setProbes] = useState([]);
  const [runs, setRuns] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [equipmentCode, setEquipmentCode] = useState('');
  const [creatingRun, setCreatingRun] = useState(false);

  async function refresh() {
    const { project, probes, runs } = await getProjectOverview(projectId);
    setProject(project);
    setProbes(probes);
    setRuns(runs);
    setName(project.name);
    setDescription(project.description ?? '');
    setEquipmentCode(project.equipment_code ?? '');
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // --- Autoguardado de datos del proyecto + probes -------------------------
  const snapshot = useMemo(
    () => ({ name, description, equipmentCode, probes }),
    [name, description, equipmentCode, probes]
  );

  const saveSnapshot = useCallback(
    async ({ name, description, equipmentCode, probes }) => {
      await Promise.all([
        saveProjectFields(projectId, { name, description, equipment_code: equipmentCode }),
        ...probes.map((p) =>
          saveProbeFields(p.id, {
            code: p.code,
            color: p.color,
            sort_order: p.sort_order,
            calibration_points: p.calibration_points,
            calibration_cert_number: p.calibration_cert_number,
            calibration_date: p.calibration_date || null,
            certificate_file_url: p.certificate_file_url,
          })
        ),
      ]);
    },
    [projectId]
  );

  const autosaveStatus = useDebouncedAutosave(snapshot, saveSnapshot);

  async function handleAddProbe() {
    const probe = await createProbe(projectId, {
      code: `C${String(probes.length + 1).padStart(2, '0')}`,
      color: nextProbeColor(probes.length),
      sortOrder: probes.length,
    });
    setProbes((prev) => [...prev, probe]);
  }

  async function handleRemoveProbe(id) {
    if (!confirm('Eliminar esta termocupla? Sus lecturas en las corridas quedan huérfanas.')) return;
    await deleteProbe(id);
    setProbes((prev) => prev.filter((p) => p.id !== id));
  }

  function handleUpdateProbe(id, fields) {
    setProbes((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p)));
  }

  async function handleCreateRun() {
    setCreatingRun(true);
    try {
      const run = await createRun(projectId, { name: `Corrida ${runs.length + 1}`, sortOrder: runs.length });
      router.push(`/proyecto/${projectId}/corrida/${run.id}`);
    } catch (err) {
      alert('No se pudo crear la corrida: ' + err.message);
      setCreatingRun(false);
    }
  }

  async function handleDeleteRun(id, runName) {
    if (!confirm(`Eliminar la corrida "${runName}"? Esta acción no se puede deshacer.`)) return;
    await deleteRun(id);
    setRuns((prev) => prev.filter((r) => r.id !== id));
  }

  if (loading || !project) {
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
        <span className="appbar-spacer" />
        <AutosaveBadge status={autosaveStatus} />
      </header>

      <div className="page">
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Equipo</h2>
            </div>
            <div className="card-body">
              <div className="project-meta-row">
                <label className="field" style={{ flex: 2, minWidth: 220 }}>
                  <span className="field-label">Nombre del proyecto</span>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="field" style={{ flex: 1, minWidth: 160 }}>
                  <span className="field-label">Código de equipo</span>
                  <input
                    type="text"
                    value={equipmentCode}
                    onChange={(e) => setEquipmentCode(e.target.value)}
                    placeholder="ej. CCAV0401"
                  />
                </label>
              </div>
              <label className="field">
                <span className="field-label">Descripción</span>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ej. Autoclave vertical de 50 L"
                />
              </label>
            </div>
          </section>

          <CalibrationPanel
            probes={probes}
            onUpdateProbe={handleUpdateProbe}
            onAddProbe={handleAddProbe}
            onRemoveProbe={handleRemoveProbe}
          />

          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Corridas</h2>
              <span className="card-hint">Cámara vacía, cargada, distintos setpoints…</span>
              <div className="card-actions">
                <button className="btn btn-primary" onClick={handleCreateRun} disabled={creatingRun}>
                  + Corrida
                </button>
              </div>
            </div>
            <div className="card-body">
              {runs.length === 0 ? (
                <p className="empty">
                  <strong>Todavía no hay corridas</strong>
                  Cada corrida es una hoja de datos completa: cámara vacía, cargada, un setpoint
                  distinto…
                </p>
              ) : (
                <ul className="run-list">
                  {runs.map((r) => {
                    const f0 = minF0(r.results_summary);
                    return (
                      <li className="run-row" key={r.id}>
                        <Link href={`/proyecto/${projectId}/corrida/${r.id}`} className="run-link">
                          <div className="run-name">{r.name}</div>
                          <div className="run-meta">
                            <span>Ref. F0: {r.ref_temp_f0}°C</span>
                            <span>Actualizado {formatDate(r.updated_at)}</span>
                          </div>
                        </Link>
                        {f0 !== null && (
                          <span className="project-stat">
                            F0 mín <b>{f0.toFixed(2)}</b> min
                          </span>
                        )}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteRun(r.id, r.name)}
                          aria-label={`Eliminar ${r.name}`}
                        >
                          Eliminar
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
