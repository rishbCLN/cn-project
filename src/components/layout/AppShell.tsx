import React from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { NetworkCanvas } from '../canvas/NetworkCanvas';
import { Notifications } from '../events/Notifications';
import { KeyboardShortcuts } from '../events/KeyboardShortcuts';
import { DevicePanel } from '../panels/DevicePanel';
import { LinkPanel } from '../panels/LinkPanel';
import { SendPacketPanel } from '../panels/SendPacket';
import { Inspector } from '../panels/Inspector';
import { StatsPanel } from '../dashboard/StatsPanel';
import { Timeline } from '../dashboard/Timeline';
import { SequenceDiagram } from '../dashboard/SequenceDiagram';
import { useNetworkStore } from '../../stores/networkStore';
import { useUIStore } from '../../stores/uiStore';
import { motion } from 'framer-motion';

const panelTabs = [
  { key: 'send', label: 'TX' },
  { key: 'inspector', label: 'INSPECT' },
  { key: 'stats', label: 'STATS' },
] as const;

export const AppShell: React.FC = () => {
  const selectedDeviceId = useNetworkStore(s => s.selectedDeviceId);
  const selectedLinkId = useNetworkStore(s => s.selectedLinkId);
  const selectDevice = useNetworkStore(s => s.selectDevice);
  const clearEvents = useNetworkStore(s => s.clearEvents);
  const events = useNetworkStore(s => s.events);
  const activePanel = useUIStore(s => s.activePanel);
  const setPanel = useUIStore(s => s.setPanel);
  const showTimeline = useUIStore(s => s.showTimeline);
  const toggleTimeline = useUIStore(s => s.toggleTimeline);
  const timelineView = useUIStore(s => s.timelineView);
  const setTimelineView = useUIStore(s => s.setTimelineView);

  const [timelineHeight, setTimelineHeight] = React.useState(200);
  const [isResizing, setIsResizing] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Track the active drag listeners so a teardown before mouseup fires (e.g.
  // the shell unmounting mid-drag) can detach them; otherwise they leak on window.
  const resizeHandlers = React.useRef<{
    move: (e: MouseEvent) => void;
    up: () => void;
  } | null>(null);

  const startResizing = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = timelineHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY; // Dragging UP extends height
      const newHeight = Math.min(Math.max(110, startHeight + deltaY), window.innerHeight * 0.75);
      setTimelineHeight(newHeight);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      resizeHandlers.current = null;
    };

    resizeHandlers.current = { move: onMouseMove, up: onMouseUp };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [timelineHeight]);

  // Detach any dangling drag listeners if the shell unmounts mid-drag.
  React.useEffect(() => () => {
    if (resizeHandlers.current) {
      window.removeEventListener('mousemove', resizeHandlers.current.move);
      window.removeEventListener('mouseup', resizeHandlers.current.up);
      resizeHandlers.current = null;
    }
  }, []);

  const toggleExpandHeight = () => {
    if (isExpanded) {
      setTimelineHeight(200);
      setIsExpanded(false);
    } else {
      setTimelineHeight(420);
      setIsExpanded(true);
    }
  };

  // Auto-open device/link panel when selected
  const effectivePanel = selectedDeviceId ? 'device'
    : selectedLinkId ? 'link'
    : activePanel;

  // When a node/link is selected its detail panel is shown in place of the tab
  // screens. Surface it as its own active tab so the TX/INSPECT/STATS screens
  // stay visible and clickable rather than being silently covered.
  const contextTab = selectedDeviceId
    ? { key: 'device' as const, label: 'DEVICE' }
    : selectedLinkId
    ? { key: 'link' as const, label: 'LINK' }
    : null;
  const visibleTabs = contextTab ? [contextTab, ...panelTabs] : [...panelTabs];

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
    <div className="lab-bg" style={{
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
            {visibleTabs.map(tab => {
              const isActive = effectivePanel === tab.key;
              const isContext = tab.key === 'device' || tab.key === 'link';
              return (
                <motion.button
                  key={tab.key}
                  onClick={() => {
                    // The device/link context tab is already showing — leave the
                    // selection intact. Any real tab click must win over the
                    // auto-opened detail panel, so clear the selection first;
                    // otherwise effectivePanel stays pinned to 'device'/'link'
                    // and the TX/INSPECT/STATS screens are unreachable.
                    if (isContext) return;
                    selectDevice(null);
                    setPanel(tab.key as any);
                  }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    flex: 1,
                    padding: '10px 4px',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    background: isActive ? (isContext ? 'rgba(34,211,238,0.12)' : 'var(--signal-dim)') : 'transparent',
                    border: 'none',
                    borderBottom: `2px solid ${
                      isActive ? (isContext ? 'var(--accent-cyan)' : 'var(--signal)') : 'transparent'
                    }`,
                    color: isActive ? (isContext ? 'var(--accent-cyan)' : 'var(--signal)') : 'var(--text-muted)',
                    cursor: isContext ? 'default' : 'pointer',
                    fontFamily: 'JetBrains Mono, monospace',
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

      {/* ─── Vertically Expandable / Resizable Timeline Section ─── */}
      {showTimeline && (
        <div style={{
          borderTop: '1px solid var(--border-glass)',
          background: 'var(--bg-secondary)',
          height: `${timelineHeight}px`,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          transition: isResizing ? 'none' : 'height 0.2s ease',
        }}>
          {/* Top Edge Drag-to-Resize Bar */}
          <div
            onMouseDown={startResizing}
            style={{
              height: '7px',
              width: '100%',
              cursor: 'ns-resize',
              background: isResizing ? 'rgba(6, 182, 212, 0.4)' : 'rgba(255, 255, 255, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              transition: 'background 0.2s',
            }}
            title="Drag UP to extend panel height / DOWN to shrink"
          >
            <div style={{
              width: '38px',
              height: '3px',
              borderRadius: '2px',
              background: isResizing ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.25)',
            }} />
          </div>

          {/* Timeline Title & Header Toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 16px',
            borderBottom: '1px solid var(--border-glass)',
            background: 'rgba(10, 14, 26, 0.5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* View switcher: Event Log ↔ Sequence Diagram */}
              <div style={{
                display: 'flex', gap: '2px', background: 'var(--bg-tertiary)',
                borderRadius: '7px', padding: '2px',
              }}>
                {([
                  { key: 'log' as const, label: 'Event Log' },
                  { key: 'sequence' as const, label: 'Sequence' },
                ]).map(v => (
                  <button
                    key={v.key}
                    onClick={() => setTimelineView(v.key)}
                    style={{
                      padding: '3px 10px',
                      borderRadius: '3px',
                      border: 'none',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      fontFamily: 'JetBrains Mono, monospace',
                      cursor: 'pointer',
                      background: timelineView === v.key ? 'var(--signal)' : 'transparent',
                      color: timelineView === v.key ? '#0c0d0f' : 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <span className="tag" style={{
                fontSize: '9px',
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--signal)',
                padding: '1px 6px',
                borderRadius: '3px',
                letterSpacing: '0.08em',
              }}>
                {events.length} EVT
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Clear Timeline Button */}
              <motion.button
                onClick={() => clearEvents()}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: '3px 8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '5px',
                  color: '#f87171',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
                title="Clear all events from timeline"
              >
                <span>🗑️</span>
                <span>Clear Timeline</span>
              </motion.button>

              {/* Expand / Restore Height Toggle Button */}
              <motion.button
                onClick={toggleExpandHeight}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: '3px 8px',
                  background: 'rgba(6, 182, 212, 0.15)',
                  border: '1px solid rgba(6, 182, 212, 0.35)',
                  borderRadius: '5px',
                  color: '#22d3ee',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title={isExpanded ? 'Restore Timeline height' : 'Expand Timeline height above'}
              >
                <span>{isExpanded ? '▼' : '▲'}</span>
                <span>{isExpanded ? 'Restore' : 'Expand Above'}</span>
              </motion.button>

              {/* Hide Timeline Toggle Button */}
              <motion.button
                onClick={toggleTimeline}
                whileHover={{ scale: 1.1 }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  padding: '2px 4px',
                }}
                title="Hide Event Timeline"
              >
                ✕
              </motion.button>
            </div>
          </div>

          {/* Timeline Scrollable Content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {timelineView === 'log' ? <Timeline /> : <SequenceDiagram />}
          </div>
        </div>
      )}

      <Notifications />
      <KeyboardShortcuts />
    </div>
  );
};
