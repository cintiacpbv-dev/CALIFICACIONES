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
import StudySummary from './StudySummary';
import ConfirmDialog from './ConfirmDialog';
import AutosaveBadge from './AutosaveBadge';
import { SkeletonCard } from './Skeleton';
import { useToast } from './Toast';

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
 * corridas), el resumen comparativo del estudio y la lista de corridas
 * (cámara vacía, cargada, distintos setpoints…).
 */
export default function ProjectWorkspace({ projectId }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [project, setProject] = useState(null);
  const [probes, setProbes] = useState([]);
  const [runs, setRuns] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [equipmentCode, setEquipmentCode] = useState('');
  const [creatingRun, setCreatingRun] = useState(false);
  const [pending, setPending] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { project, probes, runs } = await getProjectOverview(projectId);
      setProject(project);
      setProbes(probes);
      setRuns(runs);
      setName(project.name);
      setDescription(project.description ?? '');
      setEquipmentCode(project.equipment_code ?? '');
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    try {
      const probe = await createProbe(projectId, {
        code: `C${String(probes.length + 1).padStart(2, '0')}`,
        color: nextProbeColor(probes.length),
        sortOrder: probes.length,
      });
      setProbes((prev) => [...prev, probe]);
    } catch (err) {
      toast.error('No se pudo agregar la termocupla', err.message);
    }
  }

  function handleUpdateProbe(id, fields) {
    setProbes((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p)));
  }

  async function handleCreateRun() {
    setCreatingRun(true);
    try {
      const run = await createRun(projectId, {
        name: `Corrida ${runs.length + 1}`,
        sortOrder: runs.length,
      });
      router.push(`/proyecto/${projectId}/corrida/${run.id}`);
    } catch (err) {
      toast.error('No se pudo crear la corrida', err.message);
      setCreatingRun(false);
    }
  }

  async function confirmPending() {
    const target = pending;
    setPending(null);
    if (!target) return;
    try {
      if (target.kind === 'probe') {
        await deleteProbe(target.id);
        setProbes((prev) => prev.filter((p) => p.id !== target.id));
        toast.success(`Termocupla ${target.label} eliminada`);
      } else {
        await deleteRun(target.id);
        setRuns((prev) => prev.filter((r) => r.id !== target.id));
        toast.success(`Corrida "${target.label}" eliminada`);
      }
    } catch (err) {
      toast.error('No se pudo eliminar', err.message);
    }
  }

  if (loading) {
    return (
      <>
        <header className="appbar">
          <span className="brand">
            <span className="brand-mark">F0</span>
            <span className="brand-name">Letalidad térmica</span>
          </span>
        </header>
        <div className="page">
          <div className="stack">
            <SkeletonCard lines={3} />
            <SkeletonCard lines={5} />
          </div>
        </div>
      </>
    );
  }

  if (loadError || !project) {
    return (
      <div className="page">
        <div className="notice notice-error">
          <div>
            <strong>No se pudo abrir el proyecto.</strong> {loadError}
          </div>
        </div>
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
        <span className="appbar-context">{project.name}</span>
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

          <StudySummary projectId={projectId} runs={runs} probes={probes} />

          <CalibrationPanel
            probes={probes}
            onUpdateProbe={handleUpdateProbe}
            onAddProbe={handleAddProbe}
            onRemoveProbe={(id) => {
              const probe = probes.find((p) => p.id === id);
              setPending({ kind: 'probe', id, label: probe?.code ?? '' });
            }}
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
                    const verdict = r.acceptance_summary?.verdict ?? 'unset';
                    return (
                      <li className="run-row" key={r.id}>
                        <Link href={`/proyecto/${projectId}/corrida/${r.id}`} className="run-link">
                          <div className="run-name">
                            {r.name}
                            {verdict !== 'unset' && (
                              <span className={`pill pill-${verdict}`}>
                                {verdict === 'pass' ? 'Cumple' : 'No cumple'}
                              </span>
                            )}
                          </div>
                          <div className="run-meta">
                            <span>Ref. F0: {r.ref_temp_f0}°C</span>
                            {r.load_description && <span>{r.load_description}</span>}
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
                          onClick={() => setPending({ kind: 'run', id: r.id, label: r.name })}
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

      <ConfirmDialog
        open={pending != null}
        title={pending?.kind === 'probe' ? 'Eliminar termocupla' : 'Eliminar corrida'}
        message={
          pending?.kind === 'probe' ? (
            <>
              Se elimina <strong>{pending?.label}</strong> del equipo. Sus lecturas quedan huérfanas
              en las corridas que ya la usaban y dejan de calcularse.
            </>
          ) : (
            <>
              Se elimina <strong>{pending?.label}</strong> con toda su hoja de datos, sus parámetros
              y sus resultados. No se puede deshacer.
            </>
          )
        }
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
