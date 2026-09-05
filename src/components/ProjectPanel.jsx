'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createProject, deleteProject, listProjects } from '@/lib/projectsApi';
import { supabase } from '@/lib/supabaseClient';

/** Panel central: lista todos los proyectos guardados en Supabase. */
export default function ProjectPanel() {
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
      window.location.href = `/proyecto/${project.id}`;
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
      <div className="warning-box">
        Supabase no está configurado. Definí <code>NEXT_PUBLIC_SUPABASE_URL</code> y{' '}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> para guardar proyectos.
      </div>
    );
  }

  return (
    <div className="project-panel">
      <div className="project-panel-header">
        <h2>Proyectos guardados</h2>
        <button className="primary" onClick={handleCreate} disabled={creating}>
          + Nuevo proyecto
        </button>
      </div>

      {loading ? (
        <p>Cargando…</p>
      ) : projects.length === 0 ? (
        <p className="muted">Todavía no hay proyectos. Creá el primero.</p>
      ) : (
        <ul className="project-list">
          {projects.map((p) => (
            <li key={p.id} className="project-list-item">
              <Link href={`/proyecto/${p.id}`} className="project-list-link">
                <strong>{p.name}</strong>
                <span className="muted">
                  {' '}
                  · actualizado {new Date(p.updated_at).toLocaleString()}
                </span>
              </Link>
              <button className="danger" onClick={() => handleDelete(p.id, p.name)}>
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
