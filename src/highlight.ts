import type { RenderSpec } from "./types";
import type { SvgNodeIndex } from "./svgIndex";
import type { AdjacencyIndex, PathMode } from "./graph";
import { ancestors, pathNodes } from "./graph";

export type HighlightMode = "none" | "path" | "ancestors";

export interface HighlightState {
  mode: HighlightMode;
  highlightedNids: Set<string>; // empty when mode === "none"
}

export const initialHighlightState: HighlightState = {
  mode: "none",
  highlightedNids: new Set(),
};

// Apply or clear highlight classes on the SVG nodes and edges.
export function applyHighlight(
  state: HighlightState,
  svgRoot: SVGSVGElement,
  nodeIndex: SvgNodeIndex,
  spec: RenderSpec,
): void {
  // Reset previous state.
  for (const g of nodeIndex.allNodeGroups) {
    g.classList.remove("on-path", "dimmed");
  }
  for (const g of svgRoot.querySelectorAll<SVGGElement>("g.edge")) {
    g.classList.remove("on-path", "dimmed");
  }

  if (state.mode === "none" || state.highlightedNids.size === 0) return;

  // Mark nodes.
  for (const g of nodeIndex.allNodeGroups) {
    const titleEl = g.querySelector("title");
    const nid = titleEl?.textContent?.trim();
    if (!nid) continue;
    if (state.highlightedNids.has(nid)) {
      g.classList.add("on-path");
    } else {
      g.classList.add("dimmed");
    }
  }

  // Mark edges: an edge is on-path iff both endpoints are highlighted.
  for (const e of spec.edges) {
    const both = state.highlightedNids.has(e.student) && state.highlightedNids.has(e.advisor);
    const edgeTitle = `${e.student}->${e.advisor}`;
    // Find edge group by matching its <title> content.
    const allEdges = svgRoot.querySelectorAll<SVGGElement>("g.edge");
    for (const g of allEdges) {
      const t = g.querySelector("title")?.textContent?.trim();
      if (t === edgeTitle) {
        g.classList.add(both ? "on-path" : "dimmed");
        break;
      }
    }
  }
}

// Compute highlight state for "show path(s) to focal".
// mode="all" (default): every node on any directed path. Faithful to the DAG.
// mode="shortest": only nodes on minimum-length paths. Cleaner lineage chain.
export function pathToFocal(
  from: string,
  focalNid: string,
  adj: AdjacencyIndex,
  mode: PathMode = "all",
): HighlightState {
  const nids = pathNodes(adj, from, focalNid, mode);
  if (nids.size === 0) {
    // Try the reverse direction (focal might be downstream).
    const fromFocal = pathNodes(adj, focalNid, from, mode);
    return { mode: "path", highlightedNids: fromFocal };
  }
  return { mode: "path", highlightedNids: nids };
}

// Compute highlight state for "show ancestors of selected".
export function ancestorsHighlight(nid: string, adj: AdjacencyIndex): HighlightState {
  return { mode: "ancestors", highlightedNids: ancestors(adj, nid) };
}

// Find the focal student nid in the spec, if any.
export function focalNid(spec: RenderSpec): string | null {
  const ids = spec.groups.focal_student;
  if (ids && ids.length > 0) return ids[0];
  for (const [nid, node] of Object.entries(spec.nodes)) {
    if (node.roles.includes("focal_student")) return nid;
  }
  return null;
}
