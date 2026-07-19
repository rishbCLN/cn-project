import React, { memo } from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';
import { getTrafficColor } from '../../utils/colors';
import { useNetworkStore } from '../../stores/networkStore';

/**
 * Custom edge that changes color based on utilization (green → yellow → red).
 * Shows bandwidth label and animates dashes when active.
 */
const NetworkEdge: React.FC<EdgeProps> = memo(({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, style, selected,
  source, target,
}) => {
  const activePackets = useNetworkStore(s => s.activePackets);
  const utilization = data?.utilization ?? 0;
  
  // Determine if packets are flowing in the reverse direction (target -> source)
  const isReverse = activePackets.some(p => {
    if (p.currentHop === 0) return false;
    const prevNode = p.path[p.currentHop - 1];
    const currNode = p.path[p.currentHop];
    return prevNode === target && currNode === source;
  });

  const isDisabled = data?.status === 'disabled';
  const bandwidth = data?.bandwidth ?? 100;
  const latency = data?.latency ?? 10;

  // ─── Flow Animation & Pipe Styling Properties ───
  const getFlowColor = (util: number) => {
    // In computer networking, active flow/throughput is a healthy state.
    // So the liquid is always green when active, scaling to a more vibrant green at high utilization (max throughput).
    // It should never turn red, which indicates link down/error rather than successful transmission.
    if (util < 0.4) return '#86efac';   // Soft light green for light flow
    if (util < 0.75) return '#10b981';  // Healthy green for normal flow
    return '#22c55e';                   // Vibrant bright green for high throughput
  };

  const flowColor = isDisabled ? '#4b5563' : getFlowColor(utilization);

  // Animation duration: congestion makes the water flow slower!
  // Speed is fast at low load, slowing down at high load
  const flowDuration = isDisabled || utilization === 0
    ? 0
    : 0.5 + 4.5 * Math.pow(utilization, 1.5);

  // Dash pattern (must sum to 20 for seamless loop with stroke-dashoffset: -40 / 40):
  // - Low load: "3 17" (sparse droplets for light traffic)
  // - Medium load: "8 12" (spaced out water segments)
  // - High load: "14 6" (thick continuous stream for high capacity/throughput)
  const strokeDasharray = isDisabled
    ? '6 4'
    : utilization < 0.4
    ? '3 17'
    : utilization < 0.75
    ? '8 12'
    : '14 6';

  // Liquid line thickness gets thicker as traffic volume (utilization) increases
  const waterWidth = isDisabled || utilization === 0
    ? 0
    : utilization < 0.4
    ? 3.0
    : utilization < 0.75
    ? 5.5
    : 8.0;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  return (
    <>
      {/* 1. Pipe Outer Glass Casing / Border */}
      <path
        d={edgePath}
        fill="none"
        stroke={selected ? 'rgba(6, 182, 212, 0.45)' : 'rgba(255, 255, 255, 0.12)'}
        strokeWidth={14}
        strokeLinecap="round"
        style={{
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
      />

      {/* 2. Pipe Inner Vacuum (Hollow Core Background) */}
      <path
        d={edgePath}
        fill="none"
        stroke="#0a0e1a" // Matches canvas background color
        strokeWidth={11}
        strokeLinecap="round"
      />

      {/* 3. Liquid Base / Flow Glow (Soft background color of liquid) */}
      {!isDisabled && utilization > 0 && (
        <path
          d={edgePath}
          fill="none"
          stroke={flowColor}
          strokeWidth={waterWidth + 4}
          strokeOpacity={0.18}
          filter="blur(3px)"
          style={{
            transition: 'stroke 0.3s, stroke-width 0.2s',
          }}
        />
      )}

      {/* 4. Active Flowing Water Stream */}
      {!isDisabled && utilization > 0 && (
        <path
          id={id}
          d={edgePath}
          fill="none"
          stroke={flowColor}
          strokeWidth={waterWidth}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          style={{
            transition: 'stroke 0.3s, stroke-width 0.2s, opacity 0.3s',
            animation: `${isReverse ? 'dash-flow-reverse' : 'dash-flow-forward'} ${flowDuration}s linear infinite`,
            opacity: 0.9,
          }}
        />
      )}

      {/* 5. Disabled Static Stream */}
      {isDisabled && (
        <path
          id={id}
          d={edgePath}
          fill="none"
          stroke={flowColor}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          style={{
            transition: 'stroke 0.3s, opacity 0.3s',
            opacity: 0.35,
          }}
        />
      )}

      {/* Label */}
      <foreignObject
        x={labelX - 45}
        y={labelY - 12}
        width={90}
        height={24}
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <div style={{
            background: 'rgba(10, 14, 26, 0.92)',
            backdropFilter: 'blur(4px)',
            border: `1px solid ${
              isDisabled
                ? '#374151'
                : selected
                ? 'var(--accent-cyan)'
                : utilization > 0
                ? flowColor
                : 'rgba(255,255,255,0.08)'
            }`,
            borderRadius: '6px',
            padding: '2px 8px',
            fontSize: '9px',
            color: isDisabled ? '#64748b' : '#94a3b8',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            boxShadow: selected ? '0 0 10px rgba(6, 182, 212, 0.2)' : 'none',
            transition: 'all 0.3s',
          }}>
            {isDisabled ? (
              '✕ DOWN'
            ) : (
              <>
                <span>{bandwidth}Mbps · {latency}ms</span>
                {utilization > 0 && (
                  <span style={{
                    color: flowColor,
                    fontWeight: 700,
                    marginLeft: '5px',
                    transition: 'color 0.3s',
                  }}>
                    · {(utilization * 100).toFixed(0)}%
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </foreignObject>

      <style>{`
        @keyframes dash-flow-forward {
          to { stroke-dashoffset: -40; }
        }
        @keyframes dash-flow-reverse {
          to { stroke-dashoffset: 40; }
        }
      `}</style>
    </>
  );
});

NetworkEdge.displayName = 'NetworkEdge';
export default NetworkEdge;
