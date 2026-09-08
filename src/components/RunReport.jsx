'use client';

import { formatDate } from '@/lib/reportData';

/**
 * Encabezado y pie del informe imprimible. En pantalla no se ve: existe
 * sólo para la impresión / "Guardar como PDF", donde la barra de la app,
 * los botones y la hoja de datos se ocultan (ver @media print en
 * globals.css) y queda una página de informe con encabezado, gráficos,
 * resultados y criterios.
 *
 * Se imprime desde el navegador en vez de generar el PDF en JS a propósito:
 * los gráficos son SVG y el motor de impresión los rasteriza a la
 * resolución del papel, mientras que una captura a canvas los pixela.
 *
 * @param {{ report: object, project: object, run: object }} props
 */
export default function RunReport({ report, project, run }) {
  const verdict = report.acceptance.verdict;

  return (
    <>
      <header className="print-only report-head">
        <div className="report-title-row">
          <div>
            <h1>Informe de letalidad térmica — F0 / FH</h1>
            <p>
              {project?.name}
              {project?.equipment_code ? ` · ${project.equipment_code}` : ''} — {run?.name}
            </p>
          </div>
          {report.acceptance.defined && (
            <span className={`verdict verdict-${verdict}`}>
              {verdict === 'pass' ? 'CUMPLE' : verdict === 'fail' ? 'NO CUMPLE' : 'SIN CRITERIO'}
            </span>
          )}
        </div>

        <dl className="report-meta">
          {report.header.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section className="print-only report-params">
        <h2>Parámetros de cálculo</h2>
        <dl className="report-meta">
          {report.params.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{String(value ?? '—')}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="print-only report-calibration">
        <h2>Calibración aplicada</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Sensor</th>
              <th scope="col">Puntos EQUI → TCV (°C)</th>
              <th scope="col">Recta aplicada</th>
              <th scope="col">Certificado</th>
            </tr>
          </thead>
          <tbody>
            {report.calibration.map((c) => (
              <tr key={c.code}>
                <td>{c.code}</td>
                <td>{c.points}</td>
                <td>{c.equation}</td>
                <td>
                  {c.certNumber}
                  {c.certDate !== '—' ? ` · ${c.certDate}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {run?.notes && (
        <section className="print-only report-notes">
          <h2>Observaciones</h2>
          <p>{run.notes}</p>
        </section>
      )}
    </>
  );
}

/**
 * Pie del informe. Va en un componente aparte porque tiene que quedar
 * DESPUÉS de los resultados y los gráficos: dentro del encabezado terminaba
 * impreso en la mitad de la página.
 */
export function RunReportFooter() {
  return (
    <footer className="print-only report-foot">
      Generado el {formatDate(new Date())} · Cálculo por integración de L(t) = 10^((T − Tref)/z)
      sobre la ventana declarada en el encabezado. Herramienta de cálculo sin control de cambios ni
      firma electrónica: la verificación del dato de origen es responsabilidad del usuario.
    </footer>
  );
}
