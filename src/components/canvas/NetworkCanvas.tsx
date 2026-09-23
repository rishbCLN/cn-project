import React from 'react';

import { useNetworkStore } from '../../stores/networkStore';
import { useUIStore } from '../../stores/uiStore';
import { NetworkScene3D } from './NetworkScene3D';
import { CanvasOnboarding } from './CanvasOnboarding';
import { Minimap } from './Minimap';
import { PresetInfoCard } from '../dashboard/PresetInfoCard';

/**
 * NetworkCanvas — hosts the interactive 3D network scene (Three.js) plus the
 * floating 2D overlays (preset banner, onboarding, controls hint).
 *
 * Interaction model inside the 3D viewport:
 *  • Left-drag empty space  → orbit camera   • Wheel → zoom   • Right-drag → pan
 *  • Left-drag a node       → move it on the ground plane
 *  • Click a node / link    → select   • Double-click → delete
 *  • Shift-drag (or right-drag) node → node  → create a link
 *  • Drag a device from the sidebar → drop onto the floor to add it
 */
export const NetworkCanvas: React.FC = () => {
  const devices = useNetworkStore(s => s.devices);
  const showMinimap = useUIStore(s => s.showMinimap);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <NetworkScene3D />

      {/* ─── Preset Scenario Description Floating Banner ─── */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        pointerEvents: 'auto',
      }}>
        <PresetInfoCard />
      </div>

      {/* ─── 3D Controls Hint ─── */}
      <div style={{
        position: 'absolute',
        bottom: 14,
        left: 14,
        zIndex: 10,
        pointerEvents: 'none',
        background: 'rgba(10, 14, 26, 0.72)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        padding: '8px 11px',
        fontSize: '10px',
        lineHeight: 1.6,
        color: '#94a3b8',
        fontFamily: 'JetBrains Mono, monospace',
        maxWidth: '230px',
      }}>
        <div style={{ color: '#22d3ee', fontWeight: 700, marginBottom: 2, letterSpacing: '0.05em' }}>
          3D VIEWPORT
        </div>
        <div>Drag empty · orbit &nbsp;|&nbsp; Wheel · zoom</div>
        <div>Drag node · move &nbsp;|&nbsp; Right-drag · pan</div>
        <div>Shift-drag node→node · link</div>
        <div>Click · select &nbsp;|&nbsp; Dbl-click · delete</div>
      </div>

      {/* ─── First-run onboarding (only when canvas is empty) ─── */}
      {devices.length === 0 && <CanvasOnboarding />}

      {/* ─── Minimap overview (toggle: TopBar "Map") ─── */}
      {showMinimap && (
        <div style={{
          position: 'absolute',
          bottom: 14,
          right: 14,
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          <Minimap />
        </div>
      )}
    </div>
  );
};
