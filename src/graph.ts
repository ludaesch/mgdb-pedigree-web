import type { RenderSpec, SpecEdge } from "./types";

// Adjacency maps over RenderSpec.edges. Edge direction is student → advisor.
export interface AdjacencyIndex {
  advisorsOf: Map<string, string[]>;   // nid → list of advisor nids
  studentsOf: Map<string, string[]>;   // nid → list of student nids
}

export function buildAdjacency(spec: RenderSpec): AdjacencyIndex {
  const advisorsOf = new Map<string, string[]>();
  const studentsOf = new Map<string, string[]>();
  for (const e of spec.edges) {
    const a = advisorsOf.get(e.student) ?? [];
    a.push(e.advisor);
    advisorsOf.set(e.student, a);
    const s = studentsOf.get(e.advisor) ?? [];
    s.push(e.student);
    studentsOf.set(e.advisor, s);
  }
  return { advisorsOf, studentsOf };
}

// BFS over advisors (upward through DAG). Returns the closed ancestor set INCLUDING `start`.
export function ancestors(adj: AdjacencyIndex, start: string): Set<string> {
  const seen = new Set<string>([start]);
  const queue: string[] = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adj.advisorsOf.get(cur) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

// BFS over students (downward through DAG).
export function descendants(adj: AdjacencyIndex, start: string): Set<string> {
  const seen = new Set<string>([start]);
  const queue: string[] = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adj.studentsOf.get(cur) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

// Two path-highlight modes on the DAG.
// Both return the set of nodes on the directed path(s) from `from` to `to`
// (following student → advisor edges). Empty set if `to` is not reachable.
export type PathMode = "all" | "shortest";

// ALL paths: a node X is on some directed path from `from` to `to` iff
// X is reachable upward from `from` AND `to` is reachable upward from X.
// Equivalently, X ∈ ancestors(from) ∩ descendants(to). Simple, exact for a
// DAG, and faithful to the multi-advisor structure of the genealogy.
export function pathNodesAll(adj: AdjacencyIndex, from: string, to: string): Set<string> {
  const anc = ancestors(adj, from);
  if (!anc.has(to)) return new Set();
  const desc = descendants(adj, to);
  const out = new Set<string>();
  for (const x of anc) if (desc.has(x)) out.add(x);
  return out;
}

// SHORTEST paths: the union of nodes on any path of minimum length. Useful
// when the user wants a clean lineage chain rather than the full reachability
// envelope. Drops longer alternative branches, even when they exist.
export function pathNodesShortest(adj: AdjacencyIndex, from: string, to: string): Set<string> {
  // BFS upward from `from`, recording shortest-distance predecessors.
  const dist = new Map<string, number>([[from, 0]]);
  const preds = new Map<string, string[]>();
  const queue: string[] = [from];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const d = dist.get(cur)!;
    for (const next of adj.advisorsOf.get(cur) ?? []) {
      if (!dist.has(next)) {
        dist.set(next, d + 1);
        preds.set(next, [cur]);
        queue.push(next);
      } else if (dist.get(next) === d + 1) {
        preds.get(next)!.push(cur);
      }
    }
  }
  if (!dist.has(to)) return new Set();

  // Walk predecessors back from `to` to collect union of shortest paths.
  const onPath = new Set<string>([to]);
  const stack: string[] = [to];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const p of preds.get(cur) ?? []) {
      if (!onPath.has(p)) {
        onPath.add(p);
        stack.push(p);
      }
    }
  }
  return onPath;
}

// Dispatch by mode.
export function pathNodes(
  adj: AdjacencyIndex,
  from: string,
  to: string,
  mode: PathMode = "all",
): Set<string> {
  return mode === "all" ? pathNodesAll(adj, from, to) : pathNodesShortest(adj, from, to);
}

// Index edges by endpoint key "student->advisor" so we can find SVG edge groups quickly.
export function edgeKey(e: SpecEdge): string {
  return `${e.student}->${e.advisor}`;
}

export function edgesByEndpoints(spec: RenderSpec): Map<string, SpecEdge> {
  const m = new Map<string, SpecEdge>();
  for (const e of spec.edges) m.set(edgeKey(e), e);
  return m;
}
