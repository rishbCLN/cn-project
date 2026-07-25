import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNetworkStore, PresetKey } from '../../stores/networkStore';

export interface PresetInfo {
  title: string;
  badge: string;
  eli5: string;
  theory: string;
  whyThisPreset: string;
  whyThisSetup: string;
  whatToObserve: string;
  bullets: string[];
}

export const PRESET_DETAILS: Record<PresetKey, PresetInfo> = {
  congestion: {
    title: 'Bottleneck & Queue Delay Simulation',
    badge: 'Layer 3 Queueing Theory',
    eli5: '💡 ELI5 / Plain English: Imagine a 4-lane highway merging into a narrow 1-lane bridge. Cars (packets) arrive faster than the bridge can clear them, forming a bumper-to-bumper line (router queue). If the line gets too long, extra cars get turned away (packet drops)!',
    theory: '🎓 Computer Network Theory: Demonstrates M/M/1 queueing delay (T_queue = [ρ / (1 - ρ)] × T_trans). As link utilization (ρ) approaches 1.0, packet buffer queue occupancy grows rapidly, causing high latency spikes and tail-drop packet loss.',
    whyThisPreset: '🎯 Why This Preset? In real-world networks, ISPs connect high-speed local networks (1 Gbps) to slower WAN internet links (10 Mbps). This rate mismatch causes packets to pile up in router buffers. This scenario models bufferbloat and M/M/1 queuing behavior under heavy traffic load.',
    whyThisSetup: '⚙️ Why This Setup? We placed Server #1 on a fast 100 Mbps link to Router #1, but restricted the link from Router #1 to PC #1 to 10 Mbps with 75% background traffic. This guarantees that Router #1\'s buffer queue fills rapidly when Server #1 transmits data.',
    whatToObserve: '📊 What Do We Expect to Observe? Watch Buffer Queue Occupancy in the Device Panel rise from 0/64 to 64/64 Packets (100% capacity). In Stats, watch Queueing Delay (T_queue) increase from <1ms to >15ms. When full, observe dropped packet alerts firing red pulses.',
    bullets: [
      '⚡ Rate Mismatch: Server transmits faster than the 10 Mbps bottleneck link can forward.',
      '📈 Queue Surge: Router #1 buffer load rises to 100% capacity, triggering tail-drop losses.',
      '🧪 Test Action: Click "Start Simulation" to send packets and watch Buffer Queue load rise in Device Panel.'
    ],
  },
  retransmission: {
    title: 'Loss & TCP Retransmission Simulation',
    badge: 'Layer 4 Reliability',
    eli5: '💡 ELI5 / Plain English: Imagine mailing letters during a storm. Some letters blow away (packet loss), while others get soaked with ink so the receiver cannot read them (corruption). The receiver refuses to sign the delivery receipt (ACK), so the sender mails a fresh copy!',
    theory: '🎓 Computer Network Theory: Demonstrates Layer-4 TCP Reliability (ARQ protocol), RTO (Retransmission TimeOut), and CRC-32 Frame Check Sequence (FCS) verification. Corrupted packets trigger checksum failures and forced retransmissions.',
    whyThisPreset: '🎯 Why This Preset? Physical network channels (Wi-Fi, satellite, noisy copper cables) suffer from interference and signal degradation. This scenario proves how TCP guarantees 100% reliable delivery over an unreliable physical layer using ARQ and CRC-32 checksums.',
    whyThisSetup: '⚙️ Why This Setup? We configured a 40% Packet Loss rate (simulating severe wireless dropouts) and a 20% Payload Corruption rate (simulating bit flips), combined with a 2x Latency Multiplier to ensure packets drop or fail checksum checks during transit.',
    whatToObserve: '📊 What Do We Expect to Observe? Click any corrupted frame in the Inspector: observe raw hex bytes highlighted in red with [CRC-32: ✕ CORRUPTED]. Watch TCP ACK timeout events in the Event Log trigger automatic packet retransmissions until delivery succeeds.',
    bullets: [
      '🛡️ TCP Reliability: Proves how Stop-and-Wait ARQ recovers missing packets automatically.',
      '🔬 Hex Verification: Inspector highlights corrupted bytes failing 32-bit CRC validation.',
      '🧪 Test Action: Inspect dropped/corrupted frames in the Inspector panel to verify Layer-4 CRC checksum failures.'
    ],
  },
  mesh_routing: {
    title: 'Dijkstra Multi-Hop OSPF Routing',
    badge: 'Layer 3 Pathfinding',
    eli5: '💡 ELI5 / Plain English: Imagine Google Maps finding the fastest driving route to your friend\'s house. It avoids slow dirt roads (high cost links) and picks the fast highway (low cost links). If a bridge collapses, Google Maps instantly reroutes you!',
    theory: '🎓 Computer Network Theory: Demonstrates Dijkstra\'s Algorithm (G = (V, E) shortest path tree) used in OSPF (Open Shortest Path First) routing. Routers dynamically calculate the path with the lowest cumulative link metric cost.',
    whyThisPreset: '🎯 Why This Preset? The Internet relies on mesh networks with multiple redundant paths. Routers run Link-State algorithms (OSPF) to discover the shortest path and automatically reroute traffic around network failures without human intervention.',
    whyThisSetup: '⚙️ Why This Setup? We constructed a 5-node mesh network with two distinct paths: Top Path A (PC1 ➔ R1 ➔ R3 ➔ S1) with a low cost metric of 3, and Bottom Path B (PC1 ➔ R2 ➔ R3 ➔ S1) with a higher cost metric of 6.',
    whatToObserve: '📊 What Do We Expect to Observe? Packets initially take Top Path A via Router #1. When you click "Sever Link" on Link L1, observe Dijkstra\'s algorithm instantly recompute routing tables and divert active traffic through Router #2 (Bottom Path B).',
    bullets: [
      '🧮 Cost Pathfinding: Dijkstra selects Path A (Cost 3) over Path B (Cost 6).',
      '🔄 Dynamic Failover: Severing Link L1 causes instant path recomputation to Path B via Router #2.',
      '🧪 Test Action: Click "Sever Link" on Link L1 to force instant OSPF failover to Path B via Router #2.'
    ],
  },
  star_topology: {
    title: 'Star LAN & Subnet Local Broadcast',
    badge: 'Layer 2 Switching',
    eli5: '💡 ELI5 / Plain English: Imagine a mail room in an office building. When worker A sends a letter to worker B, the central clerk (Switch) checks worker B\'s desk number (MAC address) and delivers it straight to them without bothering anyone else!',
    theory: '🎓 Computer Network Theory: Demonstrates Layer-2 Data Link Switching, MAC Address Table Learning (CAM Table), ARP Table Resolution, and Broadcast Domain containment in IEEE 802.3 Ethernet local area networks.',
    whyThisPreset: '🎯 Why This Preset? Star topologies are the universal standard for Local Area Networks (LANs). A central Layer-2 Switch forwards traffic directly to destination devices based on MAC addresses, isolating collision domains.',
    whyThisSetup: '⚙️ Why This Setup? We placed a central Layer-2 Switch #1 connected to 3 Workstation PCs (PC #1, PC #2, PC #3) and a high-capacity 1 Gbps Server #1. This mimics a real office subnet communicating with a shared server.',
    whatToObserve: '📊 What Do We Expect to Observe? Inspect transmitted frames: observe Layer-2 Ethernet II headers containing exact Source MAC (00:50:56:C0:00:10) and Destination MAC addresses. Packets flow directly PC #1 ➔ Switch #1 ➔ Server #1 without flooding other PCs.',
    bullets: [
      '🏢 Office Subnet Model: Central switch connects workstations to a dedicated server uplink.',
      '🏷️ MAC Table Learning: Switch isolates traffic to target ports using hardware MAC addresses.',
      '🧪 Test Action: Send a packet from PC #1 to Server #1 and check MAC & ARP entries in Device Inspector.'
    ],
  },
  ring_redundancy: {
    title: 'Ring Topology & Distance-Vector Failover',
    badge: 'Layer 3 RIP Failover',
    eli5: '💡 ELI5 / Plain English: Imagine a circular subway line with 4 stations. Trains can travel clockwise or counter-clockwise. If track maintenance closes the clockwise tunnel, trains reverse direction so passengers still reach their station!',
    theory: '🎓 Computer Network Theory: Demonstrates Distance-Vector Routing (Bellman-Ford / RIP algorithm) with split-horizon convergence, periodic distance vector updates, and automatic ring topology failover.',
    whyThisPreset: '🎯 Why This Preset? Ring topologies are widely used in enterprise MAN backbones and industrial systems (SONET/SDH) to prevent single points of failure. This preset demonstrates Distance-Vector (Bellman-Ford / RIP) convergence during link breaks.',
    whyThisSetup: '⚙️ Why This Setup? We arranged 4 Routers (R1, R2, R3, R4) in a closed loop ring connecting PC #1 to Server #1. Both top route (R1 ➔ R2 ➔ R3) and bottom route (R1 ➔ R4 ➔ R3) initially offer equal 2-hop distances.',
    whatToObserve: '📊 What Do We Expect to Observe? Initial traffic flows through top path via Router #2. Severing Link L2 (R1 ↔ R2) forces Bellman-Ford distance-vector updates, immediately shifting traffic counter-clockwise through Router #4 without session loss.',
    bullets: [
      '🔄 Ring Redundancy: Closed loop guarantees alternative routing paths during physical cable breaks.',
      '📊 Bellman-Ford RIP: Hop-count metric updates from 2 hops via R2 to 2 hops counter-clockwise via R4.',
      '🧪 Test Action: Sever Link L2 (R1 ↔ R2) during live traffic to watch Bellman-Ford automatically reroute packets via Router #4.'
    ],
  },
  high_latency_sat: {
    title: 'Geostationary Satellite Link (High BDP)',
    badge: 'Layer 3/4 Space Comms',
    eli5: '💡 ELI5 / Plain English: Imagine a long garden hose stretched across a football field. When you turn on the tap, water takes 5 seconds to travel down the long hose. A huge amount of water is trapped inside the hose while in transit!',
    theory: '🎓 Computer Network Theory: Demonstrates Bandwidth-Delay Product (BDP = Bandwidth × RTT) and TCP Sliding Window scaling over Geostationary Earth Orbit (GEO) satellite links with high propagation delays.',
    whyThisPreset: '🎯 Why This Preset? GEO satellites sit 35,786 km above Earth, creating massive propagation delays (350ms–700ms RTT). This preset models high latency and shows why Bandwidth-Delay Product (BDP) buffering is required for space communications.',
    whyThisSetup: '⚙️ Why This Setup? We created a satellite link with 350ms base propagation delay and 4x Latency Multiplier (total RTT > 1400ms) between a Ground Station and a Sat Transceiver.',
    whatToObserve: '📊 What Do We Expect to Observe? In Stats, observe Propagation Delay (T_prop) climb over 1400ms (>95% of total latency). Observe BDP reach over 35 Kbits, proving tens of kilobytes of data remain in-flight inside the satellite pipe simultaneously.',
    bullets: [
      '🛰️ Space Latency: GEO propagation delay T_prop (>1400ms RTT) dominates total end-to-end latency.',
      '📦 BDP Expansion: Bandwidth-Delay Product exceeds 35 Kbits in-flight capacity.',
      '🧪 Test Action: Monitor "Live Network Theory Telemetry" in Stats to see BDP and Channel Efficiency η values.'
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

      {/* Body Container - Scrollable */}
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
            gap: '10px',
            maxHeight: compact ? '260px' : '340px',
            overflowY: 'auto',
            paddingRight: '6px',
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

          {/* 🎯 Why This Preset? */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '8px 10px',
            lineHeight: '1.45',
            color: '#cbd5e1',
          }}>
            <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '3px' }}>
              {info.whyThisPreset}
            </div>
          </div>

          {/* ⚙️ Why This Setup? */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '8px 10px',
            lineHeight: '1.45',
            color: '#cbd5e1',
          }}>
            <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: '3px' }}>
              {info.whyThisSetup}
            </div>
          </div>

          {/* 📊 What Do We Expect to Observe? */}
          <div style={{
            background: 'rgba(16, 185, 129, 0.04)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '8px',
            padding: '8px 10px',
            lineHeight: '1.45',
            color: '#a7f3d0',
          }}>
            <div style={{ fontWeight: 700, color: '#10b981', marginBottom: '3px' }}>
              {info.whatToObserve}
            </div>
          </div>

          {/* Key Bullet Points */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '6px',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '10px 12px', borderRadius: '8px',
            borderLeft: '3px solid #10b981',
          }}>
            {info.bullets.map((bullet, idx) => (
              <div key={idx} style={{ lineHeight: '1.45', color: '#e2e8f0' }}>
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
          overflow: 'hidden',
          minWidth: '380px',
          maxWidth: '680px',
          minHeight: '140px',
          maxHeight: '560px',
        }}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
};
