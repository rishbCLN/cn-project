import React from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { Button } from '../ui/Button';
import { DEVICE_COLORS } from '../../utils/colors';

export const DevicePanel: React.FC = () => {
  const selectedDeviceId = useNetworkStore(s => s.selectedDeviceId);
  const devices = useNetworkStore(s => s.devices);
  const updateDevice = useNetworkStore(s => s.updateDevice);
  const removeDevice = useNetworkStore(s => s.removeDevice);
  const toggleDeviceStatus = useNetworkStore(s => s.toggleDeviceStatus);

  const device = devices.find(d => d.id === selectedDeviceId);
  if (!device) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        Select a device to edit its properties
      </div>
    );
  }

  const color = DEVICE_COLORS[device.type];

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
          <div>• Port Status: {device.status === 'active' ? 'ETH0 UP (1000Mbps)' : 'ETH0 DOWN'}</div>
          <div>• Buffer Load: {((device.load ?? 0) * 100).toFixed(1)}%</div>
        </div>

        <Field label="Status">
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
            {device.status === 'active' ? '● Active — Click to Disable' : '○ Disabled — Click to Enable'}
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
