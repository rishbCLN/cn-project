import React from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { EVENT_COLORS } from '../../utils/colors';

export const Timeline: React.FC = () => {
  const events = useNetworkStore(s => s.events);
  const displayEvents = events.slice(-60); // Last 60 events

  if (displayEvents.length === 0) {
    return (
      <div style={{
        padding: '16px', textAlign: 'center',
        color: 'var(--text-muted)', fontSize: '12px',
      }}>
        Events will appear here during simulation
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '2px',
      padding: '8px 16px', maxHeight: '180px', overflowY: 'auto',
    }}>
      {displayEvents.slice().reverse().map((event, i) => (
        <motion.div
          key={event.id}
          initial={i === 0 ? { opacity: 0, y: -8 } : false}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            background: i === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
          }}
        >
          {/* Dot */}
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: EVENT_COLORS[event.type] ?? '#64748b',
            boxShadow: `0 0 6px ${EVENT_COLORS[event.type] ?? '#64748b'}50`,
            flexShrink: 0,
          }} />

          {/* Time */}
          <span style={{
            fontSize: '10px', fontFamily: 'monospace',
            color: 'var(--text-muted)', minWidth: '70px',
          }}>
            {new Date(event.time).toLocaleTimeString([], {
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
          </span>

          {/* Type badge */}
          <span style={{
            fontSize: '9px', fontWeight: 700,
            color: EVENT_COLORS[event.type] ?? '#64748b',
            background: `${EVENT_COLORS[event.type] ?? '#64748b'}15`,
            padding: '1px 6px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            minWidth: '75px',
            textAlign: 'center',
          }}>
            {event.type.replace(/_/g, ' ')}
          </span>

          {/* Description */}
          <span style={{
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {event.description}
          </span>
        </motion.div>
      ))}
    </div>
  );
};
