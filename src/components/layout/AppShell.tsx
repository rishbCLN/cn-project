import React from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { BottomBar } from './BottomBar';
import { NetworkCanvas } from '../canvas/NetworkCanvas';
import { Notifications } from '../events/Notifications';
import { DevicePanel } from '../panels/DevicePanel';
import { LinkPanel } from '../panels/LinkPanel';
import { SendPacketPanel } from '../panels/SendPacket';
import { Inspector } from '../panels/Inspector';
import { StatsPanel } from '../dashboard/StatsPanel';
import { Timeline } from '../dashboard/Timeline';
import { useNetworkStore } from '../../stores/networkStore';
import { useUIStore } from '../../stores/uiStore';
import { motion } from 'framer-motion';

const panelTabs = [
  { key: 'send', label: '🚀 Send' },
  { key: 'inspector', label: '🔍 Inspect' },
  { key: 'stats', label: '📊 Stats' },
] as const;

export const AppShell: React.FC = () => {
  const selectedDeviceId = useNetworkStore(s => s.selectedDeviceId);
  const selectedLinkId = useNetworkStore(s => s.selectedLinkId);
  const activePanel = useUIStore(s => s.activePanel);
  const setPanel = useUIStore(s => s.setPanel);
  const showTimeline = useUIStore(s => s.showTimeline);
  const toggleTimeline = useUIStore(s => s.toggleTimeline);

  // Auto-open device/link panel when selected
  const effectivePanel = selectedDeviceId ? 'device'
    : selectedLinkId ? 'link'
    : activePanel;

  const renderPanel = () => {
    switch (effectivePanel) {
      case 'device': return <DevicePanel />;
      case 'link': return <LinkPanel />;
      case 'send': return <SendPacketPanel />;
      case 'inspector': return <Inspector />;
      case 'stats': return <StatsPanel />;
      default: return <SendPacketPanel />;
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', width: '100vw',
      background: 'var(--bg-primary)',
    }}>
      <TopBar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />

        {/* ─── Canvas ─── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <NetworkCanvas />
        </div>

        {/* ─── Right Panel ─── */}
        <div style={{
          width: '280px',
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-glass)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Tab bar */}
          <div style={{
            display: 'flex', borderBottom: '1px solid var(--border-glass)',
            padding: '0 4px',
          }}>
            {panelTabs.map(tab => {
              const isActive = effectivePanel === tab.key ||
                (effectivePanel === 'device' && tab.key === 'send') ||
                (effectivePanel === 'link' && tab.key === 'send');
              return (
                <motion.button
                  key={tab.key}
                  onClick={() => setPanel(tab.key as any)}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    flex: 1,
                    padding: '10px 4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: 'transparent',
                    border: 'none',
                    borderBottom: `2px solid ${
                      effectivePanel === tab.key ? 'var(--accent-cyan)' : 'transparent'
                    }`,
                    color: effectivePanel === tab.key ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.2s',
                  }}
                >
                  {tab.label}
                </motion.button>
              );
            })}
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {renderPanel()}
          </div>
        </div>
      </div>

      {/* ─── Timeline Section ─── */}
      {showTimeline && (
        <div style={{
          borderTop: '1px solid var(--border-glass)',
          background: 'var(--bg-secondary)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 16px',
            borderBottom: '1px solid var(--border-glass)',
          }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              Event Timeline
            </span>
            <motion.button
              onClick={toggleTimeline}
              whileHover={{ scale: 1.1 }}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: '14px',
              }}
            >
              ▾
            </motion.button>
          </div>
          <Timeline />
        </div>
      )}

      <BottomBar />
      <Notifications />
    </div>
  );
};
