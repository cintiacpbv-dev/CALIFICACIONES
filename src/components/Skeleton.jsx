'use client';

/**
 * Placeholders de carga. Reemplazan al texto "Cargando…", que hacía saltar
 * el layout entero cuando llegaban los datos: el esqueleto ocupa
 * aproximadamente el mismo espacio que el contenido real, así que la página
 * no se reacomoda debajo del cursor.
 */

export function SkeletonLine({ width = '100%', height = 14 }) {
  return <span className="skeleton" style={{ width, height }} aria-hidden="true" />;
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card skeleton-card">
      <div className="card-head">
        <SkeletonLine width="180px" height={18} />
      </div>
      <div className="card-body">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine key={i} width={`${100 - i * 12}%`} />
        ))}
      </div>
    </div>
  );
}

export function RunSkeleton() {
  return (
    <>
      <header className="appbar">
        <span className="brand">
          <span className="brand-mark">F0</span>
          <span className="brand-name">Letalidad térmica</span>
        </span>
        <span className="appbar-divider" />
        <SkeletonLine width="220px" height={18} />
      </header>
      <div className="page" aria-busy="true" aria-label="Cargando corrida">
        <div className="stack">
          <SkeletonCard lines={6} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    </>
  );
}

export function ListSkeleton({ rows = 3 }) {
  return (
    <ul className="project-list" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <li className="project-row skeleton-row" key={i}>
          <div style={{ flex: 1, display: 'grid', gap: 8 }}>
            <SkeletonLine width="45%" height={16} />
            <SkeletonLine width="70%" height={12} />
          </div>
        </li>
      ))}
    </ul>
  );
}
