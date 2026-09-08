'use client';

/**
 * Avisos de integridad de datos. Existe porque el motor de letalidad es
 * tolerante a propósito (un Δt no positivo o una celda vacía se saltean en
 * vez de romper), y esa tolerancia hace que un dato mal pegado baje el
 * F0 sin que nadie se entere. Acá se hace explícito.
 *
 * Si no hay nada que reportar, el componente no renderiza nada: un panel
 * verde de "todo bien" permanente termina siendo ruido que se deja de leer.
 *
 * @param {{ issues: {id:string, level:'error'|'warning', title:string, detail:string}[] }} props
 */
export default function DataQualityPanel({ issues }) {
  if (!issues?.length) return null;

  const errors = issues.filter((i) => i.level === 'error').length;

  return (
    <section className={`card quality-card${errors ? ' has-errors' : ''}`}>
      <div className="card-head">
        <h2 className="card-title">Revisar los datos</h2>
        <span className="card-hint">
          {errors
            ? `${errors} problema(s) que alteran el resultado`
            : 'El cálculo es válido, pero hay datos parciales'}
        </span>
      </div>
      <div className="card-body">
        <ul className="issue-list">
          {issues.map((issue) => (
            <li key={issue.id} className={`issue issue-${issue.level}`}>
              <span className="issue-dot" aria-hidden="true" />
              <div>
                <strong>{issue.title}</strong>
                <span>{issue.detail}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
