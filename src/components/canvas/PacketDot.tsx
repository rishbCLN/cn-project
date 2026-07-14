import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { PROTOCOL_COLORS } from '../../utils/colors';

/**
 * Renders animated dots that travel along edges for each active packet.
 * Each dot moves from its current hop node position to the next.
 */
export const PacketDots: React.FC = () => {
  const activePackets = useNetworkStore(s => s.activePackets);
  const devices = useNetworkStore(s => s.devices);

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
        const color = PROTOCOL_COLORS[dot.protocol];

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
              duration: 0.8,
              ease: 'easeInOut',
            }}
            style={{
              position: 'absolute',
              width: dot.isAck ? 8 : 12,
              height: dot.isAck ? 8 : 12,
              borderRadius: '50%',
              background: color,
              boxShadow: `0 0 12px ${color}, 0 0 24px ${color}60`,
              zIndex: 1000,
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </AnimatePresence>
  );
};
