/* ─── Devices ─── */
export type DeviceType = 'router' | 'switch' | 'server' | 'pc';
export type DeviceStatus = 'active' | 'disabled';

export interface Device {
  id: string;
  type: DeviceType;
  label: string;
  ip: string;
  status: DeviceStatus;
  position: { x: number; y: number };
  load: number; // 0–1 for heatmap glow
}

/* ─── Links ─── */
export interface Link {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  bandwidth: number;    // Mbps
  latency: number;      // ms
  cost: number;         // routing weight
  status: 'active' | 'disabled';
  utilization: number;  // 0–1 for edge color
}

/* ─── Packets ─── */
export type Protocol = 'TCP' | 'UDP' | 'ICMP' | 'DNS';
export type PacketStatus =
  | 'created'
  | 'in-transit'
  | 'delivered'
  | 'dropped'
  | 'corrupted'
  | 'retransmitting';

export interface Packet {
  id: string;
  sourceIP: string;
  sourceDeviceId: string;
  destIP: string;
  destDeviceId: string;
  protocol: Protocol;
  size: number;
  ttl: number;
  seqNum: number;
  ackNum: number;
  checksum: string;
  crc: string;
  crcValid: boolean;
  path: string[];       // device IDs in order
  currentHop: number;
  status: PacketStatus;
  createdAt: number;
  deliveredAt?: number;
  hopTimestamps: number[];
  retransmissionOf?: string;
  isAck?: boolean;
}

/* ─── Routing ─── */
export type RoutingAlgorithm = 'dijkstra' | 'bellman-ford';

/* ─── Simulation ─── */
export type SimState = 'idle' | 'running' | 'paused';

export interface SimConfig {
  speed: number;            // 0.5, 1, 2, 5
  packetLoss: number;       // 0–100
  latencyMultiplier: number;
  jitter: number;           // ms
  corruptionRate: number;   // 0–100
  congestion: number;       // 0–100 %
  routingAlgorithm: RoutingAlgorithm;
}

/* ─── Events ─── */
export type EventType =
  | 'packet_created'
  | 'packet_sent'
  | 'packet_hop'
  | 'packet_delivered'
  | 'packet_dropped'
  | 'packet_corrupted'
  | 'ack_sent'
  | 'ack_received'
  | 'timeout'
  | 'retransmission'
  | 'crc_pass'
  | 'crc_fail'
  | 'link_down'
  | 'link_up'
  | 'device_down'
  | 'device_up'
  | 'route_changed';

export interface SimEvent {
  id: string;
  time: number;
  type: EventType;
  packetId?: string;
  description: string;
}

/* ─── Statistics ─── */
export interface Metrics {
  sent: number;
  delivered: number;
  lost: number;
  corrupted: number;
  retransmissions: number;
  avgRTT: number;
  throughput: number;
  deliveryRate: number;
  errorRate: number;
}

export interface MetricSnapshot {
  time: number;
  metrics: Metrics;
}

/* ─── Persistence ─── */
export interface ProjectFile {
  version: string;
  name: string;
  devices: Device[];
  links: Link[];
  config: SimConfig;
  savedAt: string;
}

/* ─── UI Notification ─── */
export interface Notification {
  id: string;
  message: string;
  type: EventType;
  time: number;
}
