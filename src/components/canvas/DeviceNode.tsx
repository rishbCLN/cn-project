import React, { memo, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { DEVICE_COLORS } from '../../utils/colors';
import { DeviceType } from '../../types';

/* ─── Device Icons (inline SVG for zero-dep) ─── */
const DeviceIcons: Record<DeviceType, React.ReactNode> = {
  router: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  ),
  switch: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="7" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="17" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
  server: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="2" width="18" height="6" rx="2" />
      <rect x="3" y="10" width="18" height="6" rx="2" />
      <circle cx="7" cy="5" r="1" fill="currentColor" />
      <circle cx="7" cy="13" r="1" fill="currentColor" />
      <path d="M3 18h18v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2z" />
    </svg>
  ),
  pc: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
};

const DeviceNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const device = data.device;
  const color = DEVICE_COLORS[device.type as DeviceType];
  const isDisabled = device.status === 'disabled';
  const load = device.load ?? 0;

  const activePackets = useNetworkStore(s => s.activePackets);
  const activePacket = useMemo(() => {
    return activePackets.find(p => p.path[p.currentHop] === device.id && (p.status === 'in-transit' || p.status === 'created'));
  }, [activePackets, device.id]);

  const glowStyle = useMemo(() => {
    if (isDisabled) return {};
    if (activePacket) {
      return {
        boxShadow: `0 0 25px ${color}70, 0 0 50px ${color}30`,
        borderColor: color,
      };
    }
    if (load > 0.7) {
      return {
        boxShadow: `0 0 ${20 + load * 30}px ${color}40, 0 0 ${40 + load * 60}px ${color}20`,
      };
    }
    if (selected) {
      return { boxShadow: `0 0 20px ${color}30` };
    }
    return {};
  }, [load, color, isDisabled, selected, activePacket]);

  // Distinct professional shapes, faded subtle backgrounds, and sober borders per component type
  const shapeStyle = useMemo(() => {
    const typeKey = device.type as DeviceType;
    const fadedBgs: Record<DeviceType, string> = {
      server: 'rgba(16, 185, 129, 0.08)', // Sober Faded Green
      router: 'rgba(59, 130, 246, 0.08)', // Sober Faded Blue
      switch: 'rgba(139, 92, 246, 0.08)', // Sober Faded Purple
      pc: 'rgba(245, 158, 11, 0.08)',     // Sober Faded Amber
    };
    const fadedBorders: Record<DeviceType, string> = {
      server: 'rgba(16, 185, 129, 0.35)',
      router: 'rgba(59, 130, 246, 0.45)',
      switch: 'rgba(139, 92, 246, 0.35)',
      pc: 'rgba(245, 158, 11, 0.35)',
    };

    const bg = isDisabled ? 'rgba(30, 41, 59, 0.85)' : fadedBgs[typeKey] ?? 'rgba(15, 23, 42, 0.85)';
    const borderColor = selected ? color : isDisabled ? '#475569' : fadedBorders[typeKey] ?? 'rgba(255,255,255,0.1)';

    switch (typeKey) {
      case 'server':
        return {
          background: bg,
          border: `1.5px solid ${borderColor}`,
          borderRadius: '8px',
          padding: '12px 14px',
          minWidth: '105px',
          minHeight: '110px',
          display: 'flex',
          flexDirection: 'column' as const,
          justifyContent: 'center',
          alignItems: 'center',
        };
      case 'router':
        return {
          background: bg,
          border: `2px solid ${borderColor}`,
          borderRadius: '50%',
          padding: '16px 14px',
          minWidth: '110px',
          minHeight: '110px',
          display: 'flex',
          flexDirection: 'column' as const,
          justifyContent: 'center',
          alignItems: 'center',
        };
      case 'switch':
        return {
          background: bg,
          border: `1.5px solid ${borderColor}`,
          borderRadius: '5px',
          padding: '8px 16px',
          minWidth: '145px',
          minHeight: '64px',
        };
      case 'pc':
      default:
        return {
          background: bg,
          border: `1.5px solid ${borderColor}`,
          borderRadius: '12px 2px 12px 2px',
          padding: '10px 14px',
          minWidth: '110px',
          minHeight: '80px',
        };
    }
  }, [device.type, color, isDisabled, selected]);

  return (
    <>
      {/* Target Connection Handles at Node Edges */}
      <Handle type="target" id="target-top-dot" position={Position.Top} style={{ background: color }} />
      <Handle type="target" id="target-bottom-dot" position={Position.Bottom} style={{ background: color }} />
      <Handle type="target" id="target-left-dot" position={Position.Left} style={{ background: color }} />
      <Handle type="target" id="target-right-dot" position={Position.Right} style={{ background: color }} />

      {/* Source Connection Handles at Node Edges */}
      <Handle type="source" id="handle-top" position={Position.Top} style={{ background: color }} />
      <Handle type="source" id="handle-bottom" position={Position.Bottom} style={{ background: color }} />
      <Handle type="source" id="handle-left" position={Position.Left} style={{ background: color }} />
      <Handle type="source" id="handle-right" position={Position.Right} style={{ background: color }} />

      <motion.div
        className="device-node-card"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          backdropFilter: 'blur(12px)',
          textAlign: 'center',
          transition: 'border-color 0.2s, box-shadow 0.3s, background-color 0.3s',
          position: 'relative',
          ...shapeStyle,
          ...glowStyle,
        }}
      >
        {/* Professional Chassis LED Header Indicators */}
        {device.type === 'switch' && (
          <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', marginBottom: '4px', opacity: isDisabled ? 0.3 : 0.8 }}>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#8b5cf6' }} />
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10b981' }} />
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10b981' }} />
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#06b6d4' }} />
          </div>
        )}

        {device.type === 'server' && (
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '4px', opacity: isDisabled ? 0.3 : 0.8 }}>
            <span style={{ width: '3px', height: '10px', borderRadius: '1px', background: '#10b981' }} />
            <span style={{ width: '3px', height: '10px', borderRadius: '1px', background: '#10b981' }} />
          </div>
        )}

        <div style={{
          color: isDisabled ? '#64748b' : color,
          display: 'flex',
          justifyContent: 'center',
          marginBottom: device.type === 'router' ? '4px' : '6px',
          opacity: isDisabled ? 0.4 : 1,
        }}>
          {DeviceIcons[device.type as DeviceType]}
        </div>

        <div style={{
          fontSize: '12px',
          fontWeight: 700,
          color: isDisabled ? '#64748b' : '#f8fafc',
          marginBottom: '2px',
          letterSpacing: '-0.01em',
        }}>
          {device.label}
        </div>

        <div style={{
          fontSize: '10px',
          color: '#64748b',
          fontFamily: 'monospace',
        }}>
          {device.ip}
        </div>

        {activePacket && !isDisabled && (
          <div style={{
            fontSize: '9px',
            color: '#06b6d4',
            fontWeight: 700,
            marginTop: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontFamily: 'monospace',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
          }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#06b6d4',
              boxShadow: '0 0 6px #06b6d4',
            }} />
            HOP #{activePacket.currentHop + 1}
          </div>
        )}

        {isDisabled && (
          <div style={{
            fontSize: '9px',
            color: '#ef4444',
            fontWeight: 600,
            marginTop: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            ● OFFLINE
          </div>
        )}
      </motion.div>
    </>
  );
});

DeviceNode.displayName = 'DeviceNode';
export default DeviceNode;
