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
  const label = metric === 'fh' ? 'FH' : 'F0';

  const data = time.map((t, i) => {
    const point = { time: t };
    for (const s of sensors) point[s.id] = results[s.id]?.[key]?.[i] ?? null;
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 20, right: 16, bottom: 8, left: 12 }}>
        <CartesianGrid stroke="#dee6e1" vertical={false} />
        <XAxis
          dataKey="time"
          stroke="#b9c6bd"
          tick={{ fill: '#7c8b82', fontSize: 12 }}
          label={{ value: `Tiempo (${timeUnit})`, position: 'insideBottom', offset: -4, fill: '#7c8b82' }}
        />
        <YAxis
          stroke="#b9c6bd"
          tick={{ fill: '#7c8b82', fontSize: 12 }}
          label={{ value: `${label} (min)`, angle: -90, position: 'insideLeft', fill: '#7c8b82' }}
        />
        <Tooltip contentStyle={{ border: '1px solid rgba(13,31,22,0.1)', borderRadius: 8, fontSize: 13 }} />
        <Legend wrapperStyle={{ fontSize: 13, color: '#4a5951' }} />
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
