'use client';

/**
 * Tabla final de F0 / FH por sensor.
 * @param {{
 *   sensors: {id:string, name:string, color:string}[],
 *   results: Record<string, {f0:number, fh:number}>,
 * }} props
 */
export default function ResultsSummary({ sensors, results }) {
  return (
    <table className="results-table">
      <thead>
        <tr>
          <th>Sensor</th>
          <th>F0 (min)</th>
          <th>FH (min)</th>
        </tr>
      </thead>
      <tbody>
        {sensors.map((s) => (
          <tr key={s.id}>
            <td style={{ borderLeft: `4px solid ${s.color}` }}>{s.name}</td>
            <td>{results[s.id]?.f0?.toFixed(2) ?? '—'}</td>
            <td>{results[s.id]?.fh?.toFixed(2) ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
