'use client';

const LABELS = {
  idle: 'Sin cambios',
  saving: 'Guardando…',
  saved: 'Guardado',
  error: 'Error al guardar',
};

const CLASSES = {
  saving: 'badge badge-saving',
  saved: 'badge badge-saved',
  error: 'badge badge-error',
};

export default function AutosaveBadge({ status }) {
  return (
    <span className={CLASSES[status] ?? 'badge'} role="status">
      {LABELS[status] ?? status}
    </span>
  );
}
