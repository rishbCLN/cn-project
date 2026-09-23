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
/** Reset the packet sequence counter — called on full sim/workspace/scenario reset. */
export function resetSeqCounter() { seqCounter = 0; }

/**
 * Calculate exact theoretical Round Trip Time (RTT) across all nodes/hops in the path.
 * RTT = T_forward (all hops in path) + T_return (all hops for ACK)
 *
 * For each hop link i along the path of N hops (N+1 nodes):
 *   T_trans = (PacketSize * 8) / (Bandwidth_bps) * 1000 ms
 *   T_prop  = Link_Latency_ms * LatencyMultiplier
 *   T_queue = (Congestion% / 100) * 15 ms + Device_Load_Delay
 *   T_proc  = 0.5 ms (Hardware switching/routing delay per node)
 *
 *   T_hop = T_trans + T_prop + T_queue + T_proc
 */
export function calculatePathRTT(
  path: string[],
  links: Link[],
  packetSizeBytes: number,
  config: SimConfig,
  devices?: Device[]
): {
  rttMs: number;
  forwardDelayMs: number;
  returnDelayMs: number;
  hopCount: number;
  nodeCount: number;
} {
  if (!path || path.length < 2) {
    return { rttMs: 0, forwardDelayMs: 0, returnDelayMs: 0, hopCount: 0, nodeCount: path ? path.length : 0 };
  }

  const hopCount = path.length - 1;
  const nodeCount = path.length;

  let totalForwardMs = 0;
  let totalReturnMs = 0;

  for (let i = 0; i < hopCount; i++) {
    const fromId = path[i];
    const toId = path[i + 1];

    const link = links.find(
      l => (l.source === fromId && l.target === toId) || (l.source === toId && l.target === fromId)
    );

    const bwMbps = link ? (link.bandwidth || 100) : 100;
    const latencyMs = link ? (link.latency || 10) : 10;
    const bwBps = bwMbps * 1_000_000;

    const fromDev = devices?.find(d => d.id === fromId);
    const devLoadDelay = fromDev ? (fromDev.load || 0) * 5.0 : 0;

    // Forward Hop Delay (Data Payload Size)
    const transMs = ((packetSizeBytes * 8) / bwBps) * 1000;
    const propMs = Math.max(0.1, latencyMs * (config.latencyMultiplier || 1));
    const queueMs = ((config.congestion || 0) / 100) * 15.0 + devLoadDelay;
    const procMs = 0.5;

    totalForwardMs += (transMs + propMs + queueMs + procMs);

    // Return Hop Delay (40 Byte TCP ACK / ICMP Reply)
    const ackTransMs = ((40 * 8) / bwBps) * 1000;
    totalReturnMs += (ackTransMs + propMs + queueMs + procMs);
  }

  const rttMs = totalForwardMs + totalReturnMs;

  return {
    rttMs: Number(rttMs.toFixed(2)),
    forwardDelayMs: Number(totalForwardMs.toFixed(2)),
    returnDelayMs: Number(totalReturnMs.toFixed(2)),
    hopCount,
    nodeCount,
  };
}

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
  config?: SimConfig
): { packet: Packet; events: SimEvent[] } | null {
  const graph = buildGraph(devices, links);
  const result = findPath(graph, sourceDevice.id, destDevice.id, routingAlgorithm);

  if (!result) return null;

  const simConf: SimConfig = config || {
    speed: 1, packetLoss: 0, latencyMultiplier: 1, jitter: 0, corruptionRate: 0, congestion: 0, routingAlgorithm
  };

  const rttInfo = calculatePathRTT(result.path, links, size, simConf, devices);

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
    rttMs: rttInfo.rttMs,
  };

  const algoLabel = routingAlgorithm === 'bellman-ford' ? 'Bellman-Ford' : 'Dijkstra';

  const events: SimEvent[] = [{
    id: genId(),
    time: now,
    type: 'packet_created',
    packetId: packet.id,
    description: `Packet #${packet.seqNum} created: ${sourceDevice.label} (${sourceDevice.ip}) → ${destDevice.label} (${destDevice.ip}) [${protocol}] — Path: ${rttInfo.hopCount} Hops across ${rttInfo.nodeCount} Nodes (Exact RTT: ${rttInfo.rttMs} ms) via ${algoLabel}`,
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
 *
 * REACTIVE TOPOLOGY: Before advancing, validates that the next-hop link
 * is still active. If the link was severed or removed, attempts a live
 * reroute from the packet's current position. If no alternative path
 * exists, the packet is dropped gracefully — the simulation continues.
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

  // Degenerate single-node path (source === destination): there is no hop to make,
  // so deliver immediately rather than advancing to a non-existent next node.
  if (packet.path.length < 2) {
    updatedPacket.status = 'delivered';
    updatedPacket.deliveredAt = now;
    return { packet: updatedPacket, events };
  }

  // ─── REACTIVE: Validate next-hop link AND device are still alive ───
  const prevDeviceId = packet.path[packet.currentHop];
  const nextDeviceId = packet.path[packet.currentHop + 1];

  if (nextDeviceId) {
    const nextDevice = devices.find(d => d.id === nextDeviceId);
    const nextLink = links.find(
      l => l.status === 'active' &&
        ((l.source === prevDeviceId && l.target === nextDeviceId) ||
         (l.source === nextDeviceId && l.target === prevDeviceId))
    );

    // Link severed/removed OR next-hop device disabled — attempt live reroute
    if (!nextLink || !nextDevice || nextDevice.status !== 'active') {
      const currentDevice = devices.find(d => d.id === prevDeviceId);
      const destDevice = devices.find(d => d.id === packet.destDeviceId);
      const currentLabel = currentDevice ? `${currentDevice.label} (${currentDevice.ip})` : prevDeviceId;
      const reason = !nextLink ? 'next-hop link severed' : `next hop ${nextDevice?.label ?? nextDeviceId} disabled`;

      // Try to find an alternative route from current position
      const graph = buildGraph(devices, links);
      const reroute = findPath(graph, prevDeviceId, packet.destDeviceId, config.routingAlgorithm);

      if (reroute) {
        // Reroute succeeded — splice in the new path from current position
        updatedPacket.path = [
          ...packet.path.slice(0, packet.currentHop),
          ...reroute.path,
        ];
        const destLabel = destDevice ? `${destDevice.label} (${destDevice.ip})` : packet.destIP;
        events.push({
          id: genId(), time: now, type: 'reroute',
          packetId: packet.id,
          description: `⚡ REROUTE: Packet #${packet.seqNum} at ${currentLabel} — ${reason}, rerouted to ${destLabel} via new path (cost ${reroute.totalCost.toFixed(1)}, ${reroute.path.length - 1} hops)`,
        });
        // Continue processing with the new path (fall through to normal hop logic)
      } else {
        // No alternative route — drop gracefully, do NOT pause simulation
        updatedPacket.status = 'dropped';
        events.push({
          id: genId(), time: now, type: 'packet_dropped',
          packetId: packet.id,
          description: `Packet #${packet.seqNum} dropped at ${currentLabel} — ${reason} and no alternative route to ${destDevice?.label ?? packet.destIP}`,
        });
        return { packet: updatedPacket, events };
      }
    }
  }

  // Find the (possibly rerouted) active link for physics calculations
  const activeLink = links.find(
    l => l.status === 'active' &&
      ((l.source === prevDeviceId && l.target === updatedPacket.path[packet.currentHop + 1]) ||
       (l.source === updatedPacket.path[packet.currentHop + 1] && l.target === prevDeviceId))
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
    const retryCount = packet.retryCount ?? 0;
    if (packet.protocol === 'TCP' && retryCount < 3) {
      updatedPacket.status = 'retransmitting';
      updatedPacket.retryCount = retryCount + 1;
      events.push({
        id: genId(), time: now, type: 'retransmission',
        packetId: packet.id,
        description: `TCP Retransmission #${retryCount + 1} scheduled for packet #${packet.seqNum} (Packet Loss recovery)`,
      });
    } else if (packet.protocol === 'TCP') {
      // Retransmission budget exhausted — the sender's RTO fires with no ACK.
      events.push({
        id: genId(), time: now, type: 'timeout',
        packetId: packet.id,
        description: `TCP timeout: packet #${packet.seqNum} abandoned after ${retryCount} retransmission attempts — RTO exceeded, no ACK received`,
      });
    }

    return { packet: updatedPacket, events };
  }

  // ─── Advance hop ───
  updatedPacket.currentHop++;
  updatedPacket.hopTimestamps.push(now);
  updatedPacket.status = 'in-transit';

  // The very first advance from the source node = the packet is actually placed
  // on the wire (distinct from 'packet_created', which is just its construction).
  if (packet.currentHop === 0) {
    const srcDev = devices.find(d => d.id === packet.sourceDeviceId);
    const srcStr = srcDev ? `${srcDev.label} (${srcDev.ip})` : packet.sourceIP;
    events.push({
      id: genId(), time: now, type: 'packet_sent',
      packetId: packet.id,
      description: `Packet #${packet.seqNum} (${packet.size} B) sent from ${srcStr} onto the wire [${packet.protocol}${packet.isAck ? ' ACK' : ''}]`,
    });
  }

  const currentDevice = devices.find(d => d.id === updatedPacket.path[updatedPacket.currentHop]);
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

    // TCP packets will be retransmitted — capped + incremented exactly like
    // the packet-loss path, so corruption can't trigger unbounded retries.
    const corruptRetry = packet.retryCount ?? 0;
    if (packet.protocol === 'TCP' && corruptRetry < 3) {
      updatedPacket.status = 'retransmitting';
      updatedPacket.retryCount = corruptRetry + 1;
      events.push({
        id: genId(), time: now, type: 'retransmission',
        packetId: packet.id,
        description: `TCP Retransmission #${corruptRetry + 1} scheduled for packet #${packet.seqNum} (corruption recovery)`,
      });
    } else if (packet.protocol === 'TCP') {
      events.push({
        id: genId(), time: now, type: 'timeout',
        packetId: packet.id,
        description: `TCP timeout: packet #${packet.seqNum} abandoned after ${corruptRetry} retransmission attempts — repeated corruption, no valid ACK`,
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

    if (packet.isAck) {
      // The ACK has arrived back at the original sender — reliability loop closed.
      // An ACK is never itself acknowledged (otherwise ACKs would beget ACKs forever).
      events.push({
        id: genId(), time: now, type: 'ack_received',
        packetId: packet.id,
        description: `ACK for packet #${packet.seqNum} received at ${destStr} — round trip confirmed [RTT: ${updatedPacket.rttMs ?? (hopMetrics.totalHopDelayMs * 2).toFixed(1)} ms across ${updatedPacket.path.length} Nodes]`,
      });
    } else {
      events.push({
        id: genId(), time: now, type: 'packet_delivered',
        packetId: packet.id,
        description: `Packet #${packet.seqNum} (${packet.size} B) delivered to ${destStr} — [Total Latency: ~${totalLatencyEst} ms | Goodput: ${goodputKbps} Kbps | BDP: ${hopMetrics.bdpKB} KB]`,
      });

      // Generate ACK for delivered TCP data segments (never for ACKs themselves).
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
          rttMs: updatedPacket.rttMs,
        };
        events.push({
          id: genId(), time: now, type: 'ack_sent',
          packetId: ack.id,
          description: `ACK sent from ${destStr} to ${srcStr} for packet #${packet.seqNum} (Seq #${updatedPacket.seqNum}, Ack #${updatedPacket.seqNum + 1}, Size 40 B) — [Exact Path RTT: ${updatedPacket.rttMs ?? (hopMetrics.totalHopDelayMs * 2).toFixed(1)} ms across ${updatedPacket.path.length} Nodes]`,
        });
      }
    }
  }

  return { packet: updatedPacket, events, ack };
}

/**
 * Compute fresh metrics from packet history using exact path RTT.
 */
export function computeMetrics(history: Packet[]): Metrics {
  const dataPackets = history.filter(p => !p.isAck);

  // A retransmission chain is ONE logical flow: every generation shares the
  // root packet id via `retransmissionOf` (the store sets it to the original
  // id, not the immediate parent). Outcome metrics are measured per flow so a
  // packet delivered after N retries counts as one delivery — not one delivery
  // out of N+1 "sent" — which previously deflated the delivery rate under loss.
  const flows = new Map<string, Packet[]>();
  for (const p of dataPackets) {
    const rootId = p.retransmissionOf ?? p.id;
    const group = flows.get(rootId);
    if (group) group.push(p);
    else flows.set(rootId, [p]);
  }

  let sent = 0;
  let delivered = 0;
  let lost = 0;
  const deliveredPackets: Packet[] = [];
  for (const group of flows.values()) {
    sent++;
    // At most one generation per flow can reach 'delivered' (delivery ends the
    // flow); the rest are transient 'retransmitting'/in-flight states.
    const deliveredPkt = group.find(p => p.status === 'delivered');
    if (deliveredPkt) {
      delivered++;
      deliveredPackets.push(deliveredPkt);
    } else if (group.some(p => p.status === 'dropped' || p.status === 'corrupted')) {
      // Terminal failure: retries exhausted (TCP) or a single-shot UDP drop /
      // corruption. Flows still in flight fall through and count toward neither.
      lost++;
    }
  }

  // Diagnostic counters stay per-attempt/event: `corrupted` is every CRC failure
  // (keyed off crcValid, so recovered TCP corruptions still register as events),
  // and `retransmissions` is the total number of retry attempts.
  const corrupted = dataPackets.filter(p => p.crcValid === false).length;
  const retransmissions = dataPackets.filter(p => p.retransmissionOf).length;

  const rtts = deliveredPackets.map(p => p.rttMs ?? 0).filter(r => r > 0);
  const avgRTT = rtts.length > 0 ? Number((rtts.reduce((a, b) => a + b, 0) / rtts.length).toFixed(2)) : 0;

  const totalBytes = deliveredPackets.reduce((sum, p) => sum + p.size, 0);
  const timeSpan = deliveredPackets.length > 1
    ? (Math.max(...deliveredPackets.map(p => p.deliveredAt! || p.createdAt)) - Math.min(...deliveredPackets.map(p => p.createdAt)))
    : 1000;
  const throughput = (totalBytes * 8) / (Math.max(100, timeSpan) / 1000) / 1_000_000; // Mbps

  return {
    sent,
    delivered,
    lost,
    corrupted,
    retransmissions,
    avgRTT,
    throughput: Math.max(0, Number(throughput.toFixed(3))),
    deliveryRate: sent > 0 ? Number(((delivered / sent) * 100).toFixed(1)) : 0,
    errorRate: sent > 0 ? Number(((lost / sent) * 100).toFixed(1)) : 0,
  };
}
