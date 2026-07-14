import React, { memo } from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';
import { getTrafficColor } from '../../utils/colors';

/**
 * Custom edge that changes color based on utilization (green → yellow → red).
 * Shows bandwidth label and animates dashes when active.
 */
const NetworkEdge: React.FC<EdgeProps> = memo(({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, style, selected,
}) => {
  const utilization = data?.utilization ?? 0;
  const isDisabled = data?.status === 'disabled';
  const bandwidth = data?.bandwidth ?? 100;
  const latency = data?.latency ?? 10;
  const color = isDisabled ? '#374151' : getTrafficColor(utilization);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  return (
    <>
      {/* Glow layer */}
      {utilization > 0.3 && !isDisabled && (
        <path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeOpacity={0.15}
          filter="blur(4px)"
        />
      )}

      {/* Main edge */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={selected ? 3 : 2}
        strokeOpacity={isDisabled ? 0.3 : 0.8}
        strokeDasharray={isDisabled ? '6 4' : utilization > 0 ? '8 4' : 'none'}
        style={{
          transition: 'stroke 0.3s, stroke-width 0.2s',
          animation: utilization > 0 && !isDisabled ? 'dash-flow 1s linear infinite' : 'none',
        }}
      />

      {/* Label */}
      <foreignObject
        x={labelX - 40}
        y={labelY - 12}
        width={80}
        height={24}
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <div style={{
            background: 'rgba(10, 14, 26, 0.9)',
            border: `1px solid ${isDisabled ? '#374151' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '6px',
            padding: '2px 8px',
            fontSize: '9px',
            color: isDisabled ? '#64748b' : '#94a3b8',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
          }}>
            {isDisabled ? '✕ DOWN' : `${bandwidth}Mbps · ${latency}ms`}
          </div>
        </div>
      </foreignObject>

      <style>{`
        @keyframes dash-flow {
          to { stroke-dashoffset: -24; }
        }
      `}</style>
    </>
  );
});

NetworkEdge.displayName = 'NetworkEdge';
export default NetworkEdge;
