'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createProject, deleteProject, listProjects } from '@/lib/projectsApi';
import { supabase } from '@/lib/supabaseClient';

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
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setProjects(await listProjects());
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
      alert('No se pudo crear el proyecto: ' + err.message);
      setCreating(false);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Eliminar "${name}" definitivamente? Esta acción no se puede deshacer.`)) return;
    await deleteProject(id);
    refresh();
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
        <p className="empty">Cargando…</p>
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
                onClick={() => handleDelete(p.id, p.name)}
                aria-label={`Eliminar ${p.name}`}
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
