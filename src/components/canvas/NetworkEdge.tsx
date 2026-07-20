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
  const simConfig = useNetworkStore(s => s.simConfig);
  const utilization = data?.utilization ?? 0;
  
  // ─── Network Parameter Visualizations ───

  // 1. Dynamic Direction Tracking
  const isReverse = activePackets.some(p => {
    if (p.currentHop === 0) return false;
    const prevNode = p.path[p.currentHop - 1];
    const currNode = p.path[p.currentHop];
    return prevNode === target && currNode === source;
  });

  // 2. Performance-optimized hooks for recent Drops & Corruption on this link
  const hasRecentDrop = useNetworkStore(s =>
    s.packetHistory.some(p => {
      if (p.status !== 'dropped') return false;
      const dropTime = p.hopTimestamps[p.hopTimestamps.length - 1] ?? p.createdAt;
      if (Date.now() - dropTime > 2500) return false;
      if (p.currentHop >= p.path.length - 1) return false;
      const prev = p.path[p.currentHop];
      const next = p.path[p.currentHop + 1];
      return (source === prev && target === next) || (source === next && target === prev);
    })
  );

  const hasRecentCorruption = useNetworkStore(s =>
    s.packetHistory.some(p => {
      if (p.status !== 'corrupted') return false;
      const corruptTime = p.hopTimestamps[p.hopTimestamps.length - 1] ?? p.createdAt;
      if (Date.now() - corruptTime > 2500) return false;
      if (p.currentHop >= p.path.length - 1) return false;
      const prev = p.path[p.currentHop];
      const next = p.path[p.currentHop + 1];
      return (source === prev && target === next) || (source === next && target === prev);
    })
  );

  const isDisabled = data?.status === 'disabled';
  const bandwidth = data?.bandwidth ?? 100;
  const latency = data?.latency ?? 10;
  const congestionPct = simConfig.congestion ?? 0;

  // 3. Flow Color & Congestion Bottlenecking
  const getFlowColor = (util: number, cong: number) => {
    if (cong > 70 || util > 0.85) return '#ef4444'; // Choked bottleneck red
    if (cong > 35 || util > 0.6) return '#f59e0b';  // Heavy load / congestion warning amber
    if (util < 0.3 && cong < 15) return '#86efac';  // Smooth light flow
    return '#10b981';                              // Healthy emerald green
  };

  const baseFlowColor = isDisabled ? '#4b5563' : getFlowColor(utilization, congestionPct);
  const flowColor = hasRecentCorruption ? '#d946ef' : baseFlowColor;

  // 4. Flow Thinning / Constriction under Congestion
  // High congestion thins out the liquid flow inside the pipe core to show bottleneck choke
  const baseWaterWidth = isDisabled
    ? 0
    : utilization > 0 || activePackets.length > 0
    ? (utilization < 0.4 ? 4.0 : utilization < 0.75 ? 6.0 : 8.0)
    : 3.5;
  const waterWidth = Math.max(1.5, baseWaterWidth * (1 - (congestionPct / 100) * 0.65));

  // 5. Flow Duration & Latency Scaling (Higher latency & congestion = slower fluid movement)
  const actualLatency = latency * simConfig.latencyMultiplier;
  const latencyScale = Math.max(0.4, Math.min(4.0, actualLatency / 20));
  const congestionDelayFactor = 1 + (congestionPct / 100) * 2.0;
  const flowDuration = isDisabled
    ? 0
    : (0.8 + 2.5 * Math.pow(Math.max(0.1, utilization), 1.2)) * latencyScale * congestionDelayFactor;

  // 6. Jitter & Turbulence (High jitter introduces stutters/jerks in timing curve)
  const animationTiming = simConfig.jitter > 20
    ? 'cubic-bezier(0.68, -0.6, 0.32, 1.6)' // Stuttery bounce curve
    : 'linear';

  // 7. Packet Loss Flickering & Congestion Choke Pulse
  const isLossy = simConfig.packetLoss > 10;
  const flickerDuration = Math.max(0.2, Math.min(2.0, 100 / simConfig.packetLoss));
  const animationString = [
    `${isReverse ? 'dash-flow-reverse' : 'dash-flow-forward'} ${flowDuration.toFixed(2)}s ${animationTiming} infinite`,
    isLossy ? `flow-flicker ${flickerDuration}s ease-in-out infinite` : '',
    congestionPct > 40 ? 'flow-choke-pulse 1.2s ease-in-out infinite' : ''
  ].filter(Boolean).join(', ');

  // 8. Casing color (Alert red for drop, Amber for high congestion, Cyan for selected)
  const casingStroke = hasRecentDrop
    ? 'rgba(239, 68, 68, 0.9)'
    : congestionPct > 60
    ? 'rgba(245, 158, 11, 0.45)'
    : selected
    ? 'rgba(6, 182, 212, 0.5)'
    : 'rgba(255, 255, 255, 0.12)';

  // Dash pattern (sum = 20): High congestion thins dashes into tight dots
  const strokeDasharray = isDisabled
    ? '6 4'
    : congestionPct > 60
    ? '2 18'
    : utilization < 0.4
    ? '4 16'
    : utilization < 0.75
    ? '8 12'
    : '14 6';

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  return (
    <>
      {/* 1. Pipe Outer Glass Casing / Border */}
      <path
        d={edgePath}
        fill="none"
        stroke={casingStroke}
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
        stroke="#0a0e1a"
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
          strokeOpacity={hasRecentCorruption ? 0.35 : 0.18}
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
            animation: animationString,
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
          stroke={baseFlowColor}
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
                ? baseFlowColor
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
                <span>{bandwidth}Mbps · {(latency * simConfig.latencyMultiplier).toFixed(0)}ms</span>
                {utilization > 0 && (
                  <span style={{
                    color: baseFlowColor,
                    fontWeight: 700,
                    marginLeft: '5px',
                    transition: 'color 0.3s',
                  }}>
                    · Util {(utilization * 100).toFixed(0)}%
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
        @keyframes flow-flicker {
          0%, 100% { opacity: 0.95; }
          50% { opacity: 0.15; }
        }
        @keyframes flow-choke-pulse {
          0%, 100% { stroke-width: ${waterWidth}px; opacity: 0.95; }
          50% { stroke-width: ${Math.max(1, waterWidth * 0.5)}px; opacity: 0.5; }
        }
      `}</style>
    </>
  );
});

NetworkEdge.displayName = 'NetworkEdge';
export default NetworkEdge;
