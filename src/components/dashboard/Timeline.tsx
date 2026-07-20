import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { EVENT_COLORS } from '../../utils/colors';

const formatTimeWithMs = (timestamp: number) => {
  const date = new Date(timestamp);
  const timeStr = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const ms = String(timestamp % 1000).padStart(3, '0');
  return `${timeStr}.${ms}`;
};

export const Timeline: React.FC = () => {
  const events = useNetworkStore(s => s.events);
  const displayEvents = events.slice(-60); // Last 60 events

  const groupedEvents = useMemo(() => {
    const groups: { time: number; events: typeof events }[] = [];
    for (const event of displayEvents) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.time === event.time) {
        lastGroup.events.push(event);
      } else {
        groups.push({
          time: event.time,
          events: [event],
        });
      }
    }
    return groups.reverse();
  }, [displayEvents]);

  if (groupedEvents.length === 0) {
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
      display: 'flex', flexDirection: 'column', gap: '8px',
      padding: '8px 16px', maxHeight: '180px', overflowY: 'auto',
    }}>
      {groupedEvents.map((group, groupIdx) => (
        <div
          key={group.time}
          style={{
            background: 'rgba(255, 255, 255, 0.015)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: '8px',
            padding: '6px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {/* Group Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
            paddingBottom: '4px',
            marginBottom: '2px',
          }}>
            <span style={{
              fontSize: '10px',
              fontFamily: 'monospace',
              fontWeight: 600,
              color: 'var(--accent-cyan)',
            }}>
              ⏱ {formatTimeWithMs(group.time)}
            </span>
            <span style={{
              fontSize: '9px',
              color: 'var(--text-muted)',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '1px 5px',
              borderRadius: '3px',
              fontFamily: 'monospace',
            }}>
              {group.events.length} {group.events.length === 1 ? 'event' : 'events'}
            </span>
          </div>

          {/* Group Items */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            borderLeft: '2px solid rgba(6, 182, 212, 0.15)',
            paddingLeft: '8px',
            marginLeft: '4px',
          }}>
            {group.events.map((event, i) => (
              <motion.div
                key={event.id}
                initial={groupIdx === 0 && i === group.events.length - 1 ? { opacity: 0, x: -5 } : false}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '2px 0',
                  fontSize: '11px',
                }}
              >
                {/* Step Index Number */}
                <span style={{
                  fontSize: '9px',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: '#94a3b8',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '3px',
                  padding: '0 4px',
                  minWidth: '20px',
                  textAlign: 'center',
                  flexShrink: 0,
                }}>
                  {i + 1}.
                </span>

                {/* Dot */}
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: EVENT_COLORS[event.type] ?? '#64748b',
                  boxShadow: `0 0 5px ${EVENT_COLORS[event.type] ?? '#64748b'}50`,
                  flexShrink: 0,
                }} />

                {/* Type Badge */}
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  color: EVENT_COLORS[event.type] ?? '#64748b',
                  background: `${EVENT_COLORS[event.type] ?? '#64748b'}15`,
                  padding: '0.5px 5px',
                  borderRadius: '3px',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  minWidth: '75px',
                  textAlign: 'center',
                }}>
                  {event.type.replace(/_/g, ' ')}
                </span>

                {/* Description & Scientific Telemetry Chips */}
                {(() => {
                  const parts = event.description.split(' — [');
                  const mainDesc = parts[0];
                  const rawMetrics = parts[1] ? parts[1].replace(']', '') : null;

                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', flex: 1 }}>
                      <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '11px' }}>
                        {mainDesc}
                      </span>

                      {rawMetrics && (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {rawMetrics.split(' | ').map((metric, mIdx) => (
                            <span
                              key={mIdx}
                              style={{
                                fontSize: '9px',
                                fontFamily: 'monospace',
                                fontWeight: 600,
                                background: metric.includes('CRC') || metric.includes('Goodput')
                                  ? 'rgba(16, 185, 129, 0.12)'
                                  : metric.includes('Loss') || metric.includes('FAIL')
                                  ? 'rgba(239, 68, 68, 0.15)'
                                  : 'rgba(6, 182, 212, 0.12)',
                                border: `1px solid ${
                                  metric.includes('CRC') || metric.includes('Goodput')
                                    ? 'rgba(16, 185, 129, 0.3)'
                                    : metric.includes('Loss') || metric.includes('FAIL')
                                    ? 'rgba(239, 68, 68, 0.3)'
                                    : 'rgba(6, 182, 212, 0.25)'
                                }`,
                                color: metric.includes('CRC') || metric.includes('Goodput')
                                  ? '#34d399'
                                  : metric.includes('Loss') || metric.includes('FAIL')
                                  ? '#f87171'
                                  : '#38bdf8',
                                padding: '0.5px 5px',
                                borderRadius: '3px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {metric}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
