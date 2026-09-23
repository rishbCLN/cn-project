import { describe, it, expect } from 'vitest';
import { buildGraph, findPath } from './routing';
import type { Device, DeviceStatus, Link } from '../types';

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

describe('findPath', () => {
  it('finds a direct path between two connected active devices', () => {
    const graph = buildGraph([dev('a'), dev('b')], [link('l1', 'a', 'b')]);
    const result = findPath(graph, 'a', 'b', 'dijkstra');
    expect(result).not.toBeNull();
    expect(result!.path).toEqual(['a', 'b']);
  });

  it('returns a zero-cost single-node path when source === destination', () => {
    const graph = buildGraph([dev('a')], []);
    const result = findPath(graph, 'a', 'a', 'dijkstra');
    expect(result).not.toBeNull();
    expect(result!.path).toEqual(['a']);
    expect(result!.totalCost).toBe(0);
  });

  it('returns null when the destination is disabled (absent from the graph)', () => {
    // Regression: a disabled device is excluded from buildGraph, so it never
    // enters the dist map. The unreachable guard must treat "absent" as
    // unreachable (null) rather than fabricating a bogus [destination] path,
    // which previously caused packets to be reported delivered to a dead node.
    const devices = [dev('a'), dev('b', 'disabled')];
    const links = [link('l1', 'a', 'b')];
    const graph = buildGraph(devices, links);
    expect(findPath(graph, 'a', 'b', 'dijkstra')).toBeNull();
    expect(findPath(graph, 'a', 'b', 'bellman-ford')).toBeNull();
  });

  it('returns null between disconnected components', () => {
    const devices = [dev('a'), dev('b'), dev('c'), dev('d')];
    const links = [link('l1', 'a', 'b'), link('l2', 'c', 'd')];
    const graph = buildGraph(devices, links);
    expect(findPath(graph, 'a', 'd', 'dijkstra')).toBeNull();
    expect(findPath(graph, 'a', 'd', 'bellman-ford')).toBeNull();
  });

  it('routes around disabled links via the remaining path', () => {
    const devices = [dev('a'), dev('b'), dev('c'), dev('d')];
    const links = [
      link('l1', 'a', 'b', 'disabled'),
      link('l2', 'b', 'd', 'disabled'),
      link('l3', 'a', 'c'),
      link('l4', 'c', 'd'),
    ];
    const graph = buildGraph(devices, links);
    const result = findPath(graph, 'a', 'd', 'dijkstra');
    expect(result).not.toBeNull();
    expect(result!.path).toEqual(['a', 'c', 'd']);
  });
});
