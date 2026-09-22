import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { useUIStore } from '../../stores/uiStore';

/**
 * KeyboardShortcuts — registers global hotkeys for the simulation and exposes
 * a help overlay (opened with "?"). Shortcuts are ignored while typing in an
 * input/select/textarea so they never interfere with editing device fields.
 */

interface Shortcut {
  keys: string[];
  label: string;
  group: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['Space'], label: 'Play / Pause simulation', group: 'Simulation' },
  { keys: ['S'], label: 'Step one hop forward', group: 'Simulation' },
  { keys: ['X'], label: 'Stop simulation', group: 'Simulation' },
  { keys: ['R'], label: 'Reset simulation (keep topology)', group: 'Simulation' },
  { keys: ['1', '–', '5'], label: 'Set speed (0.25× – 4×)', group: 'Simulation' },
  { keys: ['Del', 'Backspace'], label: 'Delete selected device / link', group: 'Editing' },
  { keys: ['Esc'], label: 'Deselect / close overlays', group: 'Editing' },
  { keys: ['M'], label: 'Toggle minimap', group: 'View' },
  { keys: ['T'], label: 'Toggle event timeline', group: 'View' },
  { keys: ['?'], label: 'Show this shortcuts help', group: 'View' },
];

const SPEEDS = [0.25, 0.5, 1, 2, 4];

const isTypingTarget = (el: EventTarget | null): boolean => {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || node.isContentEditable;
};

export const KeyboardShortcuts: React.FC = () => {
  const [helpOpen, setHelpOpen] = useState(false);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (isTypingTarget(e.target)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const net = useNetworkStore.getState();
    const ui = useUIStore.getState();

    switch (e.key) {
      case ' ': {
        e.preventDefault();
        if (net.simState === 'running') net.pauseSim();
        else net.startSim();
        break;
      }
      case 's':
      case 'S': {
        const active = net.activePackets.find(p => p.status === 'in-transit' || p.status === 'created');
        if (active) net.advancePacket(active.id);
        break;
      }
      case 'x':
      case 'X':
        net.stopSim();
        break;
      case 'r':
      case 'R':
        net.resetSim();
        break;
      case 'm':
      case 'M':
        ui.toggleMinimap();
        break;
      case 't':
      case 'T':
        ui.toggleTimeline();
        break;
      case '?':
        setHelpOpen(v => !v);
        break;
      case 'Escape':
        if (helpOpen) setHelpOpen(false);
        else {
          net.selectDevice(null);
          net.selectLink(null);
        }
        break;
      case 'Delete':
      case 'Backspace': {
        if (net.selectedDeviceId) net.removeDevice(net.selectedDeviceId);
        else if (net.selectedLinkId) net.removeLink(net.selectedLinkId);
        break;
      }
      default: {
        if (/^[1-5]$/.test(e.key)) {
          const idx = parseInt(e.key, 10) - 1;
          if (SPEEDS[idx] != null) net.setSpeed(SPEEDS[idx]);
        }
      }
    }
  }, [helpOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const groups = Array.from(new Set(SHORTCUTS.map(s => s.group)));

  return (
    <AnimatePresence>
      {helpOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setHelpOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(3, 6, 15, 0.6)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'rgba(13, 18, 32, 0.97)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '22px 24px',
              boxShadow: '0 24px 70px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc' }}>
                ⌨ Keyboard Shortcuts
              </div>
              <button
                onClick={() => setHelpOpen(false)}
                style={{
                  background: 'var(--bg-tertiary)', border: 'none', borderRadius: '7px',
                  width: '26px', height: '26px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {groups.map(group => (
                <div key={group}>
                  <div style={{
                    fontSize: '10px', fontWeight: 700, color: 'var(--accent-cyan)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px',
                  }}>
                    {group}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {SHORTCUTS.filter(s => s.group === group).map(s => (
                      <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{s.label}</span>
                        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                          {s.keys.map((k, i) => (
                            <kbd
                              key={i}
                              style={{
                                background: k === '–' ? 'transparent' : 'rgba(255,255,255,0.07)',
                                border: k === '–' ? 'none' : '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '5px',
                                padding: k === '–' ? '2px 0' : '2px 7px',
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#e2e8f0',
                                minWidth: k === '–' ? 'auto' : '20px',
                                textAlign: 'center',
                              }}
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
