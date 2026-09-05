'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Gráfico 2: curva de letalidad acumulada (F0 y/o FH) en el tiempo, por
 * sensor.
 *
 * @param {{
 *   time: number[],
 *   results: Record<string, {f0Cumulative:number[], fhCumulative:number[]}>,
 *   sensors: {id:string, name:string, color:string}[],
 *   metric: 'f0' | 'fh',
 *   timeUnit: 'min'|'s',
 * }} props
 */
export default function LethalityChart({ time, results, sensors, metric, timeUnit }) {
  const key = metric === 'fh' ? 'fhCumulative' : 'f0Cumulative';
  const label = metric === 'fh' ? 'FH acumulado' : 'F0 acumulado';

  const data = time.map((t, i) => {
    const point = { time: t };
    for (const s of sensors) point[s.id] = results[s.id]?.[key]?.[i] ?? null;
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" label={{ value: `Tiempo (${timeUnit})`, position: 'insideBottom', offset: -4 }} />
        <YAxis label={{ value: `${label} (min)`, angle: -90, position: 'insideLeft' }} />
        <Tooltip />
        <Legend />
        {sensors.map((s) => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.name}
            stroke={s.color}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
