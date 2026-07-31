import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { useUIStore } from '../../stores/uiStore';
import { formatMs } from '../../utils/helpers';

export const TopBar: React.FC = () => {
  const saveProject = useNetworkStore(s => s.saveProject);
  const loadProject = useNetworkStore(s => s.loadProject);
  const loadPresetScenario = useNetworkStore(s => s.loadPresetScenario);
  const activePreset = useNetworkStore(s => s.activePreset);
  const getProjectJSON = useNetworkStore(s => s.getProjectJSON);
  const resetWorkspace = useNetworkStore(s => s.resetWorkspace);
  const toggleMinimap = useUIStore(s => s.toggleMinimap);
  const showMinimap = useUIStore(s => s.showMinimap);
  const pushNotification = useUIStore(s => s.pushNotification);

  /* ─── Simulation Store State ─── */
  const simState = useNetworkStore(s => s.simState);
  const simConfig = useNetworkStore(s => s.simConfig);
  const metrics = useNetworkStore(s => s.metrics);
  const activePackets = useNetworkStore(s => s.activePackets);
  const startSim = useNetworkStore(s => s.startSim);
  const pauseSim = useNetworkStore(s => s.pauseSim);
  const stopSim = useNetworkStore(s => s.stopSim);
  const resetSim = useNetworkStore(s => s.resetSim);
  const setSpeed = useNetworkStore(s => s.setSpeed);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<number | null>(null);

  // Auto-advance packets when simulation is running
  useEffect(() => {
    if (simState !== 'running') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const delay = 2500 / simConfig.speed;
    intervalRef.current = window.setInterval(() => {
      const state = useNetworkStore.getState();
      const packets = state.activePackets;

      if (packets.length === 0) {
        if (state.lastPacketConfig) {
          state.sendPacket(
            state.lastPacketConfig.srcId,
            state.lastPacketConfig.dstId,
            state.lastPacketConfig.protocol,
            state.lastPacketConfig.size
          );
        } else {
          state.pauseSim();
        }
        return;
      }

      packets.forEach((p, index) => {
        if (p.status === 'in-transit' || p.status === 'created') {
          setTimeout(() => {
            const currentState = useNetworkStore.getState();
            if (currentState.simState === 'running') {
              currentState.advancePacket(p.id);

              const latestEvents = useNetworkStore.getState().events;
              const last = latestEvents[latestEvents.length - 1];
              if (last && (
                last.type === 'packet_dropped' ||
                last.type === 'packet_corrupted' ||
                last.type === 'crc_fail' ||
                last.type === 'packet_delivered' ||
                last.type === 'retransmission'
              )) {
                pushNotification(last.description, last.type);
              }
            }
          }, index * 250);
        }
      });
    }, delay);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [simState, simConfig.speed, pushNotification]);

  const handleStep = () => {
    const { activePackets: packets, advancePacket } = useNetworkStore.getState();
    for (const p of packets) {
      if (p.status === 'in-transit' || p.status === 'created') {
        advancePacket(p.id);
        break;
      }
    }
  };

  const handleSave = () => {
    const json = getProjectJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'packetflow-project.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = ev.target?.result as string;
      loadProject(json);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const speeds = [0.25, 0.5, 1, 2, 4];

  return (
    <div style={{
      height: '52px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-glass)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      zIndex: 50,
      gap: '12px',
    }}>
      {/* ─── Left Section: Logo + Playback & Speed Controls + Stats ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div style={{
            width: '28px', height: '28px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 900, color: 'white',
          }}>
            P
          </div>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            PacketFlow
          </span>
          <span style={{ fontSize: '15px', fontWeight: 300, color: 'var(--text-muted)' }}>
            Studio
          </span>
        </div>

        {/* Vertical Divider */}
        <div style={{ width: '1px', height: '22px', background: 'var(--border-glass)', flexShrink: 0 }} />

        {/* Playback Controls (Play / Pause / Step / Reset) */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
          {simState === 'running' ? (
            <ControlBtn icon="⏸" label="Pause" onClick={pauseSim} />
          ) : (
            <ControlBtn icon="▶" label="Play" onClick={startSim} accent />
          )}
          <ControlBtn icon="⏹" label="Stop" onClick={stopSim} />
          <ControlBtn icon="⏭" label="Step" onClick={handleStep} />
          <ControlBtn icon="↺" label="Reset Sim" onClick={resetSim} />
        </div>

        {/* Speed Selector Pills */}
        <div style={{
          display: 'flex', gap: '2px', alignItems: 'center',
          background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '2px', flexShrink: 0
        }}>
          {speeds.map(s => (
            <motion.button
              key={s}
              onClick={() => setSpeed(s)}
              whileTap={{ scale: 0.9 }}
              style={{
                padding: '2px 6px',
                borderRadius: '6px',
                fontSize: '10.5px',
                fontWeight: 700,
                fontFamily: 'monospace',
                cursor: 'pointer',
                border: 'none',
                background: simConfig.speed === s ? 'var(--accent-cyan)' : 'transparent',
                color: simConfig.speed === s ? 'white' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              {s}x
            </motion.button>
          ))}
        </div>

        {/* Status Indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0,
          color: simState === 'running' ? '#10b981' : 'var(--text-muted)',
        }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: simState === 'running' ? '#10b981' : simState === 'paused' ? '#f59e0b' : '#64748b',
            boxShadow: simState === 'running' ? '0 0 8px #10b981' : 'none',
          }} />
          <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '9.5px', letterSpacing: '0.05em' }}>
            {simState}
          </span>
        </div>

        {/* Vertical Divider */}
        <div style={{ width: '1px', height: '22px', background: 'var(--border-glass)', flexShrink: 0 }} />

        {/* Quick Stats Bar */}
        <div style={{
          display: 'flex', gap: '12px', color: 'var(--text-secondary)',
          overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 1, minWidth: 0
        }}>
          <QuickStat label="Sent" value={String(metrics.sent)} color="#3b82f6" />
          <QuickStat label="Delivered" value={String(metrics.delivered)} color="#10b981" />
          <QuickStat label="Lost" value={String(metrics.lost)} color="#ef4444" />
          <QuickStat label="RTT" value={formatMs(metrics.avgRTT)} color="#f59e0b" />
          <QuickStat label="Delivery" value={`${metrics.deliveryRate.toFixed(0)}%`} color="#06b6d4" />
          <QuickStat label="Active" value={String(activePackets.length)} color="#8b5cf6" />
        </div>
      </div>

      {/* ─── Right Section: Demo Presets & Actions ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {/* Presets Select Dropdown */}
        <select
          value={activePreset ?? ''}
          onChange={(e) => {
            if (e.target.value) {
              loadPresetScenario(e.target.value as any);
            }
          }}
          style={{
            background: activePreset ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.1)',
            border: `1.5px solid ${activePreset ? '#10b981' : 'rgba(16, 185, 129, 0.3)'}`,
            boxShadow: activePreset ? '0 0 14px rgba(16, 185, 129, 0.3)' : 'none',
            borderRadius: '8px',
            padding: '5px 10px',
            fontSize: '11.5px',
            fontWeight: 700,
            color: '#10b981',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            outline: 'none',
            transition: 'all 0.25s ease',
          }}
        >
          <option value="" disabled>⚡ Select Demo Preset…</option>
          <option value="congestion" style={{ background: '#111827', color: '#f8fafc' }}>⚡ Bottleneck & Queue Delay</option>
          <option value="retransmission" style={{ background: '#111827', color: '#f8fafc' }}>⚡ Loss & TCP Retransmission</option>
          <option value="mesh_routing" style={{ background: '#111827', color: '#f8fafc' }}>⚡ Dijkstra Multi-Hop Routing</option>
          <option value="star_topology" style={{ background: '#111827', color: '#f8fafc' }}>⚡ Star LAN (Subnet Broadcast)</option>
          <option value="ring_redundancy" style={{ background: '#111827', color: '#f8fafc' }}>⚡ Ring Topology (RIP Failover)</option>
          <option value="high_latency_sat" style={{ background: '#111827', color: '#f8fafc' }}>⚡ Satellite Link (High BDP)</option>
        </select>

        <TopBarBtn label="Map" active={showMinimap} onClick={toggleMinimap} />
        <div style={{ width: '1px', height: '20px', background: 'var(--border-glass)', margin: '0 2px' }} />
        <TopBarBtn label="💾 Save" onClick={handleSave} />
        <TopBarBtn label="📂 Load" onClick={handleLoad} />
        <TopBarBtn label="🔄 Reset" onClick={resetWorkspace} />
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};

const ControlBtn: React.FC<{
  icon: string; label: string; onClick: () => void; accent?: boolean;
}> = ({ icon, label, onClick, accent }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    title={label}
    style={{
      width: '28px', height: '28px',
      borderRadius: '7px',
      border: 'none',
      background: accent ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
      color: accent ? 'white' : 'var(--text-secondary)',
      fontSize: '13px',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background 0.2s',
    }}
  >
    {icon}
  </motion.button>
);

const QuickStat: React.FC<{
  label: string; value: string; color: string;
}> = ({ label, value, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
    <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{label}</span>
    <span style={{ fontSize: '11px', fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</span>
  </div>
);

const TopBarBtn: React.FC<{
  label: string;
  onClick: () => void;
  active?: boolean;
}> = ({ label, onClick, active }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    style={{
      background: active ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-tertiary)',
      border: `1px solid ${active ? 'rgba(6, 182, 212, 0.3)' : 'var(--border-glass)'}`,
      borderRadius: '7px',
      padding: '5px 10px',
      fontSize: '11.5px',
      color: active ? '#06b6d4' : 'var(--text-secondary)',
      cursor: 'pointer',
      fontFamily: 'Inter, sans-serif',
      fontWeight: 500,
      transition: 'all 0.2s',
    }}
  >
    {label}
  </motion.button>
);

