import React, { useMemo } from 'react';
import { useNetworkStore } from '../../stores/networkStore';
import { PROTOCOL_COLORS } from '../../utils/colors';
import { Packet } from '../../types';

/**
 * SequenceDiagram — a time-space (ladder) diagram, the canonical way protocol
 * exchanges are taught. Devices are vertical lifelines (columns); time flows
 * top→down. Each packet hop is an arrow between the lifelines it traversed,
 * annotated with seq/protocol and colored by delivery outcome.
 */

const COL_W = 150;   // horizontal spacing between lifelines
const ROW_H = 34;    // vertical spacing per hop step
const PAD_TOP = 44;  // room for the device headers
const PAD_LEFT = 70; // room for time labels

export const SequenceDiagram: React.FC = () => {
  const packetHistory = useNetworkStore(s => s.packetHistory);
  const devices = useNetworkStore(s => s.devices);

  const { lifelines, arrows, height, width } = useMemo(() => {
    // Only packets that actually moved, most recent 40, chronological.
    const packets = packetHistory
      .filter(p => p.path.length >= 2)
      .slice(-40);

    // Determine which devices participate, in a stable left→right order.
    const participatingIds = new Set<string>();
    packets.forEach(p => p.path.forEach(id => participatingIds.add(id)));
    const cols = devices.filter(d => participatingIds.has(d.id));
    const colIndex = new Map(cols.map((d, i) => [d.id, i]));

    if (packets.length === 0 || cols.length === 0) {
      return { lifelines: [], arrows: [], height: 0, width: 0 };
    }

    const startT = Math.min(...packets.map(p => p.hopTimestamps[0] ?? p.createdAt));

    // Build one arrow per traversed hop, laid out on a discrete row grid.
    type Arrow = {
      key: string; fromCol: number; toCol: number; row: number;
      color: string; label: string; dashed: boolean; dropped: boolean; ms: number;
    };
    const arrowList: Arrow[] = [];
    let row = 0;

    const outcomeColor = (p: Packet) => {
      if (p.isAck) return '#10b981';
      if (p.status === 'dropped') return '#ef4444';
      if (p.status === 'corrupted') return '#f59e0b';
      return PROTOCOL_COLORS[p.protocol];
    };

    packets.forEach(p => {
      const hops = Math.max(1, p.path.length - 1);
      // How far the packet actually got (currentHop), so drops stop mid-path.
      const reached = p.status === 'delivered' ? hops : Math.min(p.currentHop, hops);
      const drawHops = Math.max(1, reached);

      for (let i = 0; i < drawHops; i++) {
        const fromId = p.path[i];
        const toId = p.path[i + 1];
        if (colIndex.get(fromId) == null || colIndex.get(toId) == null) continue;

        const ts = p.hopTimestamps[i + 1] ?? p.hopTimestamps[i] ?? p.createdAt;
        const isLastHopOfDropped = p.status === 'dropped' && i === drawHops - 1;

        arrowList.push({
          key: `${p.id}-${i}`,
          fromCol: colIndex.get(fromId)!,
          toCol: colIndex.get(toId)!,
          row,
          color: isLastHopOfDropped ? '#ef4444' : outcomeColor(p),
          label: i === 0 ? `${p.isAck ? 'ACK' : p.protocol} #${p.seqNum}` : '',
          dashed: !!p.isAck,
          dropped: isLastHopOfDropped,
          ms: ts - startT,
        });
        row++;
      }
    });

    return {
      lifelines: cols,
      arrows: arrowList,
      height: PAD_TOP + row * ROW_H + 20,
      width: PAD_LEFT + cols.length * COL_W,
    };
  }, [packetHistory, devices]);

  if (lifelines.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
        Send packets to build the time-space sequence diagram
      </div>
    );
  }

  const colX = (i: number) => PAD_LEFT + i * COL_W + COL_W / 2;

  return (
    <div style={{ overflow: 'auto', height: '100%', width: '100%', padding: '4px 8px' }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {/* Lifelines + headers */}
        {lifelines.map((d, i) => (
          <g key={d.id}>
            <line
              x1={colX(i)} y1={PAD_TOP - 8} x2={colX(i)} y2={height - 12}
              stroke="rgba(255,255,255,0.1)" strokeWidth={1.5} strokeDasharray="2 4"
            />
            <foreignObject x={colX(i) - COL_W / 2 + 6} y={6} width={COL_W - 12} height={30}>
              <div style={{
                textAlign: 'center', fontSize: '11px', fontWeight: 700,
                color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)',
                borderRadius: '6px', padding: '3px 4px',
              }}>
                {d.label}
              </div>
            </foreignObject>
          </g>
        ))}

        {/* Hop arrows */}
        <defs>
          {Array.from(new Set(arrows.map(a => a.color))).map(c => (
            <marker
              key={c}
              id={`seqhead-${c.replace('#', '')}`}
              markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill={c} />
            </marker>
          ))}
        </defs>

        {arrows.map(a => {
          const y = PAD_TOP + a.row * ROW_H + 12;
          const x1 = colX(a.fromCol);
          const x2 = colX(a.toCol);
          const dir = x2 >= x1 ? 1 : -1;
          const labelX = (x1 + x2) / 2;

          return (
            <g key={a.key}>
              {/* time label */}
              <text x={8} y={y + 4} fontSize={9} fontFamily="monospace" fill="var(--text-muted)">
                +{a.ms.toFixed(0)}ms
              </text>
              <line
                x1={x1 + dir * 4} y1={y} x2={x2 - dir * 8} y2={y}
                stroke={a.color} strokeWidth={2}
                strokeDasharray={a.dashed ? '5 3' : undefined}
                markerEnd={`url(#seqhead-${a.color.replace('#', '')})`}
                opacity={0.95}
              />
              {a.dropped && (
                <text x={x2 - dir * 14} y={y - 5} fontSize={11} fill="#ef4444" fontWeight={800}>✕</text>
              )}
              {a.label && (
                <text
                  x={labelX} y={y - 5} fontSize={9.5} fontFamily="monospace"
                  fontWeight={700} fill={a.color} textAnchor="middle"
                >
                  {a.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
