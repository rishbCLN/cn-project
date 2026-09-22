import { v4 as uuidv4 } from 'uuid';

/* ─── Unique ID ─── */
export function genId(): string {
  return uuidv4().slice(0, 8);
}

/* ─── IP Validation ─── */
export function isValidIP(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => {
    const n = parseInt(p, 10);
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

/* ─── Auto IP Generator ─── */
let ipCounter = 1;
export function nextIP(): string {
  const ip = `192.168.1.${ipCounter}`;
  ipCounter = (ipCounter % 254) + 1;
  return ip;
}
export function resetIPCounter(startFrom = 1) {
  ipCounter = startFrom;
}

/* ─── Format Bytes ─── */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/* ─── Format Duration ─── */
export function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/* ─── Format Percentage ─── */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Stable MAC address for a device. Uses the device's real MAC when present
 * (presets set them); otherwise derives a deterministic locally-administered
 * address from the id, so the SAME device always shows the SAME MAC across the
 * Inspector, ARP table, and CAM table.
 */
export function deviceMac(device: { id: string; mac?: string }): string {
  if (device.mac) return device.mac;
  let h = 0;
  for (let i = 0; i < device.id.length; i++) h = (h * 31 + device.id.charCodeAt(i)) >>> 0;
  const b = (n: number) => ((h >>> (n * 8)) & 0xff).toString(16).padStart(2, '0').toUpperCase();
  // 02: prefix = locally administered, unicast.
  return `02:${b(0)}:${b(1)}:${b(2)}:${b(3)}:${(((h >>> 24) ^ 0x5a) & 0xff).toString(16).padStart(2, '0').toUpperCase()}`;
}

/* ─── Checksum (simple hex hash of string) ─── */
export function simpleChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
