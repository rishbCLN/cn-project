import { Protocol } from '../types';

/* ─── Protocol Colors ─── */
export const PROTOCOL_COLORS: Record<Protocol, string> = {
  TCP: '#3b82f6',   // Blue
  UDP: '#10b981',   // Green
  ICMP: '#f59e0b',  // Amber
  DNS: '#8b5cf6',   // Purple
};

export const PROTOCOL_BG_COLORS: Record<Protocol, string> = {
  TCP: 'rgba(59, 130, 246, 0.15)',
  UDP: 'rgba(16, 185, 129, 0.15)',
  ICMP: 'rgba(245, 158, 11, 0.15)',
  DNS: 'rgba(139, 92, 246, 0.15)',
};

/* ─── Traffic Colors (utilization 0–1) ─── */
export function getTrafficColor(utilization: number): string {
  if (utilization < 0.4) return '#10b981';   // Green
  if (utilization < 0.7) return '#f59e0b';   // Yellow
  return '#ef4444';                           // Red
}

/* ─── Event Type Colors ─── */
export const EVENT_COLORS: Record<string, string> = {
  packet_created: '#3b82f6',
  packet_sent: '#06b6d4',
  packet_hop: '#8b5cf6',
  packet_delivered: '#10b981',
  packet_dropped: '#ef4444',
  packet_corrupted: '#f59e0b',
  ack_sent: '#06b6d4',
  ack_received: '#10b981',
  timeout: '#ef4444',
  retransmission: '#f59e0b',
  crc_pass: '#10b981',
  crc_fail: '#ef4444',
  link_down: '#ef4444',
  link_up: '#10b981',
  device_down: '#ef4444',
  device_up: '#10b981',
  route_changed: '#8b5cf6',
};

/* ─── Device Icon Colors ─── */
export const DEVICE_COLORS = {
  router: '#3b82f6',
  switch: '#10b981',
  server: '#8b5cf6',
  pc: '#06b6d4',
} as const;
