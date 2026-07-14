import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../stores/uiStore';
import { EVENT_COLORS } from '../../utils/colors';

export const Notifications: React.FC = () => {
  const notifications = useUIStore(s => s.notifications);
  const dismiss = useUIStore(s => s.dismissNotification);

  return (
    <div style={{
      position: 'fixed',
      top: '64px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none',
    }}>
      <AnimatePresence>
        {notifications.map(notif => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={() => dismiss(notif.id)}
            style={{
              background: 'rgba(17, 24, 39, 0.92)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${EVENT_COLORS[notif.type] ?? 'var(--border-glass)'}30`,
              borderLeft: `3px solid ${EVENT_COLORS[notif.type] ?? '#64748b'}`,
              borderRadius: '10px',
              padding: '10px 14px',
              maxWidth: '320px',
              pointerEvents: 'auto',
              cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: EVENT_COLORS[notif.type] ?? '#64748b',
                boxShadow: `0 0 8px ${EVENT_COLORS[notif.type] ?? '#64748b'}`,
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: '12px', color: 'var(--text-primary)',
                lineHeight: 1.3,
              }}>
                {notif.message}
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
