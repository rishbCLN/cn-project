import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { useUIStore } from '../../stores/uiStore';

export const TopBar: React.FC = () => {
  const saveProject = useNetworkStore(s => s.saveProject);
  const loadProject = useNetworkStore(s => s.loadProject);
  const loadPresetScenario = useNetworkStore(s => s.loadPresetScenario);
  const activePreset = useNetworkStore(s => s.activePreset);
  const getProjectJSON = useNetworkStore(s => s.getProjectJSON);
  const resetWorkspace = useNetworkStore(s => s.resetWorkspace);
  const toggleMinimap = useUIStore(s => s.toggleMinimap);
  const showMinimap = useUIStore(s => s.showMinimap);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div style={{
      height: '52px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-glass)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '28px', height: '28px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', fontWeight: 900, color: 'white',
        }}>
          P
        </div>
        <span style={{
          fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
        }}>
          PacketFlow
        </span>
        <span style={{
          fontSize: '15px', fontWeight: 300, color: 'var(--text-muted)',
        }}>
          Studio
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
            padding: '6px 12px',
            fontSize: '12px',
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
        <div style={{ width: '1px', height: '20px', background: 'var(--border-glass)', margin: '0 6px' }} />
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
      borderRadius: '8px',
      padding: '6px 12px',
      fontSize: '12px',
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
