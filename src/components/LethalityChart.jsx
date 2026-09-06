'use client';

import { useState } from 'react';
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
 * Curva de letalidad acumulada (F0 o FH) en el tiempo, por sensor, con los
 * dos métodos de integración disponibles (trapecio / suma acumulada). Los
 * selectores son estado de presentación puro, así que viven acá y no en el
 * workspace.
 *
 * @param {{
 *   time: number[],
 *   results: Record<string, {f0TrapCumulative:number[], f0SumCumulative:number[], fhTrapCumulative:number[], fhSumCumulative:number[]}>,
 *   sensors: {id:string, name:string, color:string}[],
 *   timeUnit: 'min'|'s',
 * }} props
 */
export default function LethalityChart({ time, results, sensors, timeUnit, startTime, endTime }) {
  const [metric, setMetric] = useState('f0');
  const [method, setMethod] = useState('trap');

  const key = `${metric}${method === 'trap' ? 'Trap' : 'Sum'}Cumulative`;
  const label = metric === 'fh' ? 'FH' : 'F0';

  const data = time.map((t, i) => {
    const point = { time: t };
    for (const s of sensors) point[s.id] = results[s.id]?.[key]?.[i] ?? null;
    return point;
  });

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Letalidad acumulada</h2>
        <div className="card-actions">
          <div className="seg" role="group" aria-label="Método de integración">
            <button aria-pressed={method === 'trap'} onClick={() => setMethod('trap')}>
              Trapecio
            </button>
            <button aria-pressed={method === 'sum'} onClick={() => setMethod('sum')}>
              Suma
            </button>
          </div>
          <div className="seg" role="group" aria-label="Métrica">
            <button aria-pressed={metric === 'f0'} onClick={() => setMetric('f0')}>
              F0
            </button>
            <button aria-pressed={metric === 'fh'} onClick={() => setMetric('fh')}>
              FH
            </button>
          </div>
        </div>
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
                label={{
                  value: `${label} (min)`,
                  angle: -90,
                  position: 'insideLeft',
                  fill: AXIS,
                  fontSize: 12,
                }}
              />
              <Tooltip
                content={<ChartTooltip xLabel={`Tiempo (${timeUnit}):`} unit="min" />}
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
