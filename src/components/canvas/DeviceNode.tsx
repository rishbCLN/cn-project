import React, { memo, useMemo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
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
  const links = useNetworkStore(s => s.links);
  const devices = useNetworkStore(s => s.devices);
  const toggleLinkStatus = useNetworkStore(s => s.toggleLinkStatus);

  const connectedLinks = useMemo(() => {
    return links.filter(l => l.source === device.id || l.target === device.id);
  }, [links, device.id]);

  const activePacket = useMemo(() => {
    return activePackets.find(p => p.path[p.currentHop] === device.id && (p.status === 'in-transit' || p.status === 'created'));
  }, [activePackets, device.id]);

  const [showTheory, setShowTheory] = useState(false);
  const isSender = activePacket ? (activePacket.currentHop === 0 || activePacket.sourceDeviceId === device.id) : false;
  const isCorrupted = activePacket ? (activePacket.status === 'corrupted' || !activePacket.crcValid) : false;

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
          borderRadius: '8px',
          padding: '10px 14px',
          minWidth: '150px',
          minHeight: '80px',
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
      <Handle type="target" id="target-top-dot" position={Position.Top} style={{ background: color, width: '10px', height: '10px', top: '-5px' }} />
      <Handle type="target" id="target-bottom-dot" position={Position.Bottom} style={{ background: color, width: '10px', height: '10px', bottom: '-5px' }} />
      <Handle type="target" id="target-left-dot" position={Position.Left} style={{ background: color, width: '10px', height: '10px', left: '-5px' }} />
      <Handle type="target" id="target-right-dot" position={Position.Right} style={{ background: color, width: '10px', height: '10px', right: '-5px' }} />

      {/* Source Connection Handles at Node Edges */}
      <Handle type="source" id="handle-top" position={Position.Top} style={{ background: color, width: '10px', height: '10px', top: '-5px' }} />
      <Handle type="source" id="handle-bottom" position={Position.Bottom} style={{ background: color, width: '10px', height: '10px', bottom: '-5px' }} />
      <Handle type="source" id="handle-left" position={Position.Left} style={{ background: color, width: '10px', height: '10px', left: '-5px' }} />
      <Handle type="source" id="handle-right" position={Position.Right} style={{ background: color, width: '10px', height: '10px', right: '-5px' }} />

      <motion.div
        className="device-node-card"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          backdropFilter: 'blur(12px)',
          textAlign: 'center',
          transition: 'border-color 0.2s, box-shadow 0.3s, background-color 0.3s',
          position: 'relative',
          cursor: 'grab',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          ...shapeStyle,
          ...glowStyle,
        }}
      >
        {/* Dynamic Connected Port LEDs */}
        {connectedLinks.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '6px', opacity: isDisabled ? 0.3 : 1, pointerEvents: 'none' }}>
            {connectedLinks.map((l, i) => (
              <span
                key={l.id}
                title={`Port ${i + 1}: ${l.status === 'active' ? 'Active Flow' : 'Cut Off'}`}
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: l.status === 'active' ? '#10b981' : '#ef4444',
                  boxShadow: `0 0 5px ${l.status === 'active' ? '#10b981' : '#ef4444'}`,
                }}
              />
            ))}
          </div>
        )}

        {device.type === 'server' && (
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '4px', opacity: isDisabled ? 0.3 : 0.8, pointerEvents: 'none' }}>
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
          pointerEvents: 'none',
        }}>
          {DeviceIcons[device.type as DeviceType]}
        </div>

        <div style={{
          fontSize: '12px',
          fontWeight: 700,
          color: isDisabled ? '#64748b' : '#f8fafc',
          marginBottom: '2px',
          letterSpacing: '-0.01em',
          pointerEvents: 'none',
        }}>
          {device.label}
        </div>

        <div style={{
          fontSize: '10px',
          color: '#64748b',
          fontFamily: 'monospace',
          pointerEvents: 'none',
        }}>
          {device.ip}
        </div>

        {/* ─── Animated Computer Networks Checksum & CRC Theory Popover Overlay ─── */}
        <AnimatePresence>
          {activePacket && !isDisabled && (
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 22, stiffness: 320 }}
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 14px)',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '270px',
                background: 'rgba(10, 14, 26, 0.96)',
                backdropFilter: 'blur(16px)',
                border: `1.5px solid ${isCorrupted ? 'rgba(239, 68, 68, 0.8)' : isSender ? 'rgba(6, 182, 212, 0.8)' : 'rgba(16, 185, 129, 0.8)'}`,
                borderRadius: '12px',
                padding: '10px 12px',
                boxShadow: isCorrupted
                  ? '0 0 25px rgba(239, 68, 68, 0.4), 0 8px 32px rgba(0,0,0,0.8)'
                  : '0 0 25px rgba(6, 182, 212, 0.3), 0 8px 32px rgba(0,0,0,0.8)',
                zIndex: 100,
                textAlign: 'left',
                pointerEvents: 'auto',
                fontFamily: 'sans-serif',
              }}
            >
              {/* Header Title Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: isCorrupted ? '#f87171' : isSender ? '#22d3ee' : '#34d399',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <span style={{ fontSize: '12px' }}>{isCorrupted ? '⚠️' : isSender ? '⚡' : '🔍'}</span>
                  {isSender ? 'Sender Encapsulation' : 'Receiver FCS Check'}
                </div>
                <span style={{
                  fontSize: '9px',
                  fontFamily: 'monospace',
                  background: isSender ? 'rgba(6, 182, 212, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: isSender ? '#67e8f9' : '#6ee7b7',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  fontWeight: 700,
                }}>
                  {activePacket.protocol} #{activePacket.seqNum}
                </span>
              </div>

              {/* Encapsulation Field Values Grid */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '6px 8px',
                marginBottom: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                fontFamily: 'monospace',
                fontSize: '10px',
              }}>
                {/* 16-bit Internet Checksum Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94a3b8' }}>1's Comp Checksum:</span>
                  <span style={{ color: '#fbbf24', fontWeight: 700 }}>0x{activePacket.checksum}</span>
                </div>

                {/* CRC-32 Frame Check Sequence Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94a3b8' }}>CRC-32 (IEEE 802.3):</span>
                  <span style={{ color: isCorrupted ? '#f87171' : '#34d399', fontWeight: 700 }}>
                    0x{activePacket.crc.toUpperCase()}
                  </span>
                </div>

                {/* Encapsulated Header Field Snapshot */}
                <div style={{ fontSize: '9px', color: '#64748b', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '4px', marginTop: '2px' }}>
                  Src: {activePacket.sourceIP} ➔ Dst: {activePacket.destIP}
                </div>
              </div>

              {/* Error Detection & FCS Status Banner */}
              <div style={{
                fontSize: '9.5px',
                fontWeight: 700,
                padding: '4px 6px',
                borderRadius: '6px',
                background: isCorrupted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                color: isCorrupted ? '#fca5a5' : '#6ee7b7',
                border: `1px solid ${isCorrupted ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginBottom: '6px',
              }}>
                <span>{isCorrupted ? '❌' : '✓'}</span>
                <span>
                  {isCorrupted
                    ? 'CRC Remainder ≠ 0! Bit error detected. Frame discarded.'
                    : isSender
                    ? '16-bit Checksum & CRC-32 FCS generated & sealed.'
                    : 'FCS Remainder = 0. Frame integrity verified.'}
                </span>
              </div>

              {/* Networking Theory Details Toggle Button */}
              <button
                className="nodrag"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTheory(!showTheory);
                }}
                onDoubleClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  padding: '4px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '5px',
                  color: '#cbd5e1',
                  fontSize: '9px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'background 0.15s ease',
                }}
              >
                <span>Networking Theory Info</span>
                <span style={{ fontSize: '8px' }}>{showTheory ? '▲' : '▼'}</span>
              </button>

              {/* Expandable Theory Explanation Box */}
              {showTheory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{
                    marginTop: '6px',
                    paddingTop: '6px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    fontSize: '9px',
                    color: '#94a3b8',
                    lineHeight: 1.4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div>
                    <strong style={{ color: '#22d3ee' }}>Layer 3 IP Checksum:</strong> Calculated via 1's complement sum of 16-bit header words (RFC 1071). Recomputed by routers at every hop as TTL decrements.
                  </div>
                  <div>
                    <strong style={{ color: '#34d399' }}>Layer 2 CRC-32 FCS:</strong> Uses generator polynomial <em>G(x) = x³² + x²⁶ + ... + 1</em>. Hardware LFSR shift registers verify binary remainder <em>R(x) = 0</em>.
                  </div>
                  <div>
                    <strong style={{ color: '#fbbf24' }}>Error Detection vs Correction:</strong> Modern networks use <em>Error Detection (CRC)</em> + <em>ARQ Retransmission</em> because link BER is low enough that retransmission consumes far less bandwidth than heavy FEC codes.
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Default Port Flow Control on Canvas Node */}
        {connectedLinks.length > 0 && !isDisabled && (
          <div
            style={{
              marginTop: '6px',
              paddingTop: '6px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', pointerEvents: 'none' }}>
              Port Cut-off
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center' }}>
              {connectedLinks.map((l, idx) => {
                const peerId = l.source === device.id ? l.target : l.source;
                const peer = devices.find(d => d.id === peerId);
                const isActive = l.status === 'active';

                return (
                  <button
                    key={l.id}
                    className="nodrag"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLinkStatus(l.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                    }}
                    style={{
                      padding: '3px 6px',
                      borderRadius: '5px',
                      fontSize: '9px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
                      background: isActive ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.25)',
                      color: isActive ? '#34d399' : '#f87171',
                      fontFamily: 'monospace',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      transition: 'all 0.15s ease',
                      pointerEvents: 'auto',
                    }}
                    title={`Port #${idx + 1} (${peer?.label || 'Node'}): Click to ${isActive ? 'cut off' : 'start'} flow`}
                  >
                    <span>P{idx + 1}: {peer?.label ? peer.label.replace(/^(\w+)\s*#?/, '$1') : `Node${idx+1}`}</span>
                    <span style={{ fontSize: '10px' }}>{isActive ? '🟢' : '🔴'}</span>
                  </button>
                );
              })}
            </div>
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

      <style>{`
        @keyframes checksum-pulse {
          0% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.08); opacity: 0.45; }
          100% { transform: scale(1.18); opacity: 0; }
        }
      `}</style>
    </>
  );
});

DeviceNode.displayName = 'DeviceNode';
export default DeviceNode;
