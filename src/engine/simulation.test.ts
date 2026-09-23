import { describe, it, expect } from 'vitest';
import { processHop, computeMetrics } from './simulation';
import type { Device, DeviceStatus, Link, Packet, SimConfig } from '../types';

const dev = (id: string, status: DeviceStatus = 'active'): Device => ({
  id,
  type: 'router',
  label: id,
  ip: '10.0.0.1',
  status,
  position: { x: 0, y: 0 },
  load: 0,
});

const link = (
  id: string,
  source: string,
  target: string,
  status: Link['status'] = 'active',
): Link => ({
  id,
  source,
  target,
  bandwidth: 100,
  latency: 10,
  cost: 1,
  status,
  utilization: 0,
});

// No packet loss / corruption → processHop is deterministic past the reroute logic.
const cfg = (over: Partial<SimConfig> = {}): SimConfig => ({
  speed: 1,
  packetLoss: 0,
  latencyMultiplier: 1,
  jitter: 0,
  corruptionRate: 0,
  congestion: 0,
  routingAlgorithm: 'dijkstra',
  ...over,
});

const makePacket = (over: Partial<Packet> = {}): Packet => ({
  id: 'p1',
  sourceIP: '10.0.0.1',
  sourceDeviceId: 'a',
  destIP: '10.0.0.4',
  destDeviceId: 'd',
  protocol: 'UDP',
  size: 512,
  ttl: 64,
  seqNum: 1,
  ackNum: 0,
  checksum: '0000',
  crc: '00000000',
  crcValid: true,
  path: ['a', 'b', 'd'],
  currentHop: 0,
  status: 'in-transit',
  createdAt: 1000,
  hopTimestamps: [1000],
  ...over,
});

describe('processHop', () => {
  it('delivers a degenerate single-node path immediately without fabricating a hop', () => {
    const packet = makePacket({ path: ['a'], currentHop: 0, destDeviceId: 'a', status: 'created' });
    const { packet: out } = processHop(packet, cfg(), [dev('a')], []);
    expect(out.status).toBe('delivered');
    expect(out.currentHop).toBe(0);
  });

  it('reroutes around a disabled next-hop device when an alternative exists', () => {
    // Path a→b→d, but b is disabled while its links are still nominally active.
    // buildGraph excludes b, so the hop must reroute via a→c→d instead of
    // marching the packet into the dead node.
    const devices = [dev('a'), dev('b', 'disabled'), dev('c'), dev('d')];
    const links = [
      link('l1', 'a', 'b'),
      link('l2', 'b', 'd'),
      link('l3', 'a', 'c'),
      link('l4', 'c', 'd'),
    ];
    const packet = makePacket({ path: ['a', 'b', 'd'], currentHop: 0, destDeviceId: 'd' });
    const { packet: out } = processHop(packet, cfg(), devices, links);
    expect(out.status).not.toBe('dropped');
    expect(out.path).toEqual(['a', 'c', 'd']);
    expect(out.currentHop).toBe(1);
  });

  it('drops the packet when the next hop is disabled and no alternative route exists', () => {
    const devices = [dev('a'), dev('b', 'disabled')];
    const links = [link('l1', 'a', 'b')];
    const packet = makePacket({ path: ['a', 'b'], currentHop: 0, destDeviceId: 'b', destIP: '10.0.0.2' });
    const { packet: out } = processHop(packet, cfg(), devices, links);
    expect(out.status).toBe('dropped');
  });
});

describe('computeMetrics', () => {
  it('counts a retried-then-delivered flow as one delivery (100%), not 1-of-N attempts', () => {
    // Regression: the three packets below are one logical flow (shared root 'x').
    // Per-attempt accounting reported 1 delivered / 3 sent = 33%; per-flow
    // accounting must report 1/1 = 100% with the retries surfaced separately.
    const history = [
      makePacket({ id: 'x', status: 'retransmitting', protocol: 'TCP' }),
      makePacket({ id: 'y', status: 'retransmitting', protocol: 'TCP', retransmissionOf: 'x' }),
      makePacket({ id: 'z', status: 'delivered', protocol: 'TCP', retransmissionOf: 'x' }),
    ];
    const m = computeMetrics(history);
    expect(m.sent).toBe(1);
    expect(m.delivered).toBe(1);
    expect(m.deliveryRate).toBe(100);
    expect(m.retransmissions).toBe(2);
  });

  it('measures sent/delivered/lost per flow and excludes ACK traffic', () => {
    const history = [
      // Flow 1 — delivered on first try.
      makePacket({ id: 'f1', status: 'delivered', path: ['a', 'd'], currentHop: 1 }),
      // Flow 2 — delivered after two retransmissions (root 'f2a').
      makePacket({ id: 'f2a', status: 'retransmitting', protocol: 'TCP' }),
      makePacket({ id: 'f2b', status: 'retransmitting', protocol: 'TCP', retransmissionOf: 'f2a' }),
      makePacket({ id: 'f2c', status: 'delivered', protocol: 'TCP', retransmissionOf: 'f2a' }),
      // Flow 3 — UDP packet dropped (terminal failure).
      makePacket({ id: 'f3', status: 'dropped' }),
      // ACK must not inflate any counter.
      makePacket({ id: 'ack1', status: 'delivered', isAck: true }),
    ];
    const m = computeMetrics(history);
    expect(m.sent).toBe(3);
    expect(m.delivered).toBe(2);
    expect(m.lost).toBe(1);
    expect(m.retransmissions).toBe(2);
    expect(m.deliveryRate).toBe(66.7);
    expect(m.errorRate).toBe(33.3);
  });

  it('treats a terminal corrupted packet as a lost flow', () => {
    const history = [
      makePacket({ id: 'c1', status: 'corrupted', crcValid: false }),
    ];
    const m = computeMetrics(history);
    expect(m.sent).toBe(1);
    expect(m.delivered).toBe(0);
    expect(m.lost).toBe(1);
    expect(m.corrupted).toBe(1);
    expect(m.deliveryRate).toBe(0);
  });
});
