/**
 * Routing Engine
 * Implements Dijkstra's and Bellman-Ford shortest-path algorithms.
 * Considers bandwidth, latency, and cost for link weights.
 */

import { Device, Link, RoutingAlgorithm } from '../types';

/* ─── Types ─── */

interface GraphEdge {
  neighbor: string;
  weight: number;
  linkId: string;
}

export interface PathResult {
  path: string[];
  totalCost: number;
  linkIds: string[];
  algorithm: RoutingAlgorithm;
  /** Number of iterations/relaxations the algorithm performed */
  iterations: number;
}

/* ─── Flat edge for Bellman-Ford ─── */
interface FlatEdge {
  from: string;
  to: string;
  weight: number;
  linkId: string;
}

/**
 * Build adjacency list from devices & links.
 * Only includes active devices and active links.
 */
export function buildGraph(
  devices: Device[],
  links: Link[]
): Map<string, GraphEdge[]> {
  const graph = new Map<string, GraphEdge[]>();
  const activeDeviceIds = new Set(
    devices.filter(d => d.status === 'active').map(d => d.id)
  );

  for (const id of activeDeviceIds) {
    graph.set(id, []);
  }

  for (const link of links) {
    if (link.status !== 'active') continue;
    if (!activeDeviceIds.has(link.source) || !activeDeviceIds.has(link.target)) continue;

    const weight = computeLinkCost(link);

    graph.get(link.source)?.push({
      neighbor: link.target,
      weight,
      linkId: link.id,
    });
    graph.get(link.target)?.push({
      neighbor: link.source,
      weight,
      linkId: link.id,
    });
  }

  return graph;
}

/**
 * Compute link cost: lower is better.
 * Prefers high bandwidth, low latency.
 */
function computeLinkCost(link: Link): number {
  const bwFactor = 1000 / Math.max(link.bandwidth, 1);
  return link.cost + bwFactor + link.latency;
}

/* ═══════════════════════════════════════════════════════════════
 *  Dispatcher — picks the algorithm based on user selection
 * ═══════════════════════════════════════════════════════════════ */

/**
 * Find the shortest path using the selected algorithm.
 * This is the primary entry point for the simulation engine.
 */
export function findPath(
  graph: Map<string, GraphEdge[]>,
  source: string,
  destination: string,
  algorithm: RoutingAlgorithm = 'dijkstra'
): PathResult | null {
  switch (algorithm) {
    case 'bellman-ford':
      return bellmanFord(graph, source, destination);
    case 'dijkstra':
    default:
      return dijkstra(graph, source, destination);
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  Dijkstra's Algorithm (Link-State / OSPF style)
 *  ─ Greedy, centralized
 *  ─ O((V+E) log V) with a proper heap; O(V²) with array PQ
 *  ─ Requires non-negative edge weights
 * ═══════════════════════════════════════════════════════════════ */

function dijkstra(
  graph: Map<string, GraphEdge[]>,
  source: string,
  destination: string
): PathResult | null {
  if (source === destination) {
    return { path: [source], totalCost: 0, linkIds: [], algorithm: 'dijkstra', iterations: 0 };
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, { node: string; linkId: string } | null>();
  const visited = new Set<string>();
  let iterations = 0;

  // Initialize
  for (const node of graph.keys()) {
    dist.set(node, Infinity);
    prev.set(node, null);
  }
  dist.set(source, 0);

  // Simple priority queue (adequate for small graphs < 50 nodes)
  const pq: { node: string; cost: number }[] = [{ node: source, cost: 0 }];

  while (pq.length > 0) {
    // Extract min
    pq.sort((a, b) => a.cost - b.cost);
    const { node: u } = pq.shift()!;

    if (u === destination) break;
    if (visited.has(u)) continue;
    visited.add(u);

    for (const edge of graph.get(u) ?? []) {
      if (visited.has(edge.neighbor)) continue;
      iterations++;

      const alt = (dist.get(u) ?? Infinity) + edge.weight;
      if (alt < (dist.get(edge.neighbor) ?? Infinity)) {
        dist.set(edge.neighbor, alt);
        prev.set(edge.neighbor, { node: u, linkId: edge.linkId });
        pq.push({ node: edge.neighbor, cost: alt });
      }
    }
  }

  // Reconstruct path
  if (dist.get(destination) === Infinity) return null;

  const path: string[] = [];
  const linkIds: string[] = [];
  let current: string | undefined = destination;

  while (current) {
    path.unshift(current);
    const p = prev.get(current);
    if (p) {
      linkIds.unshift(p.linkId);
      current = p.node;
    } else {
      break;
    }
  }

  return {
    path,
    totalCost: dist.get(destination) ?? Infinity,
    linkIds,
    algorithm: 'dijkstra',
    iterations,
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  Bellman-Ford Algorithm (Distance-Vector / RIP style)
 *  ─ Iterative, distributed
 *  ─ O(V × E) — relaxes all edges V-1 times
 *  ─ Handles negative edge weights
 *  ─ Detects negative-weight cycles
 * ═══════════════════════════════════════════════════════════════ */

function bellmanFord(
  graph: Map<string, GraphEdge[]>,
  source: string,
  destination: string
): PathResult | null {
  if (source === destination) {
    return { path: [source], totalCost: 0, linkIds: [], algorithm: 'bellman-ford', iterations: 0 };
  }

  const vertices = Array.from(graph.keys());
  const V = vertices.length;

  // Flatten the adjacency list into an edge list
  const edges: FlatEdge[] = [];
  for (const [from, neighbors] of graph.entries()) {
    for (const edge of neighbors) {
      edges.push({
        from,
        to: edge.neighbor,
        weight: edge.weight,
        linkId: edge.linkId,
      });
    }
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, { node: string; linkId: string } | null>();
  let iterations = 0;

  // Initialize distances
  for (const v of vertices) {
    dist.set(v, Infinity);
    prev.set(v, null);
  }
  dist.set(source, 0);

  // Relax all edges V-1 times
  for (let i = 0; i < V - 1; i++) {
    let anyRelaxed = false;

    for (const edge of edges) {
      iterations++;
      const du = dist.get(edge.from) ?? Infinity;
      const dv = dist.get(edge.to) ?? Infinity;

      if (du !== Infinity && du + edge.weight < dv) {
        dist.set(edge.to, du + edge.weight);
        prev.set(edge.to, { node: edge.from, linkId: edge.linkId });
        anyRelaxed = true;
      }
    }

    // Early termination: if no relaxation occurred, we're done
    if (!anyRelaxed) break;
  }

  // Check for negative-weight cycles (V-th pass)
  for (const edge of edges) {
    const du = dist.get(edge.from) ?? Infinity;
    const dv = dist.get(edge.to) ?? Infinity;

    if (du !== Infinity && du + edge.weight < dv) {
      // Negative cycle detected — no valid shortest path
      console.warn('[Bellman-Ford] Negative-weight cycle detected');
      return null;
    }
  }

  // Reconstruct path
  if (dist.get(destination) === Infinity) return null;

  const path: string[] = [];
  const linkIds: string[] = [];
  let current: string | undefined = destination;

  while (current) {
    path.unshift(current);
    const p = prev.get(current);
    if (p) {
      linkIds.unshift(p.linkId);
      current = p.node;
    } else {
      break;
    }
  }

  return {
    path,
    totalCost: dist.get(destination) ?? Infinity,
    linkIds,
    algorithm: 'bellman-ford',
    iterations,
  };
}

/* ═══════════════════════════════════════════════════════════════
 *  Legacy export — keeps backwards compatibility
 * ═══════════════════════════════════════════════════════════════ */

/**
 * @deprecated Use findPath() instead. Kept for backwards compatibility.
 */
export function findShortestPath(
  graph: Map<string, GraphEdge[]>,
  source: string,
  destination: string
): { path: string[]; totalCost: number; linkIds: string[] } | null {
  return findPath(graph, source, destination, 'dijkstra');
}
