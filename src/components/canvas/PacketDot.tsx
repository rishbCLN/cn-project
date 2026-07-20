import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { PROTOCOL_COLORS } from '../../utils/colors';

/**
 * Renders animated dots that travel along edges for each active packet.
 * Dynamically scales travel duration with simulation step speed for demo pacing.
 */
export const PacketDots: React.FC = () => {
  const activePackets = useNetworkStore(s => s.activePackets);
  const devices = useNetworkStore(s => s.devices);
  const simConfig = useNetworkStore(s => s.simConfig);

  // Compute smooth travel duration based on demo speed and latency settings
  const travelDuration = useMemo(() => {
    const baseStepMs = 2500 / simConfig.speed;
    const latencyFactor = Math.max(0.8, simConfig.latencyMultiplier * 0.8);
    return Math.max(0.7, (baseStepMs * 0.88 * latencyFactor) / 1000);
  }, [simConfig.speed, simConfig.latencyMultiplier]);

  const dots = useMemo(() => {
    return activePackets
      .filter(p => p.status === 'in-transit' || p.status === 'created')
      .map(packet => {
        const fromIdx = Math.max(0, packet.currentHop);
        const toIdx = Math.min(packet.path.length - 1, packet.currentHop + 1);
        const fromDevice = devices.find(d => d.id === packet.path[fromIdx]);
        const toDevice = devices.find(d => d.id === packet.path[toIdx]);

        if (!fromDevice || !toDevice) return null;

        return {
          id: packet.id,
          seqNum: packet.seqNum,
          protocol: packet.protocol,
          isAck: packet.isAck,
          from: fromDevice.position,
          to: toDevice.position,
        };
      })
      .filter(Boolean);
  }, [activePackets, devices]);

  return (
    <AnimatePresence>
      {dots.map(dot => {
        if (!dot) return null;
        const color = dot.isAck ? '#10b981' : PROTOCOL_COLORS[dot.protocol];

        return (
          <motion.div
            key={dot.id}
            initial={{
              left: dot.from.x + 55,
              top: dot.from.y + 30,
              scale: 0,
              opacity: 0,
            }}
            animate={{
              left: dot.to.x + 55,
              top: dot.to.y + 30,
              scale: 1,
              opacity: 1,
            }}
            exit={{
              scale: 0,
              opacity: 0,
            }}
            transition={{
              duration: travelDuration,
              ease: 'easeInOut',
            }}
            style={{
              position: 'absolute',
              width: dot.isAck ? 10 : 14,
              height: dot.isAck ? 10 : 14,
              borderRadius: '50%',
              background: color,
              boxShadow: `0 0 14px ${color}, 0 0 28px ${color}80`,
              zIndex: 1000,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Packet Label Tooltip Tag */}
            <div
              style={{
                position: 'absolute',
                top: '-22px',
                whiteSpace: 'nowrap',
                background: 'rgba(10, 14, 26, 0.9)',
                border: `1px solid ${color}`,
                borderRadius: '4px',
                padding: '1px 6px',
                fontSize: '9px',
                fontWeight: 700,
                color: '#f8fafc',
                fontFamily: 'monospace',
                pointerEvents: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              {dot.isAck ? `ACK #${dot.seqNum}` : `#${dot.seqNum} ${dot.protocol}`}
            </div>

            {/* Glowing Pulse Ring */}
            <div
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: `1.5px solid ${color}`,
                animation: 'packet-pulse 1.2s infinite ease-out',
              }}
            />
          </motion.div>
        );
      })}

      <style>{`
        @keyframes packet-pulse {
          0% { transform: scale(1); opacity: 0.9; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </AnimatePresence>
  );
};
