'use client';

import { useEffect, useRef } from 'react';

/**
 * Diálogo de confirmación para acciones destructivas. Reemplaza a
 * `confirm()`, que además de romper el estilo de la app no deja explicar
 * QUÉ se pierde exactamente — y acá borrar una corrida se lleva su hoja de
 * datos entera.
 *
 * @param {{
 *   open: boolean,
 *   title: string,
 *   message: React.ReactNode,
 *   confirmLabel?: string,
 *   onConfirm: () => void,
 *   onCancel: () => void,
 * }} props
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Eliminar',
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    // El foco arranca en Cancelar (no en el botón destructivo): un Enter
    // reflejo no debería borrar nada.
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal modal-sm"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-head">
          <h2 className="card-title">{title}</h2>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" ref={confirmRef} onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
