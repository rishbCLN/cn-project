import React, { memo, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { DEVICE_COLORS } from '../../utils/colors';
import { DeviceType } from '../../types';
import { useUIStore } from '../../stores/uiStore';

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
  const isDraggingConnection = useUIStore(s => s.isDraggingConnection);
  const connectionSourceId = useUIStore(s => s.connectionSourceId);

  const glowStyle = useMemo(() => {
    if (isDisabled) return {};
    if (load > 0.7) {
      return {
        boxShadow: `0 0 ${20 + load * 30}px ${color}40, 0 0 ${40 + load * 60}px ${color}20`,
      };
    }
    if (selected) {
      return { boxShadow: `0 0 20px ${color}30` };
    }
    return {};
  }, [load, color, isDisabled, selected]);

  return (
    <>
      <Handle type="source" id="handle-top" position={Position.Top} style={{ background: color }} />
      <Handle type="source" id="handle-bottom" position={Position.Bottom} style={{ background: color }} />
      <Handle type="source" id="handle-left" position={Position.Left} style={{ background: color }} />
      <Handle type="source" id="handle-right" position={Position.Right} style={{ background: color }} />

      <motion.div
        className="device-node-card"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          background: isDisabled
            ? 'rgba(30, 30, 40, 0.8)'
            : 'rgba(17, 24, 39, 0.85)',
          backdropFilter: 'blur(12px)',
          border: `1.5px solid ${selected ? color : isDisabled ? '#374151' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: '12px',
          padding: '12px 16px',
          minWidth: '110px',
          textAlign: 'center',
          transition: 'border-color 0.2s, box-shadow 0.3s',
          position: 'relative',
          ...glowStyle,
        }}
      >
        {isDraggingConnection && connectionSourceId !== device.id && (
          <Handle
            type="target"
            id="target-full"
            position={Position.Top}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              zIndex: 100,
              borderRadius: '12px',
              transform: 'none',
              border: 'none',
              background: 'transparent',
            }}
          />
        )}
        <div style={{
          color: isDisabled ? '#64748b' : color,
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '6px',
          opacity: isDisabled ? 0.4 : 1,
        }}>
          {DeviceIcons[device.type as DeviceType]}
        </div>

        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: isDisabled ? '#64748b' : '#f1f5f9',
          marginBottom: '2px',
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
