'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Autoguardado continuo: llama a `saveFn(value)` `delay` ms después del
 * último cambio de `value`. Expone un estado ('idle' | 'saving' | 'saved' |
 * 'error') para mostrar un indicador en la UI, y no dispara guardado en el
 * primer render (sólo ante cambios reales, para no escribir en Supabase al
 * simplemente abrir un proyecto ya guardado).
 *
 * @param {any} value
 * @param {(value: any) => Promise<void>} saveFn
 * @param {number} delay
 */
export function useDebouncedAutosave(value, saveFn, delay = 800) {
  const [status, setStatus] = useState('idle');
  const timerRef = useRef(null);
  const isFirstRun = useRef(true);
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    setStatus('saving');
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        await saveFnRef.current(value);
        setStatus('saved');
      } catch (err) {
        console.error('Autoguardado falló:', err);
        setStatus('error');
      }
    }, delay);

    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);

  return status;
}
