'use client';

import { useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
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
const MARKER = '#eb6834';
const LIMIT = '#2a78d6';

/**
 * Curvas de temperatura corregida (°C) vs. tiempo, todos los sensores
 * superpuestos. La leyenda va arriba: abajo se pisaba con el rótulo del eje X.
 *
 * Si la corrida tiene banda de aceptación cargada, se dibuja como franja de
 * fondo entre LI y LS: ver de un vistazo si alguna curva se sale de la
 * banda durante la exposición es justamente para lo que se mira este
 * gráfico en una calificación.
 *
 * @param {{
 *   time: number[],
 *   correctedSeries: Record<string, (number|null)[]>,
 *   sensors: {id:string, name:string, color:string}[],
 *   timeUnit: 'min'|'s',
 *   startTime?: number,
 *   endTime?: number,
 *   tempLowLimit?: number|null,
 *   tempHighLimit?: number|null,
 * }} props
 */
export default function TemperatureChart({
  time,
  correctedSeries,
  sensors,
  timeUnit,
  startTime,
  endTime,
  tempLowLimit,
  tempHighLimit,
}) {
  const [zoom, setZoom] = useState('all');

  const allData = time.map((t, i) => {
    const point = { time: t };
    for (const s of sensors) point[s.id] = correctedSeries[s.id]?.[i] ?? null;
    return point;
  });

  const hasLow = Number.isFinite(tempLowLimit);
  const hasHigh = Number.isFinite(tempHighLimit);

  // Con el registro completo el eje va de 0 a ~140 °C y una banda de
  // aceptación de 121-124 °C queda en una franja de dos píxeles, ilegible.
  // El zoom a la ventana recorta a la meseta y deja que el eje se ajuste
  // solo: recién ahí se ve si alguna curva se sale de la banda.
  const from = startTime ?? -Infinity;
  const to = endTime ?? Infinity;
  const windowData = allData.filter((d) => d.time >= from && d.time <= to);
  const zoomed = zoom === 'window';
  const data = zoomed ? windowData : allData;
  // Sólo ofrece el zoom si recorta algo: con la ventana en todo el registro,
  // el botón no haría nada.
  const canZoom = windowData.length > 1 && windowData.length < allData.length;

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Temperatura corregida</h2>
        <span className="card-hint">
          {zoomed ? 'Sólo la ventana de conteo' : 'Data cruda corregida por calibración de cada sensor'}
        </span>
        {(canZoom || zoomed) && (
          <div className="card-actions no-print">
            <div className="seg" role="group" aria-label="Rango del gráfico">
              <button aria-pressed={!zoomed} onClick={() => setZoom('all')}>
                Todo el registro
              </button>
              <button aria-pressed={zoomed} onClick={() => setZoom('window')}>
                Ventana
              </button>
            </div>
          </div>
        )}
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
                domain={zoomed ? ['auto', 'auto'] : [0, 'auto']}
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
              {hasLow && hasHigh && (
                <ReferenceArea
                  y1={tempLowLimit}
                  y2={tempHighLimit}
                  fill={LIMIT}
                  fillOpacity={0.07}
                  stroke="none"
                  ifOverflow="extendDomain"
                />
              )}
              {hasLow && (
                <ReferenceLine
                  y={tempLowLimit}
                  stroke={LIMIT}
                  strokeDasharray="6 3"
                  ifOverflow="extendDomain"
                  label={{ value: `LI ${tempLowLimit} °C`, position: 'insideBottomRight', fill: LIMIT, fontSize: 11 }}
                />
              )}
              {hasHigh && (
                <ReferenceLine
                  y={tempHighLimit}
                  stroke={LIMIT}
                  strokeDasharray="6 3"
                  ifOverflow="extendDomain"
                  label={{ value: `LS ${tempHighLimit} °C`, position: 'insideTopLeft', fill: LIMIT, fontSize: 11 }}
                />
              )}
              {startTime != null && (
                <ReferenceLine
                  x={startTime}
                  stroke={MARKER}
                  strokeDasharray="4 3"
                  label={{ value: 'inicio F0/FH', position: 'insideTopLeft', fill: MARKER, fontSize: 11 }}
                />
              )}
              {endTime != null && (
                <ReferenceLine
                  x={endTime}
                  stroke={MARKER}
                  strokeDasharray="4 3"
                  label={{ value: 'fin F0/FH', position: 'insideTopRight', fill: MARKER, fontSize: 11 }}
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
