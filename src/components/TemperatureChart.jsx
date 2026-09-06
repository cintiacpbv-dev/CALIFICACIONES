'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartTooltip from './ChartTooltip';

const AXIS = '#8d9a94';
const GRID = '#eaeeec';
const LINE = '#dde3e0';

/**
 * Curvas de temperatura corregida (°C) vs. tiempo, todos los sensores
 * superpuestos. La leyenda va arriba: abajo se pisaba con el rótulo del eje X.
 *
 * @param {{
 *   time: number[],
 *   correctedSeries: Record<string, (number|null)[]>,
 *   sensors: {id:string, name:string, color:string}[],
 *   timeUnit: 'min'|'s',
 *   startTime?: number,
 *   endTime?: number,
 * }} props
 */
export default function TemperatureChart({ time, correctedSeries, sensors, timeUnit, startTime, endTime }) {
  const data = time.map((t, i) => {
    const point = { time: t };
    for (const s of sensors) point[s.id] = correctedSeries[s.id]?.[i] ?? null;
    return point;
  });

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Temperatura corregida</h2>
        <span className="card-hint">Data cruda corregida por calibración de cada sensor</span>
      </div>

      <div className="card-body chart-body">
        {data.length === 0 ? (
          <p className="empty">Sin datos para graficar.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 4, right: 12, bottom: 22, left: 4 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="time"
                stroke={LINE}
                tick={{ fill: AXIS }}
                tickMargin={8}
                label={{
                  value: `Tiempo (${timeUnit})`,
                  position: 'insideBottom',
                  offset: -14,
                  fill: AXIS,
                  fontSize: 12,
                }}
              />
              <YAxis
                stroke={LINE}
                tick={{ fill: AXIS }}
                tickMargin={4}
                width={52}
                label={{ value: '°C', angle: -90, position: 'insideLeft', fill: AXIS, fontSize: 12 }}
              />
              <Tooltip
                content={<ChartTooltip xLabel={`Tiempo (${timeUnit}):`} unit="°C" />}
                cursor={{ stroke: AXIS, strokeDasharray: '3 3' }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="plainline"
                iconSize={14}
                wrapperStyle={{ fontSize: 12, paddingBottom: 12 }}
              />
              {startTime != null && (
                <ReferenceLine
                  x={startTime}
                  stroke="#eb6834"
                  strokeDasharray="4 3"
                  label={{ value: 'inicio F0/FH', position: 'insideTopLeft', fill: '#eb6834', fontSize: 11 }}
                />
              )}
              {endTime != null && (
                <ReferenceLine
                  x={endTime}
                  stroke="#eb6834"
                  strokeDasharray="4 3"
                  label={{ value: 'fin F0/FH', position: 'insideTopRight', fill: '#eb6834', fontSize: 11 }}
                />
              )}
              {sensors.map((s) => (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={s.id}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
