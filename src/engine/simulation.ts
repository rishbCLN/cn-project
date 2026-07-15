/**
 * Simulation Engine
 * Manages the packet lifecycle: creation → routing → hop-by-hop animation → delivery/drop.
 * Handles conditions (loss, corruption, jitter), reliability (ACK, retransmit), and metrics.
 */

import { Device, Link, Packet, Protocol, SimConfig, SimEvent, Metrics, RoutingAlgorithm } from '../types';
import { buildGraph, findPath } from './routing';
import { computeCRC32 } from './crc';
import { genId, simpleChecksum } from '../utils/helpers';

/* ─── Sequence counter ─── */
let seqCounter = 0;

/**
 * Create a new packet with CRC and routing path.
 */
export function createPacket(
  sourceDevice: Device,
  destDevice: Device,
  protocol: Protocol,
  size: number,
  devices: Device[],
  links: Link[],
  routingAlgorithm: RoutingAlgorithm = 'dijkstra',
): { packet: Packet; events: SimEvent[] } | null {
  const graph = buildGraph(devices, links);
  const result = findPath(graph, sourceDevice.id, destDevice.id, routingAlgorithm);

  if (!result) return null;

  const payload = `DATA-${genId()}-${'X'.repeat(Math.max(0, size - 20))}`;
  const crc = computeCRC32(payload);
  const now = Date.now();
  seqCounter++;

  const packet: Packet = {
    id: genId(),
    sourceIP: sourceDevice.ip,
    sourceDeviceId: sourceDevice.id,
    destIP: destDevice.ip,
    destDeviceId: destDevice.id,
    protocol,
    size,
    ttl: 64,
    seqNum: seqCounter,
    ackNum: 0,
    checksum: simpleChecksum(payload),
    crc,
    crcValid: true,
    path: result.path,
    currentHop: 0,
    status: 'created',
    createdAt: now,
    hopTimestamps: [now],
  };

  const algoLabel = routingAlgorithm === 'bellman-ford' ? 'Bellman-Ford' : 'Dijkstra';

  const events: SimEvent[] = [{
    id: genId(),
    time: now,
    type: 'packet_created',
    packetId: packet.id,
    description: `Packet #${packet.seqNum} created: ${sourceDevice.ip} → ${destDevice.ip} [${protocol}] — routed via ${algoLabel} (${result.iterations} relaxations, cost ${result.totalCost.toFixed(1)})`,
  }];

  return { packet, events };
}

/**
 * Process a single hop for a packet.
 * Returns updated packet + generated events.
 */
export function processHop(
  packet: Packet,
  config: SimConfig,
  devices: Device[],
  _links: Link[],
): { packet: Packet; events: SimEvent[]; ack?: Packet } {
  const events: SimEvent[] = [];
  const now = Date.now();
  let updatedPacket = { ...packet, hopTimestamps: [...packet.hopTimestamps] };
  let ack: Packet | undefined;

  // Decrement TTL
  updatedPacket.ttl--;
  if (updatedPacket.ttl <= 0) {
    updatedPacket.status = 'dropped';
    events.push({
      id: genId(), time: now, type: 'packet_dropped',
      packetId: packet.id,
      description: `Packet #${packet.seqNum} dropped: TTL expired`,
    });
    return { packet: updatedPacket, events };
  }

  // ─── Apply packet loss ───
  if (Math.random() * 100 < config.packetLoss) {
    updatedPacket.status = 'dropped';
    events.push({
      id: genId(), time: now, type: 'packet_dropped',
      packetId: packet.id,
      description: `Packet #${packet.seqNum} dropped: Random loss (${config.packetLoss}% chance)`,
    });
    return { packet: updatedPacket, events };
  }

  // ─── Apply corruption ───
  if (Math.random() * 100 < config.corruptionRate) {
    updatedPacket.crcValid = false;
    updatedPacket.status = 'corrupted';
    events.push({
      id: genId(), time: now, type: 'packet_corrupted',
      packetId: packet.id,
      description: `Packet #${packet.seqNum} corrupted at hop ${packet.currentHop + 1}`,
    });
    events.push({
      id: genId(), time: now, type: 'crc_fail',
      packetId: packet.id,
      description: `CRC FAILED for packet #${packet.seqNum} — expected ${packet.crc}`,
    });

    // TCP packets will be retransmitted
    if (packet.protocol === 'TCP') {
      updatedPacket.status = 'retransmitting';
      events.push({
        id: genId(), time: now, type: 'retransmission',
        packetId: packet.id,
        description: `Retransmission scheduled for packet #${packet.seqNum} (TCP reliable delivery)`,
      });
    }

    return { packet: updatedPacket, events };
  }

  // ─── CRC pass ───
  events.push({
    id: genId(), time: now, type: 'crc_pass',
    packetId: packet.id,
    description: `CRC PASSED for packet #${packet.seqNum} at hop ${packet.currentHop + 1}`,
  });

  // ─── Advance hop ───
  updatedPacket.currentHop++;
  updatedPacket.hopTimestamps.push(now);
  updatedPacket.status = 'in-transit';

  events.push({
    id: genId(), time: now, type: 'packet_hop',
    packetId: packet.id,
    description: `Packet #${packet.seqNum} arrived at ${devices.find(d => d.id === packet.path[updatedPacket.currentHop])?.label ?? 'unknown'}`,
  });

  // ─── Check if delivered ───
  if (updatedPacket.currentHop >= updatedPacket.path.length - 1) {
    updatedPacket.status = 'delivered';
    updatedPacket.deliveredAt = now;
    events.push({
      id: genId(), time: now, type: 'packet_delivered',
      packetId: packet.id,
      description: `Packet #${packet.seqNum} delivered to ${updatedPacket.destIP}`,
    });

    // Generate ACK for TCP
    if (packet.protocol === 'TCP') {
      ack = {
        id: genId(),
        sourceIP: updatedPacket.destIP,
        sourceDeviceId: updatedPacket.destDeviceId,
        destIP: updatedPacket.sourceIP,
        destDeviceId: updatedPacket.sourceDeviceId,
        protocol: 'TCP',
        size: 40,
        ttl: 64,
        seqNum: updatedPacket.seqNum,
        ackNum: updatedPacket.seqNum + 1,
        checksum: '',
        crc: '',
        crcValid: true,
        path: [...updatedPacket.path].reverse(),
        currentHop: 0,
        status: 'in-transit',
        createdAt: now,
        hopTimestamps: [now],
        isAck: true,
      };
      events.push({
        id: genId(), time: now, type: 'ack_sent',
        packetId: ack.id,
        description: `ACK sent for packet #${packet.seqNum}`,
      });
    }
  }

  return { packet: updatedPacket, events, ack };
}

/**
 * Compute fresh metrics from packet history.
 */
export function computeMetrics(history: Packet[]): Metrics {
  const sent = history.filter(p => !p.isAck).length;
  const delivered = history.filter(p => p.status === 'delivered' && !p.isAck).length;
  const lost = history.filter(p => p.status === 'dropped' && !p.isAck).length;
  const corrupted = history.filter(p => (p.status === 'corrupted' || p.status === 'retransmitting') && !p.isAck).length;
  const retransmissions = history.filter(p => p.retransmissionOf).length;

  const deliveredPackets = history.filter(p => p.status === 'delivered' && p.deliveredAt && !p.isAck);
  const rtts = deliveredPackets.map(p => (p.deliveredAt ?? p.createdAt) - p.createdAt);
  const avgRTT = rtts.length > 0 ? rtts.reduce((a, b) => a + b, 0) / rtts.length : 0;

  const totalBytes = deliveredPackets.reduce((sum, p) => sum + p.size, 0);
  const timeSpan = deliveredPackets.length > 1
    ? (Math.max(...deliveredPackets.map(p => p.deliveredAt!)) - Math.min(...deliveredPackets.map(p => p.createdAt)))
    : 1000;
  const throughput = (totalBytes * 8) / (timeSpan / 1000) / 1_000_000; // Mbps

  return {
    sent,
    delivered,
    lost,
    corrupted,
    retransmissions,
    avgRTT,
    throughput: Math.max(0, throughput),
    deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
    errorRate: sent > 0 ? ((lost + corrupted) / sent) * 100 : 0,
  };
}
