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
        <CartesianGrid stroke="#e1e0d9" vertical={false} />
        <XAxis
          dataKey="time"
          stroke="#c3c2b7"
          tick={{ fill: '#898781', fontSize: 12 }}
          label={{ value: `Tiempo (${timeUnit})`, position: 'insideBottom', offset: -4, fill: '#898781' }}
        />
        <YAxis
          stroke="#c3c2b7"
          tick={{ fill: '#898781', fontSize: 12 }}
          label={{ value: `${label} (min)`, angle: -90, position: 'insideLeft', fill: '#898781' }}
        />
        <Tooltip contentStyle={{ border: '1px solid rgba(11,11,11,0.1)', borderRadius: 8, fontSize: 13 }} />
        <Legend wrapperStyle={{ fontSize: 13, color: '#52514e' }} />
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
