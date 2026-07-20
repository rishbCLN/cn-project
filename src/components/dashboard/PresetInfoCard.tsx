import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNetworkStore, PresetKey } from '../../stores/networkStore';

export interface PresetInfo {
  title: string;
  badge: string;
  eli5: string;
  theory: string;
  bullets: string[];
}

export const PRESET_DETAILS: Record<PresetKey, PresetInfo> = {
  congestion: {
    title: 'Bottleneck & Queue Delay Simulation',
    badge: 'Layer 3 Queueing Theory',
    eli5: '💡 ELI5 / Plain English: Imagine a 4-lane highway merging into a narrow 1-lane bridge. Cars (packets) arrive faster than the bridge can clear them, forming a bumper-to-bumper line (router queue). If the line gets too long, extra cars get turned away (packet drops)!',
    theory: '🎓 Computer Network Theory: Demonstrates M/M/1 queueing delay (T_queue = [ρ / (1 - ρ)] × T_trans). As link utilization (ρ) approaches 1.0, packet buffer queue occupancy grows rapidly, causing high latency spikes and tail-drop packet loss.',
    bullets: [
      '⚙️ Setup: 10 Mbps bottleneck link between Server #1 & Router #1 with 75% background congestion.',
      '📊 Telemetry Proof: T_trans = L / R increases, causing T_queue to spike as buffer queue occupancy increases in Stats.',
      '🧪 Interactive Action: Click "Start Simulation" to send packets and watch Buffer Queue load rise up to 100% in Device Panel.'
    ],
  },
  retransmission: {
    title: 'Loss & TCP Retransmission Simulation',
    badge: 'Layer 4 Reliability',
    eli5: '💡 ELI5 / Plain English: Imagine mailing letters during a storm. Some letters blow away (packet loss), while others get soaked with ink so the receiver cannot read them (corruption). The receiver refuses to sign the delivery receipt (ACK), so the sender mails a fresh copy!',
    theory: '🎓 Computer Network Theory: Demonstrates Layer-4 TCP Reliability (ARQ protocol), RTO (Retransmission TimeOut), and CRC-32 Frame Check Sequence (FCS) verification. Corrupted packets trigger checksum failures and forced retransmissions.',
    bullets: [
      '⚙️ Setup: 40% Packet Loss rate + 20% Corrupt Payload rate with 2x Latency Multiplier.',
      '📊 Telemetry Proof: Corrupted frames highlight in red in the Hex Dump with [CRC-32: ✕ CORRUPTED], incrementing the Retransmit metric.',
      '🧪 Interactive Action: Click any corrupted packet to open the Inspector panel and verify Layer-4 CRC checksum failures.'
    ],
  },
  mesh_routing: {
    title: 'Dijkstra Multi-Hop OSPF Routing',
    badge: 'Layer 3 Pathfinding',
    eli5: '💡 ELI5 / Plain English: Imagine Google Maps finding the fastest driving route to your friend\'s house. It avoids slow dirt roads (high cost links) and picks the fast highway (low cost links). If a bridge collapses, Google Maps instantly reroutes you!',
    theory: '🎓 Computer Network Theory: Demonstrates Dijkstra\'s Algorithm (G = (V, E) shortest path tree) used in OSPF (Open Shortest Path First) routing. Routers dynamically calculate the path with the lowest cumulative link metric cost.',
    bullets: [
      '⚙️ Setup: 5-Node mesh network with dual routes (Top Path A cost = 3 vs Bottom Path B cost = 6).',
      '📊 Telemetry Proof: Dijkstra algorithm computes lowest accumulated link weight and routes packets via Router #1.',
      '🧪 Interactive Action: Click "Sever Link" on Link L1 to force instant OSPF failover to Path B via Router #2.'
    ],
  },
  star_topology: {
    title: 'Star LAN & Subnet Local Broadcast',
    badge: 'Layer 2 Switching',
    eli5: '💡 ELI5 / Plain English: Imagine a mail room in an office building. When worker A sends a letter to worker B, the central clerk (Switch) checks worker B\'s desk number (MAC address) and delivers it straight to them without bothering anyone else!',
    theory: '🎓 Computer Network Theory: Demonstrates Layer-2 Data Link Switching, MAC Address Table Learning (CAM Table), ARP Table Resolution, and Broadcast Domain containment in IEEE 802.3 Ethernet local area networks.',
    bullets: [
      '⚙️ Setup: Central Switch #1 connecting 3 workstation PCs to a high-capacity 1 Gbps Server #1 link.',
      '📊 Telemetry Proof: Switch maps incoming source MAC addresses (e.g. 00:50:56:C0:00:10) to specific ingress ports.',
      '🧪 Interactive Action: Send a packet from PC #1 to Server #1 and check MAC & ARP entries in the Device Inspector.'
    ],
  },
  ring_redundancy: {
    title: 'Ring Topology & Distance-Vector Failover',
    badge: 'Layer 3 RIP Failover',
    eli5: '💡 ELI5 / Plain English: Imagine a circular subway line with 4 stations. Trains can travel clockwise or counter-clockwise. If track maintenance closes the clockwise tunnel, trains reverse direction so passengers still reach their station!',
    theory: '🎓 Computer Network Theory: Demonstrates Distance-Vector Routing (Bellman-Ford / RIP algorithm) with split-horizon convergence, periodic distance vector updates, and automatic ring topology failover.',
    bullets: [
      '⚙️ Setup: 4 Routers in a closed loop ring (R1 ↔ R2 ↔ R3 ↔ R4 ↔ R1) connecting PC #1 to Server #1.',
      '📊 Telemetry Proof: Bellman-Ford initial metric is 2 hops (R1 ➔ R2 ➔ R3). Severing L2 forces metric updates via R4 (R1 ➔ R4 ➔ R3).',
      '🧪 Interactive Action: Sever Link L2 (R1 ↔ R2) during live traffic to watch Bellman-Ford automatically reroute packets via Router #4.'
    ],
  },
  high_latency_sat: {
    title: 'Geostationary Satellite Link (High BDP)',
    badge: 'Layer 3/4 Space Comms',
    eli5: '💡 ELI5 / Plain English: Imagine a long garden hose stretched across a football field. When you turn on the tap, water takes 5 seconds to travel down the long hose. A huge amount of water is trapped inside the hose while in transit!',
    theory: '🎓 Computer Network Theory: Demonstrates Bandwidth-Delay Product (BDP = Bandwidth × RTT) and TCP Sliding Window scaling over Geostationary Earth Orbit (GEO) satellite links with high propagation delays.',
    bullets: [
      '⚙️ Setup: Geostationary satellite transceiver link with 350ms propagation delay (4x Latency Multiplier, RTT > 1400ms).',
      '📊 Telemetry Proof: BDP exceeds 35 Kbits; T_prop dominates total latency in Live Network Theory Telemetry.',
      '🧪 Interactive Action: Monitor "Live Network Theory Telemetry" in Stats to see BDP and Channel Efficiency η values.'
    ],
  },
};

export const PresetInfoCard: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const activePreset = useNetworkStore(s => s.activePreset);
  const [collapsed, setCollapsed] = useState(false);
  const [showTheory, setShowTheory] = useState(false);

  if (!activePreset || !PRESET_DETAILS[activePreset]) return null;

  const info = PRESET_DETAILS[activePreset];

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: compact ? 'default' : 'grab',
        paddingBottom: collapsed ? '0px' : '6px',
        borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {!compact && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'grab' }} title="Drag to move">
              ⠿
            </span>
          )}
          <span style={{
            background: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#10b981',
            fontSize: '10px',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {info.badge}
          </span>
          <div style={{
            fontSize: compact ? '12px' : '14px',
            fontWeight: 800,
            color: '#f8fafc',
            fontFamily: 'Inter, sans-serif',
          }}>
            {info.title}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {!compact && (
            <button
              onClick={() => setShowTheory(!showTheory)}
              style={{
                background: showTheory ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                border: `1px solid ${showTheory ? '#3b82f6' : 'rgba(255, 255, 255, 0.15)'}`,
                color: showTheory ? '#60a5fa' : 'var(--text-muted)',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              title="Toggle Theory vs ELI5"
            >
              {showTheory ? '📖 ELI5 Mode' : '🎓 CS Theory Mode'}
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: '12px', padding: '2px 6px',
            }}
            title={collapsed ? 'Expand details' : 'Collapse details'}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* ELI5 / CS Theory Explanation Box */}
          <div style={{
            background: showTheory ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)',
            border: `1px solid ${showTheory ? 'rgba(59, 130, 246, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
            borderRadius: '8px',
            padding: '10px 12px',
            lineHeight: '1.5',
            color: '#e2e8f0',
            fontSize: '11.5px',
          }}>
            {showTheory ? info.theory : info.eli5}
          </div>

          {/* Bullet points */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '6px',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '10px 12px', borderRadius: '8px',
            borderLeft: '3px solid #10b981',
          }}>
            {info.bullets.map((bullet, idx) => (
              <div key={idx} style={{ lineHeight: '1.45', color: '#cbd5e1' }}>
                {bullet}
              </div>
            ))}
          </div>

          {!compact && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px',
              fontFamily: 'monospace',
            }}>
              <span>⠿ Drag header bar to move</span>
              <span>⇲ Drag bottom-right corner to resize</span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );

  // If compact (in Sidebar), render fixed
  if (compact) {
    return (
      <div style={{
        background: 'rgba(10, 14, 26, 0.95)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: '10px',
        padding: '10px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}>
        {content}
      </div>
    );
  }

  // If on Canvas, render Movable & Resizable Framer Motion Card
  return (
    <AnimatePresence>
      <motion.div
        drag
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          background: 'rgba(10, 14, 26, 0.94)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '14px',
          padding: '14px 16px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 24px rgba(16, 185, 129, 0.2)',
          resize: 'both',
          overflow: 'auto',
          minWidth: '360px',
          maxWidth: '640px',
          minHeight: '120px',
          maxHeight: '520px',
        }}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
};
