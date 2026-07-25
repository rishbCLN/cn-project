import React from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { Button } from '../ui/Button';
import { DEVICE_COLORS } from '../../utils/colors';

export const DevicePanel: React.FC = () => {
  const selectedDeviceId = useNetworkStore(s => s.selectedDeviceId);
  const devices = useNetworkStore(s => s.devices);
  const links = useNetworkStore(s => s.links);
  const updateDevice = useNetworkStore(s => s.updateDevice);
  const removeDevice = useNetworkStore(s => s.removeDevice);
  const toggleDeviceStatus = useNetworkStore(s => s.toggleDeviceStatus);
  const toggleLinkStatus = useNetworkStore(s => s.toggleLinkStatus);

  const device = devices.find(d => d.id === selectedDeviceId);
  if (!device) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        Select a device to edit its properties
      </div>
    );
  }

  const color = DEVICE_COLORS[device.type];
  const connectedLinks = links.filter(l => l.source === device.id || l.target === device.id);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      style={{ padding: '16px' }}
    >
      <div style={{
        fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: device.status === 'active' ? color : '#ef4444',
          boxShadow: `0 0 8px ${device.status === 'active' ? color : '#ef4444'}`,
        }} />
        Device Properties
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Field label="Name">
          <input
            type="text"
            value={device.label}
            onChange={e => updateDevice(device.id, { label: e.target.value })}
          />
        </Field>

        <Field label="IP Address">
          <input
            type="text"
            value={device.ip}
            onChange={e => updateDevice(device.id, { ip: e.target.value })}
          />
        </Field>

        <Field label="Type">
          <div style={{
            padding: '6px 10px',
            background: 'var(--bg-tertiary)',
            borderRadius: '8px',
            fontSize: '13px',
            color: color,
            fontWeight: 600,
            textTransform: 'capitalize',
          }}>
            {device.type}
          </div>
        </Field>

        {/* Live Interface Telemetry Box */}
        <div style={{
          background: 'rgba(10, 14, 26, 0.95)',
          border: '1px solid var(--border-glass)',
          borderRadius: '10px',
          padding: '10px',
          fontSize: '10px',
          fontFamily: 'monospace',
          color: 'var(--text-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          <div style={{ color: color, fontWeight: 700 }}>[Interface Telemetry]</div>
          <div>• MAC: {device.mac || '00:1A:2B:3C:4D:FE'}</div>
          <div>• Buffer Queue: {Math.round((device.load ?? 0) * 16)} / 64 Packets</div>
          <div>• Master Port: {device.status === 'active' ? 'ETH0 UP (1000Mbps)' : 'ETH0 DOWN'}</div>
          <div>• Active Ports: {connectedLinks.filter(l => l.status === 'active').length} / {connectedLinks.length}</div>
          <div>• Buffer Load: {((device.load ?? 0) * 100).toFixed(1)}%</div>
        </div>

        {/* Connected Ports & Individual Node Flow Control */}
        <div style={{
          padding: '12px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid var(--border-glass)',
          borderRadius: '10px',
        }}>
          <div style={{
            fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)',
            marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>🔌 Connected Ports ({connectedLinks.length})</span>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Per-Node Flow Control</span>
          </div>

          {connectedLinks.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
              No connected nodes.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {connectedLinks.map((link, idx) => {
                const peerId = link.source === device.id ? link.target : link.source;
                const peer = devices.find(d => d.id === peerId);
                const isLinkActive = link.status === 'active';

                return (
                  <div
                    key={link.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'var(--bg-tertiary)',
                      border: `1px solid ${isLinkActive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.3)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: isLinkActive ? '#10b981' : '#ef4444',
                          boxShadow: `0 0 6px ${isLinkActive ? '#10b981' : '#ef4444'}`,
                        }} />
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Port #{idx + 1}: {peer?.label || 'Node'}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '9px', fontWeight: 600, fontFamily: 'monospace',
                        color: isLinkActive ? '#10b981' : '#ef4444',
                      }}>
                        {isLinkActive ? 'FLOW ACTIVE' : 'CUT OFF'}
                      </span>
                    </div>

                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      IP: {peer?.ip || 'N/A'} • {link.bandwidth}Mbps
                    </div>

                    <motion.button
                      onClick={() => toggleLinkStatus(link.id)}
                      whileTap={{ scale: 0.96 }}
                      style={{
                        padding: '5px 8px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                        transition: 'all 0.2s',
                        border: `1px solid ${isLinkActive ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                        background: isLinkActive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.15)',
                        color: isLinkActive ? '#f87171' : '#34d399',
                        textAlign: 'center',
                      }}
                    >
                      {isLinkActive ? `✂️ Cut Off Flow to ${peer?.label || 'this node'}` : `🔌 Start Flow to ${peer?.label || 'this node'}`}
                    </motion.button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Field label="Master Device Status">
          <motion.button
            onClick={() => toggleDeviceStatus(device.id)}
            whileTap={{ scale: 0.95 }}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '8px',
              border: `1px solid ${device.status === 'active' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              background: device.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: device.status === 'active' ? '#10b981' : '#ef4444',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s',
            }}
          >
            {device.status === 'active' ? '● Master Unit Active — Click to Disable' : '○ Master Unit Disabled — Click to Enable'}
          </motion.button>
        </Field>

        <div style={{ marginTop: '8px' }}>
          <Button variant="danger" size="sm" fullWidth onClick={() => removeDevice(device.id)}>
            Delete Device
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div style={{
      fontSize: '11px', color: 'var(--text-muted)',
      marginBottom: '4px', fontWeight: 500,
    }}>
      {label}
    </div>
    {children}
  </div>
);
