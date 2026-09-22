import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from 'reactflow';
import { useNetworkStore } from '../../stores/networkStore';
import { useUIStore } from '../../stores/uiStore';
import { PROTOCOL_COLORS } from '../../utils/colors';
import { Protocol } from '../../types';

/**
 * PacketLayer — renders animated packet dots that travel hop-to-hop along the
 * active path. Rendered *inside* <ReactFlow> so it can read the live viewport
 * transform ([x, y, zoom]) and node geometry from the store, keeping dots
 * perfectly aligned with nodes across pan and zoom.
 */
export const PacketLayer: React.FC = () => {
  const activePackets = useNetworkStore(s => s.activePackets);
  const simConfig = useNetworkStore(s => s.simConfig);
  const reducedMotion = useUIStore(s => s.reducedMotion);

  // Live viewport transform and measured node geometry from React Flow's store.
  const transform = useStore(s => s.transform);
  const nodeInternals = useStore(s => s.nodeInternals);

  const [tx, ty, zoom] = transform;

  // Smooth travel duration scaled by demo speed + latency.
  const travelDuration = useMemo(() => {
    if (reducedMotion) return 0.25; // near-instant snap, no long tweens
    const baseStepMs = 2500 / simConfig.speed;
    const latencyFactor = Math.max(0.8, simConfig.latencyMultiplier * 0.8);
    return Math.max(0.7, (baseStepMs * 0.88 * latencyFactor) / 1000);
  }, [simConfig.speed, simConfig.latencyMultiplier, reducedMotion]);

  const dots = useMemo(() => {
    const centerOf = (id: string) => {
      const n = nodeInternals.get(id);
      if (!n) return null;
      const pos = n.positionAbsolute ?? n.position;
      const w = n.width ?? 110;
      const h = n.height ?? 90;
      return { x: pos.x + w / 2, y: pos.y + h / 2 };
    };

    return activePackets
      .filter(p => p.status === 'in-transit' || p.status === 'created')
      .map(packet => {
        const fromIdx = Math.max(0, packet.currentHop);
        const toIdx = Math.min(packet.path.length - 1, packet.currentHop + 1);
        const from = centerOf(packet.path[fromIdx]);
        const to = centerOf(packet.path[toIdx]);
        if (!from || !to) return null;

        return {
          id: packet.id,
          seqNum: packet.seqNum,
          protocol: packet.protocol,
          checksum: packet.checksum,
          crc: packet.crc,
          status: packet.status,
          isAck: packet.isAck,
          // Convert flow coords → screen coords via the viewport transform.
          from: { x: from.x * zoom + tx, y: from.y * zoom + ty },
          to: { x: to.x * zoom + tx, y: to.y * zoom + ty },
        };
      })
      .filter(Boolean) as Array<{
        id: string; seqNum: number; protocol: Protocol; checksum: string; crc: string;
        status: string; isAck?: boolean; from: { x: number; y: number }; to: { x: number; y: number };
      }>;
  }, [activePackets, nodeInternals, tx, ty, zoom]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, overflow: 'hidden' }}>
      <AnimatePresence>
        {dots.map(dot => {
          const color = dot.isAck
            ? '#10b981'
            : dot.status === 'corrupted'
            ? '#ef4444'
            : PROTOCOL_COLORS[dot.protocol];
          const size = (dot.isAck ? 10 : 14) * Math.max(0.6, Math.min(1.4, zoom));

          return (
            <motion.div
              key={dot.id}
              initial={{ left: dot.from.x, top: dot.from.y, scale: 0, opacity: 0 }}
              animate={{ left: dot.to.x, top: dot.to.y, scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: travelDuration, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 14px ${color}, 0 0 28px ${color}80`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Label — only when zoomed in enough to be readable */}
              {zoom > 0.55 && (
                <div
                  style={{
                    position: 'absolute',
                    top: -22,
                    whiteSpace: 'nowrap',
                    background: 'rgba(10, 14, 26, 0.95)',
                    border: `1.5px solid ${color}`,
                    borderRadius: '5px',
                    padding: '2px 7px',
                    fontSize: '9px',
                    fontWeight: 700,
                    color: '#f8fafc',
                    fontFamily: 'monospace',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span>{dot.isAck ? `ACK #${dot.seqNum}` : `#${dot.seqNum} ${dot.protocol}`}</span>
                  {!dot.isAck && dot.status === 'corrupted' && (
                    <span style={{ color: '#f87171', fontWeight: 800 }}>⚠ CRC</span>
                  )}
                </div>
              )}

              {/* Pulse ring (suppressed under reduced motion) */}
              {!reducedMotion && (
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: `1.5px solid ${color}`,
                    animation: 'packet-ring-pulse 1.2s infinite ease-out',
                  }}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      <style>{`
        @keyframes packet-ring-pulse {
          0% { transform: scale(1); opacity: 0.9; }
          100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
};
