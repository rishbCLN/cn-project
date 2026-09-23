import React, { useEffect, useRef } from 'react';
import { useNetworkStore } from '../../stores/networkStore';
import { DEVICE_COLORS } from '../../utils/colors';

/**
 * Minimap — a lightweight 2D overview of the topology, drawn imperatively on a
 * canvas from the store's device positions. Passive (overview only): it mirrors
 * device placement, link state, and the current selection. Toggled via the
 * "Map" button in the TopBar (uiStore.showMinimap).
 */
const W = 190;
const H = 128;
const PAD = 14;

export const Minimap: React.FC = () => {
  const devices = useNetworkStore(s => s.devices);
  const links = useNetworkStore(s => s.links);
  const selectedId = useNetworkStore(s => s.selectedDeviceId);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (devices.length === 0) return;

    // Fit the device bounding box into the canvas, preserving aspect ratio.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const d of devices) {
      minX = Math.min(minX, d.position.x);
      minY = Math.min(minY, d.position.y);
      maxX = Math.max(maxX, d.position.x);
      maxY = Math.max(maxY, d.position.y);
    }
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
    const offX = (W - spanX * scale) / 2;
    const offY = (H - spanY * scale) / 2;
    const project = (x: number, y: number) => ({
      px: offX + (x - minX) * scale,
      py: offY + (y - minY) * scale,
    });

    // Links first (drawn under the device dots).
    ctx.lineWidth = 1;
    for (const l of links) {
      const a = devices.find(d => d.id === l.source);
      const b = devices.find(d => d.id === l.target);
      if (!a || !b) continue;
      const pa = project(a.position.x, a.position.y);
      const pb = project(b.position.x, b.position.y);
      ctx.strokeStyle = l.status === 'active' ? 'rgba(148,163,184,0.5)' : 'rgba(239,68,68,0.5)';
      ctx.beginPath();
      ctx.moveTo(pa.px, pa.py);
      ctx.lineTo(pb.px, pb.py);
      ctx.stroke();
    }

    // Device markers.
    for (const d of devices) {
      const { px, py } = project(d.position.x, d.position.y);
      const isSel = d.id === selectedId;
      ctx.beginPath();
      ctx.arc(px, py, isSel ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = d.status === 'active' ? (DEVICE_COLORS[d.type] ?? '#94a3b8') : '#475569';
      ctx.fill();
      if (isSel) {
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }, [devices, links, selectedId]);

  return (
    <div style={{
      background: 'rgba(10, 14, 26, 0.78)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '8px',
      padding: '6px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      userSelect: 'none',
    }}>
      <div style={{
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.14em',
        color: '#22d3ee',
        fontFamily: 'JetBrains Mono, monospace',
        marginBottom: '4px',
        paddingLeft: '2px',
      }}>
        MAP
      </div>
      <canvas ref={canvasRef} style={{ width: W, height: H, display: 'block', borderRadius: '4px' }} />
    </div>
  );
};
