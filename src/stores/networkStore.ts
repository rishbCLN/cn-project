import { create } from 'zustand';
import {
  Device, Link, Packet, Protocol, SimState, SimConfig, SimEvent, Metrics, MetricSnapshot, DeviceType,
} from '../types';
import { createPacket, processHop, computeMetrics } from '../engine/simulation';
import { genId, nextIP } from '../utils/helpers';

interface NetworkStore {
  /* ─── Topology ─── */
  devices: Device[];
  links: Link[];
  selectedDeviceId: string | null;
  selectedLinkId: string | null;

  /* ─── Simulation ─── */
  simState: SimState;
  simConfig: SimConfig;

  /* ─── Packets ─── */
  activePackets: Packet[];
  packetHistory: Packet[];

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

  addLink: (source: string, target: string) => void;
  removeLink: (id: string) => void;
  updateLink: (id: string, updates: Partial<Link>) => void;
  selectLink: (id: string | null) => void;
  toggleLinkStatus: (id: string) => void;

  updateDevicePosition: (id: string, position: { x: number; y: number }) => void;

  /* ─── Simulation Actions ─── */
  sendPacket: (srcId: string, dstId: string, protocol: Protocol, size: number) => void;
  advancePacket: (packetId: string) => void;
  startSim: () => void;
  pauseSim: () => void;
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
  speed: 1,
  packetLoss: 0,
  latencyMultiplier: 1,
  jitter: 0,
  corruptionRate: 0,
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
  simState: 'idle',
  simConfig: { ...DEFAULT_CONFIG },
  activePackets: [],
  packetHistory: [],
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
      label: `${labelMap[type]}${existingCount + 1}`,
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
  addLink: (source, target) => {
    // Prevent duplicate links
    const exists = get().links.some(
      l => (l.source === source && l.target === target) || (l.source === target && l.target === source)
    );
    if (exists || source === target) return;

    const link: Link = {
      id: genId(),
      source,
      target,
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

    const result = createPacket(src, dst, protocol, size, devices, links);
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

      // Update utilization on links used by this packet
      const updatedLinks = state.links.map(l => {
        const isUsed = result.packet.path.some((nodeId, idx) => {
          if (idx >= result.packet.path.length - 1) return false;
          const next = result.packet.path[idx + 1];
          return (l.source === nodeId && l.target === next) || (l.source === next && l.target === nodeId);
        });
        return isUsed
          ? { ...l, utilization: Math.min(1, l.utilization + 0.15) }
          : { ...l, utilization: Math.max(0, l.utilization - 0.02) };
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

  startSim: () => set({ simState: 'running' }),
  pauseSim: () => set({ simState: 'paused' }),

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
