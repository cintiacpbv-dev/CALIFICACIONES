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
 * Gráfico 1: curvas de temperatura corregida (°C) vs. tiempo, todos los
 * sensores superpuestos.
 *
 * @param {{
 *   time: number[],
 *   correctedSeries: Record<string, (number|null)[]>,
 *   sensors: {id:string, name:string, color:string}[],
 *   timeUnit: 'min'|'s',
 * }} props
 */
export default function TemperatureChart({ time, correctedSeries, sensors, timeUnit }) {
  const data = time.map((t, i) => {
    const point = { time: t };
    for (const s of sensors) point[s.id] = correctedSeries[s.id]?.[i] ?? null;
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" label={{ value: `Tiempo (${timeUnit})`, position: 'insideBottom', offset: -4 }} />
        <YAxis label={{ value: 'Temperatura (°C)', angle: -90, position: 'insideLeft' }} />
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
