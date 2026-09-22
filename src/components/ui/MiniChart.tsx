import React, { useMemo, useState } from 'react';

/**
 * MiniChart — a dependency-free, animated SVG line/area chart.
 * Replaces recharts with a lightweight component tailored to the glass UI.
 * Supports smooth catmull-rom curves, gradient area fills, and a hover crosshair.
 */

export interface MiniChartProps {
  data: number[];
  color?: string;
  height?: number;
  /** 'line' draws a stroke only; 'area' adds a gradient fill under the curve. */
  variant?: 'line' | 'area';
  /** Formats the value shown in the hover tooltip. */
  format?: (value: number) => string;
  /** Optional fixed lower bound. Defaults to data min. */
  min?: number;
  /** Optional fixed upper bound. Defaults to data max. */
  max?: number;
}

const WIDTH = 300; // viewBox width; scales responsively via preserveAspectRatio

/** Build a smooth SVG path through points using a Catmull-Rom → Bézier conversion. */
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export const MiniChart: React.FC<MiniChartProps> = ({
  data,
  color = '#06b6d4',
  height = 100,
  variant = 'line',
  format = (v) => v.toFixed(1),
  min,
  max,
}) => {
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useMemo(() => `mc-grad-${Math.random().toString(36).slice(2, 9)}`, []);

  const { points, linePath, areaPath } = useMemo(() => {
    if (data.length === 0) {
      return { points: [] as { x: number; y: number }[], linePath: '', areaPath: '' };
    }
    const lo = min ?? Math.min(...data);
    const hi = max ?? Math.max(...data);
    const range = hi - lo || 1;
    const pad = 6;
    const usableH = height - pad * 2;

    const pts = data.map((v, i) => {
      const x = data.length === 1 ? WIDTH / 2 : (i / (data.length - 1)) * WIDTH;
      const y = pad + usableH - ((v - lo) / range) * usableH;
      return { x, y };
    });

    const line = buildSmoothPath(pts);
    const area = line
      ? `${line} L ${pts[pts.length - 1].x},${height} L ${pts[0].x},${height} Z`
      : '';

    return { points: pts, linePath: line, areaPath: area };
  }, [data, height, min, max]);

  if (data.length === 0) return null;

  const hoverPoint = hover != null ? points[hover] : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const rel = (e.clientX - rect.left) / rect.width;
          const idx = Math.round(rel * (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, idx)));
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Baseline grid lines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={0}
            y1={height * f}
            x2={WIDTH}
            y2={height * f}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {variant === 'area' && areaPath && (
          <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        )}

        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: `drop-shadow(0 0 4px ${color}66)` }}
          />
        )}

        {/* Hover crosshair + marker */}
        {hoverPoint && (
          <>
            <line
              x1={hoverPoint.x}
              y1={0}
              x2={hoverPoint.x}
              y2={height}
              stroke={color}
              strokeOpacity={0.4}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={hoverPoint.x} cy={hoverPoint.y} r={3.5} fill={color} stroke="#0a0e1a" strokeWidth={1.5} />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hover != null && hoverPoint && (
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: `${(hoverPoint.x / WIDTH) * 100}%`,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            background: 'rgba(10, 14, 26, 0.95)',
            border: `1px solid ${color}`,
            borderRadius: '6px',
            padding: '2px 7px',
            fontSize: '10px',
            fontFamily: 'monospace',
            fontWeight: 700,
            color: '#f8fafc',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 5,
          }}
        >
          {format(data[hover])}
        </div>
      )}
    </div>
  );
};
