'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createProject, deleteProject, listProjects } from '@/lib/projectsApi';
import { supabase } from '@/lib/supabaseClient';
import ConfirmDialog from './ConfirmDialog';
import { ListSkeleton } from './Skeleton';
import { useToast } from './Toast';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Panel central: lista todos los proyectos (equipos) guardados en Supabase. */
export default function ProjectPanel() {
  const router = useRouter();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(null);

  async function refresh() {
    setLoading(true);
    try {
      setProjects(await listProjects());
    } catch (err) {
      toast.error('No se pudo cargar la lista de proyectos', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const project = await createProject();
      router.push(`/proyecto/${project.id}`);
    } catch (err) {
      toast.error('No se pudo crear el proyecto', err.message);
      setCreating(false);
    }
  }

  async function confirmDelete() {
    const target = pending;
    setPending(null);
    if (!target) return;
    try {
      await deleteProject(target.id);
      toast.success(`Proyecto "${target.name}" eliminado`);
      refresh();
    } catch (err) {
      toast.error('No se pudo eliminar el proyecto', err.message);
    }
  }

  if (!supabase) {
    return (
      <div className="notice">
        <div>
          <strong>Supabase no está configurado.</strong> Definí{' '}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> y{' '}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> para guardar proyectos.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">Proyectos</h1>
          <p className="page-sub">Equipos en calificación — cada uno agrupa sus corridas</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
          + Nuevo proyecto
        </button>
      </div>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : projects.length === 0 ? (
        <div className="card">
          <p className="empty">
            <strong>Todavía no hay proyectos</strong>
            Creá el primero para cargar termocuplas, corridas y calcular F0 / FH.
          </p>
        </div>
      ) : (
        <ul className="project-list">
          {projects.map((p) => (
            <li className="project-row" key={p.id}>
              <Link href={`/proyecto/${p.id}`} className="project-link">
                <div className="project-name">{p.name}</div>
                <div className="project-meta">
                  <span>Actualizado {formatDate(p.updated_at)}</span>
                  {p.equipment_code && <span>{p.equipment_code}</span>}
                  {p.description && <span>{p.description}</span>}
                </div>
              </Link>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setPending({ id: p.id, name: p.name })}
                aria-label={`Eliminar ${p.name}`}
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pending != null}
        title="Eliminar proyecto"
        message={
          <>
            Se elimina <strong>{pending?.name}</strong> con todas sus termocuplas, sus corridas y
            las hojas de datos de cada una. No se puede deshacer.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
