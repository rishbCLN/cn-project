import React from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { useUIStore } from '../../stores/uiStore';
import { PROTOCOL_COLORS } from '../../utils/colors';
import { formatBytes, deviceMac } from '../../utils/helpers';

export const Inspector: React.FC = () => {
  const inspectedPacketId = useUIStore(s => s.inspectedPacketId);
  const packetHistory = useNetworkStore(s => s.packetHistory);
  const devices = useNetworkStore(s => s.devices);
  const setInspectedPacket = useUIStore(s => s.setInspectedPacket);

  const packet = packetHistory.find(p => p.id === inspectedPacketId);

  // If the inspected packet has aged out of the capped history, clear the stale
  // selection so we fall back to the history list instead of a blank dead-end.
  React.useEffect(() => {
    if (inspectedPacketId && !packet) setInspectedPacket(null);
  }, [inspectedPacketId, packet, setInspectedPacket]);

  // If no packet inspected, show packet history list
  if (!inspectedPacketId) {
    return (
      <div style={{ padding: '16px' }}>
        <div style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px',
        }}>
          Packet History
        </div>
        <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {packetHistory.length === 0 && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
              No packets sent yet
            </div>
          )}
          {packetHistory.filter(p => !p.isAck).slice(-30).reverse().map(p => (
            <motion.div
              key={p.id}
              onClick={() => setInspectedPacket(p.id)}
              whileHover={{ x: 2 }}
              style={{
                padding: '8px 10px',
                background: 'var(--bg-tertiary)',
                borderRadius: '8px',
                cursor: 'pointer',
                borderLeft: `3px solid ${PROTOCOL_COLORS[p.protocol]}`,
                fontSize: '11px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'var(--text-primary)' }}>
                #{p.seqNum} {p.protocol}
              </span>
              <span style={{
                fontSize: '10px',
                color: p.status === 'delivered' ? '#10b981'
                     : p.status === 'dropped' ? '#ef4444'
                     : p.status === 'corrupted' ? '#f59e0b'
                     : 'var(--text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}>
                {p.status}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (!packet) return null;

  // Resolve real endpoint devices so the frame dump reflects the actual topology.
  const srcDevice = devices.find(d => d.id === packet.sourceDeviceId);
  const dstDevice = devices.find(d => d.id === packet.destDeviceId);
  // Shared deterministic MAC so the same device shows one stable address
  // everywhere (Inspector frame dump, ARP table, CAM table).
  const srcMac = srcDevice ? deviceMac(srcDevice) : '02:00:00:00:00:00';
  const dstMac = dstDevice ? deviceMac(dstDevice) : '02:00:00:00:00:00';
  const protoHex = packet.protocol === 'TCP' ? '0x06 (TCP)'
    : packet.protocol === 'UDP' ? '0x11 (UDP)'
    : packet.protocol === 'ICMP' ? '0x01 (ICMP)'
    : '0x11 (UDP/DNS)';

  // ─── OSI 7-layer encapsulation model (Packet Tracer style) ───
  // Built from the real packet so header sizes and PDU names reflect it.
  const l4Proto = packet.protocol === 'TCP' ? 'TCP' : packet.protocol === 'ICMP' ? 'ICMP' : 'UDP';
  const l4HeaderBytes = packet.protocol === 'TCP' ? 20 : packet.protocol === 'ICMP' ? 8 : 8;
  const appProto = packet.protocol === 'DNS' ? 'DNS'
    : packet.protocol === 'ICMP' ? 'ICMP (diagnostic)'
    : packet.protocol === 'TCP' ? 'Application data (HTTP/TLS)'
    : 'Application data';
  const payloadBytes = Math.max(0, packet.size - 20 - l4HeaderBytes);
  const osiLayers = [
    { n: 7, name: 'Application', color: '#ec4899', pdu: 'Data',
      detail: `${appProto} · ${payloadBytes} B payload` },
    { n: 6, name: 'Presentation', color: '#d946ef', pdu: 'Data',
      detail: 'Encoding / serialization (ASCII, TLS records)' },
    { n: 5, name: 'Session', color: '#a855f7', pdu: 'Data',
      detail: packet.protocol === 'TCP' ? 'Session established (3-way handshake)' : 'Stateless — no session' },
    { n: 4, name: 'Transport', color: '#8b5cf6', pdu: packet.protocol === 'TCP' ? 'Segment' : 'Datagram',
      detail: `${l4Proto} · +${l4HeaderBytes} B hdr · ${packet.protocol === 'TCP' ? `seq ${packet.seqNum}, ack ${packet.ackNum}` : 'connectionless'}` },
    { n: 3, name: 'Network', color: '#3b82f6', pdu: 'Packet',
      detail: `IPv4 · +20 B hdr · ${packet.sourceIP} → ${packet.destIP} · TTL ${packet.ttl}` },
    { n: 2, name: 'Data Link', color: '#10b981', pdu: 'Frame',
      detail: `Ethernet II · +14 B hdr +4 B FCS · ${srcMac} → ${dstMac}` },
    { n: 1, name: 'Physical', color: '#64748b', pdu: 'Bits',
      detail: `${(packet.size + 18) * 8} bits on the wire · CRC-32 ${packet.crc}` },
  ];

  const rows = [
    ['Source IP', packet.sourceIP],
    ['Destination IP', packet.destIP],
    ['Protocol', packet.protocol],
    ['Size', formatBytes(packet.size)],
    ['TTL', String(packet.ttl)],
    ['Seq Number', String(packet.seqNum)],
    ['ACK Number', String(packet.ackNum)],
    ['Checksum', packet.checksum],
    ['CRC-32', packet.crc],
    ['CRC Valid', packet.crcValid ? '✓ PASS' : '✕ FAIL'],
    ['Status', packet.status.toUpperCase()],
    ['Hop Count', `${packet.currentHop} / ${packet.path.length - 1} (${packet.path.length} Nodes)`],
    ['Created', new Date(packet.createdAt).toLocaleTimeString()],
    ['Delivered', packet.deliveredAt ? new Date(packet.deliveredAt).toLocaleTimeString() : '—'],
    ['Exact RTT', packet.rttMs ? `${packet.rttMs.toFixed(2)} ms (${packet.path.length - 1} Hops)` : '—'],
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      style={{ padding: '16px' }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '16px',
      }}>
        <div style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Packet Inspector
        </div>
        <motion.button
          onClick={() => setInspectedPacket(null)}
          whileHover={{ scale: 1.1 }}
          style={{
            background: 'var(--bg-tertiary)', border: 'none', borderRadius: '6px',
            padding: '4px 8px', fontSize: '10px', color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          ← Back
        </motion.button>
      </div>

      {/* Protocol badge */}
      <div style={{
        textAlign: 'center', marginBottom: '16px',
        padding: '12px', borderRadius: '10px',
        background: `${PROTOCOL_COLORS[packet.protocol]}15`,
        border: `1px solid ${PROTOCOL_COLORS[packet.protocol]}30`,
      }}>
        <div style={{
          fontSize: '20px', fontWeight: 800, color: PROTOCOL_COLORS[packet.protocol],
          fontFamily: 'monospace',
        }}>
          {packet.protocol}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Packet #{packet.seqNum}
        </div>
      </div>

      {/* Path visualization */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Path
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          flexWrap: 'wrap', fontSize: '11px',
        }}>
          {packet.path.map((nodeId, i) => {
            const device = devices.find(d => d.id === nodeId);
            const isCurrent = i === packet.currentHop;
            return (
              <React.Fragment key={`${nodeId}-${i}`}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: isCurrent ? 'rgba(6,182,212,0.2)' : 'var(--bg-tertiary)',
                  border: isCurrent ? '1px solid rgba(6,182,212,0.4)' : '1px solid transparent',
                  color: isCurrent ? '#06b6d4' : 'var(--text-secondary)',
                  fontWeight: isCurrent ? 600 : 400,
                }}>
                  {device?.label ?? nodeId}
                </span>
                {i < packet.path.length - 1 && (
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Detail table */}
      <div style={{
        borderRadius: '10px', overflow: 'hidden',
        border: '1px solid var(--border-glass)',
        marginBottom: '16px',
      }}>
        {rows.map(([label, value], i) => (
          <div
            key={label}
            style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 12px',
              background: i % 2 === 0 ? 'var(--bg-tertiary)' : 'transparent',
              fontSize: '12px',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span style={{
              color: label === 'CRC Valid'
                ? (value === '✓ PASS' ? '#10b981' : '#ef4444')
                : 'var(--text-primary)',
              fontFamily: 'monospace',
              fontWeight: 500,
            }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* ─── Layer-2/3/4 Frame Dump (Hex Telemetry) ─── */}
      <div>
        <div style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px',
        }}>
          Layer-2/3/4 Frame Telemetry (Hex Dump)
        </div>
        <div style={{
          background: 'rgba(10, 14, 26, 0.95)',
          border: '1px solid var(--border-glass)',
          borderRadius: '10px',
          padding: '12px',
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#38bdf8',
          lineHeight: '1.6',
        }}>
          <div style={{ color: '#10b981', fontWeight: 700, marginBottom: '2px' }}>[L2 Ethernet II Frame]</div>
          <div>Dst MAC: {dstMac} {dstDevice ? `(${dstDevice.label})` : ''}</div>
          <div>Src MAC: {srcMac} {srcDevice ? `(${srcDevice.label})` : ''}</div>
          <div>EtherType: 0x0800 (IPv4)</div>

          <div style={{ color: '#3b82f6', fontWeight: 700, marginTop: '8px', marginBottom: '2px' }}>[L3 IPv4 Datagram Header]</div>
          <div>Ver/IHL: 0x45 | TOS: 0x00 | Len: {packet.size} Bytes</div>
          <div>ID: 0x{packet.seqNum.toString(16).padStart(4, '0')} | Flags: 0x4000 (DF) | TTL: {packet.ttl}</div>
          <div>Proto: {protoHex}</div>
          <div>Header Checksum: {packet.checksum}</div>
          <div>Src IP: {packet.sourceIP} ➔ Dst IP: {packet.destIP}</div>

          <div style={{ color: '#8b5cf6', fontWeight: 700, marginTop: '8px', marginBottom: '2px' }}>[L4 {packet.protocol} {packet.protocol === 'TCP' ? 'Segment' : 'Datagram'} Header]</div>
          {packet.protocol === 'TCP' ? (
            <>
              <div>Seq: 0x{packet.seqNum.toString(16).padStart(8, '0')} | Ack: 0x{packet.ackNum.toString(16).padStart(8, '0')}</div>
              <div>Window Size: 64240 Bytes | Flags: [{packet.isAck ? 'ACK' : 'ACK, PSH'}]</div>
            </>
          ) : packet.protocol === 'ICMP' ? (
            <>
              <div>Type: 8 (Echo Request) | Code: 0</div>
              <div>Identifier: 0x{packet.seqNum.toString(16).padStart(4, '0')} | Seq: {packet.seqNum}</div>
            </>
          ) : (
            <>
              <div>Src Port: {40000 + (packet.seqNum % 20000)} | Dst Port: {packet.protocol === 'DNS' ? 53 : 1024 + (packet.seqNum % 4000)}</div>
              <div>Length: {packet.size} Bytes | (connectionless, no ACK)</div>
            </>
          )}
          <div style={{
            color: packet.crcValid ? '#10b981' : '#ef4444',
            fontWeight: 700, marginTop: '6px',
            padding: '4px 8px', borderRadius: '4px',
            background: packet.crcValid ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${packet.crcValid ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            display: 'inline-block',
          }}>
            CRC-32 Checksum: {packet.crc} ({packet.crcValid ? '✓ PASS' : '✕ CORRUPTED'})
          </div>
        </div>
      </div>

      {/* ─── OSI 7-Layer Encapsulation Stack ─── */}
      <div style={{ marginTop: '16px' }}>
        <div style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px',
        }}>
          OSI Encapsulation (L7 → L1)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {osiLayers.map((layer, i) => (
            <motion.div
              key={layer.n}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                borderRadius: '7px',
                overflow: 'hidden',
                border: `1px solid ${layer.color}33`,
                background: `${layer.color}0e`,
                // Progressive indent visualizes each layer wrapping the one above.
                marginLeft: `${i * 6}px`,
              }}
            >
              <div style={{
                width: '26px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${layer.color}26`,
                color: layer.color, fontWeight: 800, fontSize: '12px',
                fontFamily: 'monospace',
              }}>
                {layer.n}
              </div>
              <div style={{ padding: '6px 9px', minWidth: 0, flex: 1 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
                }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {layer.name}
                  </span>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, fontFamily: 'monospace',
                    color: layer.color, background: `${layer.color}22`,
                    padding: '1px 6px', borderRadius: '4px', flexShrink: 0,
                  }}>
                    {layer.pdu}
                  </span>
                </div>
                <div style={{
                  fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace',
                  marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {layer.detail}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <div style={{
          fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '8px',
          textAlign: 'center', fontStyle: 'italic',
        }}>
          Each layer adds its header as the PDU descends the stack
        </div>
      </div>
    </motion.div>
  );
};
