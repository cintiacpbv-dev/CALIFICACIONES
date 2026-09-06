'use client';

/**
 * Tooltip compartido por los dos gráficos: redondea a 2 decimales (la data
 * cruda puede traer muchos más) y alinea los valores en columna.
 */
export default function ChartTooltip({ active, payload, label, xLabel, unit }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-head">
        {xLabel} {label}
      </div>
      {payload.map((entry) => (
        <div className="chart-tooltip-row" key={entry.dataKey}>
          <span className="swatch" style={{ background: entry.color }} />
          {entry.name}
          <b>
            {entry.value == null ? '—' : Number(entry.value).toFixed(2)} {unit}
          </b>
        </div>
      ))}
    </div>
  );
}
