'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

/**
 * Notificaciones no bloqueantes. Reemplazan a `alert()`, que congela la
 * pestaña y, sobre todo, se pierde el contexto: acá el mensaje aparece al
 * lado del trabajo y se puede seguir usando la hoja mientras se lee.
 *
 * Un toast con `action` permite deshacer la operación que lo disparó (ver
 * el "Deshacer" del import/pegado en DataSheet).
 */

const ToastContext = createContext(null);

const DEFAULT_MS = { error: 8000, success: 3500, info: 5000 };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    ({ level = 'info', title, detail, action, duration }) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, level, title, detail, action }]);
      const ms = duration ?? DEFAULT_MS[level] ?? DEFAULT_MS.info;
      // duration: null mantiene el toast hasta que se cierre a mano.
      if (ms) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), ms)
        );
      }
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      push,
      dismiss,
      success: (title, detail) => push({ level: 'success', title, detail }),
      error: (title, detail) => push({ level: 'error', title, detail }),
      info: (title, detail) => push({ level: 'info', title, detail }),
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="region" aria-label="Notificaciones">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.level}`} role="status">
            <div className="toast-text">
              <strong>{t.title}</strong>
              {t.detail && <span>{t.detail}</span>}
            </div>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  t.action.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(t.id)}
              aria-label="Cerrar notificación"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Hook de notificaciones. Fuera del provider devuelve una API que no hace
 * nada en vez de romper: ningún componente debería fallar por no poder
 * avisar algo.
 */
export function useToast() {
  return (
    useContext(ToastContext) ?? {
      push: () => {},
      dismiss: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    }
  );
}
