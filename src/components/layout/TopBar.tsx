import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { useUIStore } from '../../stores/uiStore';

export const TopBar: React.FC = () => {
  const saveProject = useNetworkStore(s => s.saveProject);
  const loadProject = useNetworkStore(s => s.loadProject);
  const getProjectJSON = useNetworkStore(s => s.getProjectJSON);
  const resetSim = useNetworkStore(s => s.resetSim);
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
        <TopBarBtn label="Map" active={showMinimap} onClick={toggleMinimap} />
        <div style={{ width: '1px', height: '20px', background: 'var(--border-glass)', margin: '0 6px' }} />
        <TopBarBtn label="💾 Save" onClick={handleSave} />
        <TopBarBtn label="📂 Load" onClick={handleLoad} />
        <TopBarBtn label="🔄 Reset" onClick={resetSim} />
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
