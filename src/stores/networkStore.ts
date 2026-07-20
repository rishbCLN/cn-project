import { create } from 'zustand';
import {
  Device, Link, Packet, Protocol, SimState, SimConfig, SimEvent, Metrics, MetricSnapshot, DeviceType,
} from '../types';
import { createPacket, processHop, computeMetrics } from '../engine/simulation';
import { genId, nextIP } from '../utils/helpers';

export type PresetKey =
  | 'congestion'
  | 'retransmission'
  | 'mesh_routing'
  | 'star_topology'
  | 'ring_redundancy'
  | 'high_latency_sat';

interface NetworkStore {
  /* ─── Topology ─── */
  devices: Device[];
  links: Link[];
  selectedDeviceId: string | null;
  selectedLinkId: string | null;
  activePreset: PresetKey | null;

  /* ─── Simulation ─── */
  simState: SimState;
  simConfig: SimConfig;

  /* ─── Packets ─── */
  activePackets: Packet[];
  packetHistory: Packet[];
  lastPacketConfig: { srcId: string; dstId: string; protocol: Protocol; size: number } | null;

  /* ─── Events & Metrics ─── */
  events: SimEvent[];
  metrics: Metrics;
  metricsHistory: MetricSnapshot[];

  /* ─── Topology Actions ─── */
  addDevice: (type: DeviceType, position: { x: number; y: number }) => void;
  removeDevice: (id: string) => void;
  updateDevice: (id: string, updates: Partial<Device>) => void;
  selectDevice: (id: string | null) => void;
  toggleDeviceStatus: (id: string) => void;

  addLink: (source: string, target: string, sourceHandle?: string | null, targetHandle?: string | null) => void;
  removeLink: (id: string) => void;
  updateLink: (id: string, updates: Partial<Link>) => void;
  selectLink: (id: string | null) => void;
  toggleLinkStatus: (id: string) => void;

  updateDevicePosition: (id: string, position: { x: number; y: number }) => void;

  /* ─── Simulation Actions ─── */
  loadPresetScenario: (preset: PresetKey) => void;
  sendPacket: (srcId: string, dstId: string, protocol: Protocol, size: number) => void;
  advancePacket: (packetId: string) => void;
  startSim: () => void;
  pauseSim: () => void;
  stopSim: () => void;
  resetSim: () => void;
  resetWorkspace: () => void;
  setSpeed: (speed: number) => void;
  setConditions: (config: Partial<SimConfig>) => void;

  /* ─── Persistence ─── */
  saveProject: (name: string) => void;
  loadProject: (json: string) => boolean;
  getProjectJSON: () => string;

  /* ─── Misc ─── */
  pushEvent: (event: SimEvent) => void;
  clearEvents: () => void;
}

const DEFAULT_CONFIG: SimConfig = {
  speed: 0.25,
  packetLoss: 0,
  latencyMultiplier: 1,
  jitter: 0,
  corruptionRate: 0,
  congestion: 0,
  routingAlgorithm: 'dijkstra',
};

const EMPTY_METRICS: Metrics = {
  sent: 0, delivered: 0, lost: 0, corrupted: 0, retransmissions: 0,
  avgRTT: 0, throughput: 0, deliveryRate: 0, errorRate: 0,
};

export const useNetworkStore = create<NetworkStore>((set, get) => ({
  /* ─── Initial State ─── */
  devices: [],
  links: [],
  selectedDeviceId: null,
  selectedLinkId: null,
  activePreset: null,
  simState: 'idle',
  simConfig: { ...DEFAULT_CONFIG },
  activePackets: [],
  packetHistory: [],
  lastPacketConfig: null,
  events: [],
  metrics: { ...EMPTY_METRICS },
  metricsHistory: [],

  /* ─── Device Actions ─── */
  addDevice: (type, position) => {
    const labelMap: Record<DeviceType, string> = {
      router: 'Router', switch: 'Switch', server: 'Server', pc: 'PC',
    };
    const id = genId();
    const existingCount = get().devices.filter(d => d.type === type).length;
    const device: Device = {
      id,
      type,
      label: `${labelMap[type]} #${existingCount + 1}`,
      ip: nextIP(),
      status: 'active',
      position,
      load: 0,
    };
    set(state => ({ devices: [...state.devices, device] }));
  },

  removeDevice: (id) => {
    set(state => ({
      devices: state.devices.filter(d => d.id !== id),
      links: state.links.filter(l => l.source !== id && l.target !== id),
      selectedDeviceId: state.selectedDeviceId === id ? null : state.selectedDeviceId,
    }));
  },

  updateDevice: (id, updates) => {
    set(state => ({
      devices: state.devices.map(d => d.id === id ? { ...d, ...updates } : d),
    }));
  },

  selectDevice: (id) => set({ selectedDeviceId: id, selectedLinkId: null }),

  toggleDeviceStatus: (id) => {
    const device = get().devices.find(d => d.id === id);
    if (!device) return;
    const newStatus = device.status === 'active' ? 'disabled' : 'active';
    set(state => ({
      devices: state.devices.map(d => d.id === id ? { ...d, status: newStatus } : d),
      events: [...state.events, {
        id: genId(),
        time: Date.now(),
        type: newStatus === 'active' ? 'device_up' : 'device_down',
        description: `${device.label} ${newStatus === 'active' ? 'enabled' : 'disabled'}`,
      }],
    }));
  },

  /* ─── Link Actions ─── */
  addLink: (source, target, sourceHandle, targetHandle) => {
    // Prevent duplicate links
    const exists = get().links.some(
      l => (l.source === source && l.target === target) || (l.source === target && l.target === source)
    );
    if (exists || source === target) return;

    const link: Link = {
      id: genId(),
      source,
      target,
      sourceHandle: sourceHandle || undefined,
      targetHandle: targetHandle || undefined,
      bandwidth: 100,
      latency: 10,
      cost: 1,
      status: 'active',
      utilization: 0,
    };
    set(state => ({ links: [...state.links, link] }));
  },

  removeLink: (id) => {
    set(state => ({
      links: state.links.filter(l => l.id !== id),
      selectedLinkId: state.selectedLinkId === id ? null : state.selectedLinkId,
    }));
  },

  updateLink: (id, updates) => {
    set(state => ({
      links: state.links.map(l => l.id === id ? { ...l, ...updates } : l),
    }));
  },

  selectLink: (id) => set({ selectedLinkId: id, selectedDeviceId: null }),

  toggleLinkStatus: (id) => {
    const link = get().links.find(l => l.id === id);
    if (!link) return;
    const newStatus = link.status === 'active' ? 'disabled' : 'active';
    const srcDevice = get().devices.find(d => d.id === link.source);
    const tgtDevice = get().devices.find(d => d.id === link.target);
    set(state => ({
      links: state.links.map(l => l.id === id ? { ...l, status: newStatus } : l),
      events: [...state.events, {
        id: genId(),
        time: Date.now(),
        type: newStatus === 'active' ? 'link_up' : 'link_down',
        description: `Link ${srcDevice?.label ?? '?'} ↔ ${tgtDevice?.label ?? '?'} ${newStatus === 'active' ? 'restored' : 'severed'}`,
      }],
    }));
  },

  updateDevicePosition: (id, position) => {
    set(state => ({
      devices: state.devices.map(d => d.id === id ? { ...d, position } : d),
    }));
  },

  /* ─── Simulation Actions ─── */
  sendPacket: (srcId, dstId, protocol, size) => {
    const { devices, links, simConfig } = get();
    const src = devices.find(d => d.id === srcId);
    const dst = devices.find(d => d.id === dstId);
    if (!src || !dst) return;

    const result = createPacket(src, dst, protocol, size, devices, links, simConfig.routingAlgorithm);
    if (!result) {
      set(state => ({
        events: [...state.events, {
          id: genId(), time: Date.now(), type: 'packet_dropped',
          description: `No route found: ${src.label} → ${dst.label}`,
        }],
      }));
      return;
    }

    set(state => ({
      lastPacketConfig: { srcId, dstId, protocol, size },
      activePackets: [...state.activePackets, result.packet],
      packetHistory: [...state.packetHistory, result.packet],
      events: [...state.events, ...result.events],
      simState: 'running',
    }));
  },

  advancePacket: (packetId) => {
    const { activePackets, simConfig, devices, links } = get();
    const packet = activePackets.find(p => p.id === packetId);
    if (!packet || packet.status === 'delivered' || packet.status === 'dropped' || packet.status === 'corrupted') return;

    const result = processHop(packet, simConfig, devices, links);

    set(state => {
      let newActive = state.activePackets.map(p =>
        p.id === packetId ? result.packet : p
      );
      let newHistory = state.packetHistory.map(p =>
        p.id === packetId ? result.packet : p
      );

      // Handle retransmission — create new packet on the same path
      if (result.packet.status === 'retransmitting') {
        const retransmitPacket: Packet = {
          ...packet,
          id: genId(),
          status: 'created',
          currentHop: 0,
          crcValid: true,
          hopTimestamps: [Date.now()],
          createdAt: Date.now(),
          retransmissionOf: packet.id,
        };
        newActive = newActive.filter(p => p.id !== packetId);
        newActive.push(retransmitPacket);
        newHistory.push(retransmitPacket);
      }

      // Remove delivered/dropped/corrupted from active
      if (result.packet.status === 'delivered' || result.packet.status === 'dropped' || result.packet.status === 'corrupted') {
        newActive = newActive.filter(p => p.id !== packetId);
      }

      // Add ACK packet if generated
      if (result.ack) {
        newActive.push(result.ack);
        newHistory.push(result.ack);
      }

      // Update utilization on links used by this packet in this hop
      const updatedLinks = state.links.map(l => {
        const isUsed = (() => {
          if (result.packet.currentHop === 0) return false;
          const prev = result.packet.path[result.packet.currentHop - 1];
          const curr = result.packet.path[result.packet.currentHop];
          return (l.source === prev && l.target === curr) || (l.source === curr && l.target === prev);
        })();

        // Utilization increment scales inversely with link bandwidth + global congestion factor
        const congestionBase = (simConfig.congestion / 100) * 0.5;
        const increment = Math.max(0.05, Math.min(0.5, 15 / l.bandwidth));
        const targetUtil = isUsed
          ? Math.min(1, l.utilization + increment)
          : Math.max(congestionBase, l.utilization - 0.05);
        return { ...l, utilization: targetUtil };
      });

      // Update device loads
      const updatedDevices = state.devices.map(d => {
        const isCurrentNode = d.id === result.packet.path[result.packet.currentHop];
        return isCurrentNode
          ? { ...d, load: Math.min(1, d.load + 0.2) }
          : { ...d, load: Math.max(0, d.load - 0.03) };
      });

      const allHistory = newHistory;
      const metrics = computeMetrics(allHistory);

      return {
        activePackets: newActive,
        packetHistory: newHistory,
        events: [...state.events, ...result.events],
        links: updatedLinks,
        devices: updatedDevices,
        metrics,
        metricsHistory: [...state.metricsHistory, { time: Date.now(), metrics }],
        simState: newActive.length > 0 ? 'running' : 'idle',
      };
    });
  },

  startSim: () => {
    const { activePackets, lastPacketConfig, sendPacket } = get();
    if (activePackets.length === 0 && lastPacketConfig) {
      sendPacket(lastPacketConfig.srcId, lastPacketConfig.dstId, lastPacketConfig.protocol, lastPacketConfig.size);
    } else {
      set({ simState: 'running' });
    }
  },
  pauseSim: () => set({ simState: 'paused' }),
  stopSim: () => set({
    activePackets: [],
    simState: 'idle',
    devices: get().devices.map(d => ({ ...d, load: 0 })),
    links: get().links.map(l => ({ ...l, utilization: 0 })),
  }),

  resetSim: () => set({
    activePackets: [],
    packetHistory: [],
    events: [],
    metrics: { ...EMPTY_METRICS },
    metricsHistory: [],
    simState: 'idle',
    devices: get().devices.map(d => ({ ...d, load: 0 })),
    links: get().links.map(l => ({ ...l, utilization: 0 })),
  }),

  resetWorkspace: () => set({
    devices: [],
    links: [],
    selectedDeviceId: null,
    selectedLinkId: null,
    activePreset: null,
    activePackets: [],
    packetHistory: [],
    events: [],
    metrics: { ...EMPTY_METRICS },
    metricsHistory: [],
    simState: 'idle',
  }),

  setSpeed: (speed) => set(state => ({
    simConfig: { ...state.simConfig, speed },
  })),

  setConditions: (config) => set(state => ({
    simConfig: { ...state.simConfig, ...config },
  })),

  /* ─── Persistence ─── */
  saveProject: (name) => {
    const { devices, links, simConfig } = get();
    const data = {
      version: '1.0.0',
      name,
      devices,
      links,
      config: simConfig,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(`packetflow_${name}`, JSON.stringify(data));
  },

  loadPresetScenario: (preset) => {
    let presetDevices: Device[] = [];
    let presetLinks: Link[] = [];
    let presetConfig: SimConfig = { ...DEFAULT_CONFIG };

    if (preset === 'congestion') {
      presetDevices = [
        { id: 'server-1', label: 'Server #1', type: 'server', ip: '192.168.1.10', mac: '00:1A:2B:3C:4D:01', status: 'active', position: { x: 120, y: 180 }, load: 0.8 },
        { id: 'router-1', label: 'Router #1', type: 'router', ip: '192.168.1.1', mac: '00:1A:2B:3C:4D:02', status: 'active', position: { x: 380, y: 180 }, load: 0.4 },
        { id: 'pc-1', label: 'PC #1', type: 'pc', ip: '192.168.1.50', mac: '00:1A:2B:3C:4D:03', status: 'active', position: { x: 640, y: 180 }, load: 0.1 },
      ];
      presetLinks = [
        { id: 'l1', source: 'server-1', target: 'router-1', bandwidth: 10, latency: 5, cost: 1, status: 'active', utilization: 0.85 },
        { id: 'l2', source: 'router-1', target: 'pc-1', bandwidth: 100, latency: 2, cost: 1, status: 'active', utilization: 0.15 },
      ];
      presetConfig = { ...DEFAULT_CONFIG, speed: 0.25, congestion: 75, packetLoss: 5 };
    } else if (preset === 'retransmission') {
      presetDevices = [
        { id: 'pc-1', label: 'PC #1', type: 'pc', ip: '10.0.0.5', mac: 'AA:BB:CC:DD:EE:01', status: 'active', position: { x: 140, y: 180 }, load: 0.2 },
        { id: 'router-1', label: 'Router #1', type: 'router', ip: '10.0.0.1', mac: 'AA:BB:CC:DD:EE:02', status: 'active', position: { x: 390, y: 180 }, load: 0.5 },
        { id: 'server-1', label: 'Server #1', type: 'server', ip: '10.0.0.100', mac: 'AA:BB:CC:DD:EE:03', status: 'active', position: { x: 640, y: 180 }, load: 0.2 },
      ];
      presetLinks = [
        { id: 'l1', source: 'pc-1', target: 'router-1', bandwidth: 100, latency: 10, cost: 1, status: 'active', utilization: 0.2 },
        { id: 'l2', source: 'router-1', target: 'server-1', bandwidth: 50, latency: 25, cost: 1, status: 'active', utilization: 0.4 },
      ];
      presetConfig = { ...DEFAULT_CONFIG, speed: 0.25, packetLoss: 40, corruptionRate: 20, latencyMultiplier: 2 };
    } else if (preset === 'mesh_routing') {
      presetDevices = [
        { id: 'pc-1', label: 'PC #1', type: 'pc', ip: '172.16.0.10', mac: '52:54:00:12:34:56', status: 'active', position: { x: 100, y: 180 }, load: 0.1 },
        { id: 'router-1', label: 'Router #1', type: 'router', ip: '172.16.0.1', mac: '52:54:00:12:34:01', status: 'active', position: { x: 300, y: 90 }, load: 0.1 },
        { id: 'router-2', label: 'Router #2', type: 'router', ip: '172.16.0.2', mac: '52:54:00:12:34:02', status: 'active', position: { x: 300, y: 270 }, load: 0.1 },
        { id: 'router-3', label: 'Router #3', type: 'router', ip: '172.16.0.3', mac: '52:54:00:12:34:03', status: 'active', position: { x: 500, y: 180 }, load: 0.1 },
        { id: 'server-1', label: 'Server #1', type: 'server', ip: '172.16.0.100', mac: '52:54:00:12:34:99', status: 'active', position: { x: 700, y: 180 }, load: 0.1 },
      ];
      presetLinks = [
        { id: 'l1', source: 'pc-1', target: 'router-1', bandwidth: 100, latency: 5, cost: 1, status: 'active', utilization: 0.1 },
        { id: 'l2', source: 'pc-1', target: 'router-2', bandwidth: 100, latency: 20, cost: 4, status: 'active', utilization: 0.1 },
        { id: 'l3', source: 'router-1', target: 'router-3', bandwidth: 100, latency: 5, cost: 1, status: 'active', utilization: 0.1 },
        { id: 'l4', source: 'router-2', target: 'router-3', bandwidth: 100, latency: 5, cost: 1, status: 'active', utilization: 0.1 },
        { id: 'l5', source: 'router-3', target: 'server-1', bandwidth: 100, latency: 5, cost: 1, status: 'active', utilization: 0.1 },
      ];
      presetConfig = { ...DEFAULT_CONFIG, speed: 0.25, routingAlgorithm: 'dijkstra' };
    } else if (preset === 'star_topology') {
      presetDevices = [
        { id: 'switch-1', label: 'Switch #1', type: 'switch', ip: '192.168.1.1', mac: '00:50:56:C0:00:01', status: 'active', position: { x: 400, y: 200 }, load: 0.3 },
        { id: 'pc-1', label: 'PC #1', type: 'pc', ip: '192.168.1.10', mac: '00:50:56:C0:00:10', status: 'active', position: { x: 180, y: 100 }, load: 0.1 },
        { id: 'pc-2', label: 'PC #2', type: 'pc', ip: '192.168.1.11', mac: '00:50:56:C0:00:11', status: 'active', position: { x: 180, y: 300 }, load: 0.1 },
        { id: 'pc-3', label: 'PC #3', type: 'pc', ip: '192.168.1.12', mac: '00:50:56:C0:00:12', status: 'active', position: { x: 620, y: 300 }, load: 0.1 },
        { id: 'server-1', label: 'Server #1', type: 'server', ip: '192.168.1.100', mac: '00:50:56:C0:00:99', status: 'active', position: { x: 620, y: 100 }, load: 0.6 },
      ];
      presetLinks = [
        { id: 'l1', source: 'pc-1', target: 'switch-1', bandwidth: 100, latency: 1, cost: 1, status: 'active', utilization: 0.1 },
        { id: 'l2', source: 'pc-2', target: 'switch-1', bandwidth: 100, latency: 1, cost: 1, status: 'active', utilization: 0.1 },
        { id: 'l3', source: 'pc-3', target: 'switch-1', bandwidth: 100, latency: 1, cost: 1, status: 'active', utilization: 0.1 },
        { id: 'l4', source: 'server-1', target: 'switch-1', bandwidth: 1000, latency: 1, cost: 1, status: 'active', utilization: 0.3 },
      ];
      presetConfig = { ...DEFAULT_CONFIG, speed: 0.25, congestion: 10, packetLoss: 0 };
    } else if (preset === 'ring_redundancy') {
      presetDevices = [
        { id: 'pc-1', label: 'PC #1', type: 'pc', ip: '10.1.1.10', mac: 'AA:11:22:33:44:01', status: 'active', position: { x: 100, y: 200 }, load: 0.1 },
        { id: 'router-1', label: 'Router #1', type: 'router', ip: '10.1.1.1', mac: 'AA:11:22:33:44:02', status: 'active', position: { x: 280, y: 110 }, load: 0.2 },
        { id: 'router-2', label: 'Router #2', type: 'router', ip: '10.1.2.1', mac: 'AA:11:22:33:44:03', status: 'active', position: { x: 520, y: 110 }, load: 0.2 },
        { id: 'router-3', label: 'Router #3', type: 'router', ip: '10.1.3.1', mac: 'AA:11:22:33:44:04', status: 'active', position: { x: 520, y: 290 }, load: 0.2 },
        { id: 'router-4', label: 'Router #4', type: 'router', ip: '10.1.4.1', mac: 'AA:11:22:33:44:05', status: 'active', position: { x: 280, y: 290 }, load: 0.2 },
        { id: 'server-1', label: 'Server #1', type: 'server', ip: '10.1.3.100', mac: 'AA:11:22:33:44:99', status: 'active', position: { x: 700, y: 290 }, load: 0.4 },
      ];
      presetLinks = [
        { id: 'l1', source: 'pc-1', target: 'router-1', bandwidth: 100, latency: 2, cost: 1, status: 'active', utilization: 0.1 },
        { id: 'l2', source: 'router-1', target: 'router-2', bandwidth: 100, latency: 5, cost: 1, status: 'active', utilization: 0.2 },
        { id: 'l3', source: 'router-2', target: 'router-3', bandwidth: 100, latency: 5, cost: 1, status: 'active', utilization: 0.2 },
        { id: 'l4', source: 'router-3', target: 'router-4', bandwidth: 100, latency: 5, cost: 1, status: 'active', utilization: 0.2 },
        { id: 'l5', source: 'router-4', target: 'router-1', bandwidth: 100, latency: 5, cost: 1, status: 'active', utilization: 0.2 },
        { id: 'l6', source: 'router-3', target: 'server-1', bandwidth: 100, latency: 2, cost: 1, status: 'active', utilization: 0.2 },
      ];
      presetConfig = { ...DEFAULT_CONFIG, speed: 0.25, routingAlgorithm: 'bellman-ford' };
    } else if (preset === 'high_latency_sat') {
      presetDevices = [
        { id: 'pc-1', label: 'PC Station', type: 'pc', ip: '192.168.0.5', mac: '00:E0:4C:00:00:01', status: 'active', position: { x: 120, y: 200 }, load: 0.1 },
        { id: 'router-1', label: 'Ground Station', type: 'router', ip: '192.168.0.1', mac: '00:E0:4C:00:00:02', status: 'active', position: { x: 330, y: 200 }, load: 0.3 },
        { id: 'router-2', label: 'Sat Transceiver', type: 'router', ip: '10.254.0.1', mac: '00:E0:4C:00:00:03', status: 'active', position: { x: 540, y: 200 }, load: 0.5 },
        { id: 'server-1', label: 'Cloud Server', type: 'server', ip: '10.254.0.100', mac: '00:E0:4C:00:00:99', status: 'active', position: { x: 750, y: 200 }, load: 0.4 },
      ];
      presetLinks = [
        { id: 'l1', source: 'pc-1', target: 'router-1', bandwidth: 100, latency: 2, cost: 1, status: 'active', utilization: 0.1 },
        { id: 'l2', source: 'router-1', target: 'router-2', bandwidth: 50, latency: 350, cost: 10, status: 'active', utilization: 0.6 },
        { id: 'l3', source: 'router-2', target: 'server-1', bandwidth: 1000, latency: 5, cost: 1, status: 'active', utilization: 0.2 },
      ];
      presetConfig = { ...DEFAULT_CONFIG, speed: 0.25, latencyMultiplier: 4, congestion: 30 };
    }

    set({
      devices: presetDevices,
      links: presetLinks,
      simConfig: presetConfig,
      activePreset: preset,
      activePackets: [],
      packetHistory: [],
      events: [],
      metrics: { ...EMPTY_METRICS },
      metricsHistory: [],
      simState: 'idle',
      selectedDeviceId: null,
      selectedLinkId: null,
    });
  },

  loadProject: (json) => {
    try {
      const data = JSON.parse(json);
      if (!data.devices || !data.links) return false;
      set({
        devices: data.devices,
        links: data.links,
        simConfig: data.config ?? { ...DEFAULT_CONFIG },
        activePackets: [],
        packetHistory: [],
        events: [],
        metrics: { ...EMPTY_METRICS },
        metricsHistory: [],
        simState: 'idle',
        selectedDeviceId: null,
        selectedLinkId: null,
      });
      return true;
    } catch {
      return false;
    }
  },

  getProjectJSON: () => {
    const { devices, links, simConfig } = get();
    return JSON.stringify({
      version: '1.0.0',
      name: 'PacketFlow Project',
      devices,
      links,
      config: simConfig,
      savedAt: new Date().toISOString(),
    }, null, 2);
  },

  /* ─── Events ─── */
  pushEvent: (event) => set(state => ({
    events: [...state.events, event],
  })),

  clearEvents: () => set({ events: [] }),
}));
