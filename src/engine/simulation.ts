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
    description: `Packet #${packet.seqNum} created: ${sourceDevice.label} (${sourceDevice.ip}) → ${destDevice.label} (${destDevice.ip}) [${protocol}] — routed via ${algoLabel} (${result.iterations} relaxations, cost ${result.totalCost.toFixed(1)})`,
  }];

  return { packet, events };
}

/**
 * Calculate quantitative computer network formula metrics for a packet hop:
 * - Transmission Delay (T_trans = L / B)
 * - Propagation Delay (T_prop = d / s)
 * - Queueing Delay (T_queue = f(Congestion))
 * - Total Hop Delay (T_total)
 * - Bandwidth-Delay Product (BDP)
 */
export function calculateHopMetrics(
  packetSizeBytes: number,
  linkBandwidthMbps: number,
  linkLatencyMs: number,
  config: SimConfig
) {
  const packetBits = packetSizeBytes * 8;
  const bandwidthBps = (linkBandwidthMbps || 100) * 1_000_000;
  
  // T_trans = (L bits) / (B bps) in milliseconds
  const transDelayMs = (packetBits / bandwidthBps) * 1000;

  // Jitter variation offset
  const jitterOffsetMs = config.jitter > 0 ? ((Math.random() * 2 - 1) * config.jitter * 0.15) : 0;
  
  // T_prop = Link Latency * Multiplier + Jitter
  const propDelayMs = Math.max(0.1, (linkLatencyMs || 10) * config.latencyMultiplier + jitterOffsetMs);

  // T_queue = Congestion% * 15ms queueing overhead
  const congestionPct = config.congestion ?? 0;
  const queueDelayMs = (congestionPct / 100) * 15.0;

  // Total hop delay
  const totalHopDelayMs = transDelayMs + propDelayMs + queueDelayMs;

  // BDP = Bandwidth (bps) * RTT (sec) in Bytes
  const rttSec = (totalHopDelayMs * 2) / 1000;
  const bdpBytes = Math.round((bandwidthBps * rttSec) / 8);

  return {
    packetBits,
    transDelayMs: Number(transDelayMs.toFixed(3)),
    propDelayMs: Number(propDelayMs.toFixed(1)),
    queueDelayMs: Number(queueDelayMs.toFixed(1)),
    totalHopDelayMs: Number(totalHopDelayMs.toFixed(2)),
    bdpBytes,
    bdpKB: Number((bdpBytes / 1024).toFixed(1)),
  };
}

/**
 * Process a single hop for a packet.
 * Returns updated packet + generated events.
 */
export function processHop(
  packet: Packet,
  config: SimConfig,
  devices: Device[],
  links: Link[],
): { packet: Packet; events: SimEvent[]; ack?: Packet } {
  const events: SimEvent[] = [];
  const now = Date.now();
  let updatedPacket = { ...packet, hopTimestamps: [...packet.hopTimestamps] };
  let ack: Packet | undefined;

  // Find link between previous hop and current hop to calculate physics formulas
  const prevDeviceId = packet.path[packet.currentHop];
  const nextDeviceId = packet.path[packet.currentHop + 1];
  const activeLink = links.find(
    l => (l.source === prevDeviceId && l.target === nextDeviceId) ||
         (l.source === nextDeviceId && l.target === prevDeviceId)
  );

  const bwMbps = activeLink?.bandwidth ?? 100;
  const latMs = activeLink?.latency ?? 10;

  const hopMetrics = calculateHopMetrics(packet.size, bwMbps, latMs, config);

  // Decrement TTL
  updatedPacket.ttl--;
  if (updatedPacket.ttl <= 0) {
    updatedPacket.status = 'dropped';
    events.push({
      id: genId(), time: now, type: 'packet_dropped',
      packetId: packet.id,
      description: `Packet #${packet.seqNum} (${packet.size} B) dropped: TTL expired [Hop ${packet.currentHop + 1}]`,
    });
    return { packet: updatedPacket, events };
  }

  // ─── Apply packet loss ───
  if (Math.random() * 100 < config.packetLoss) {
    updatedPacket.status = 'dropped';
    events.push({
      id: genId(), time: now, type: 'packet_dropped',
      packetId: packet.id,
      description: `Packet #${packet.seqNum} (${packet.size} B) dropped at hop ${packet.currentHop + 1} — [Loss Rate: ${config.packetLoss}% | P_loss: ${(config.packetLoss/100).toFixed(2)}]`,
    });

    // TCP protocol attempts retransmission on packet loss
    const retryCount = (packet as any).retryCount ?? 0;
    if (packet.protocol === 'TCP' && retryCount < 3) {
      updatedPacket.status = 'retransmitting';
      (updatedPacket as any).retryCount = retryCount + 1;
      events.push({
        id: genId(), time: now, type: 'retransmission',
        packetId: packet.id,
        description: `TCP Retransmission #${retryCount + 1} scheduled for packet #${packet.seqNum} (Packet Loss recovery)`,
      });
    }

    return { packet: updatedPacket, events };
  }

  // ─── Advance hop ───
  updatedPacket.currentHop++;
  updatedPacket.hopTimestamps.push(now);
  updatedPacket.status = 'in-transit';

  const currentDevice = devices.find(d => d.id === packet.path[updatedPacket.currentHop]);
  const currentDeviceStr = currentDevice ? `${currentDevice.label} (${currentDevice.ip})` : 'unknown node';

  // 1. Packet Hop (Physical/Link Layer arrival with exact T_trans, T_prop, T_queue calculations)
  events.push({
    id: genId(), time: now, type: 'packet_hop',
    packetId: packet.id,
    description: `Packet #${packet.seqNum} (${packet.size} B / ${hopMetrics.packetBits} bits) arrived at ${currentDeviceStr} — [T_trans: ${hopMetrics.transDelayMs} ms | T_prop: ${hopMetrics.propDelayMs} ms | T_queue: ${hopMetrics.queueDelayMs} ms | Latency: ${hopMetrics.totalHopDelayMs} ms]`,
  });

  // ─── Apply corruption ───
  if (Math.random() * 100 < config.corruptionRate) {
    updatedPacket.crcValid = false;
    updatedPacket.status = 'corrupted';
    events.push({
      id: genId(), time: now, type: 'crc_fail',
      packetId: packet.id,
      description: `CRC FAILED for packet #${packet.seqNum} at ${currentDeviceStr} — checksum mismatch at BER ${(config.corruptionRate).toFixed(1)}%`,
    });
    events.push({
      id: genId(), time: now, type: 'packet_corrupted',
      packetId: packet.id,
      description: `Packet #${packet.seqNum} (${packet.size} B) corrupted at ${currentDeviceStr}`,
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

  // 2. CRC Pass (Data Link Layer checksum & bit validation)
  events.push({
    id: genId(), time: now, type: 'crc_pass',
    packetId: packet.id,
    description: `CRC PASSED for packet #${packet.seqNum} at ${currentDeviceStr} — [Size: ${packet.size} B | CRC-32: ${packet.crc} | Checksum: ${packet.checksum}]`,
  });

  // 3. Check if delivered (Transport/Network Layer payload delivery)
  if (updatedPacket.currentHop >= updatedPacket.path.length - 1) {
    updatedPacket.status = 'delivered';
    updatedPacket.deliveredAt = now;
    const totalLatencyEst = (hopMetrics.totalHopDelayMs * updatedPacket.currentHop).toFixed(1);
    const goodputKbps = ((packet.size * 8) / hopMetrics.totalHopDelayMs).toFixed(1);

    const destDevice = devices.find(d => d.id === packet.destDeviceId);
    const destStr = destDevice ? `${destDevice.label} (${destDevice.ip})` : updatedPacket.destIP;

    events.push({
      id: genId(), time: now, type: 'packet_delivered',
      packetId: packet.id,
      description: `Packet #${packet.seqNum} (${packet.size} B) delivered to ${destStr} — [Total Latency: ~${totalLatencyEst} ms | Goodput: ${goodputKbps} Kbps | BDP: ${hopMetrics.bdpKB} KB]`,
    });

    // Generate ACK for TCP
    if (packet.protocol === 'TCP') {
      const srcDevice = devices.find(d => d.id === packet.sourceDeviceId);
      const srcStr = srcDevice ? `${srcDevice.label} (${srcDevice.ip})` : updatedPacket.sourceIP;

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
        checksum: simpleChecksum(`ACK-${packet.seqNum}`),
        crc: computeCRC32(`ACK-${packet.seqNum}`),
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
        description: `ACK sent from ${destStr} to ${srcStr} for packet #${packet.seqNum} (Seq #${updatedPacket.seqNum}, Ack #${updatedPacket.seqNum + 1}, Size 40 B) — [RTT: ~${(hopMetrics.totalHopDelayMs * 2).toFixed(1)} ms]`,
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
