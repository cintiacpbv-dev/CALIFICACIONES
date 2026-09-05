'use client';

const LABELS = {
  idle: 'Sin cambios',
  saving: 'Guardando…',
  saved: 'Guardado ✓',
  error: 'Error al guardar',
};

export default function AutosaveBadge({ status }) {
  return <span className={`autosave-badge autosave-${status}`}>{LABELS[status] ?? status}</span>;
}
