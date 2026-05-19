// Build the bidirectional mapping between Graphviz SVG node-group IDs
// (e.g. "node27") and DOT/JSON node IDs (e.g. "n63244", "nm1").
//
// Graphviz emits each node as:
//   <g id="nodeN" class="node">
//     <title>n63244</title>
//     ...
//   </g>
//
// The <title> is the DOT name — i.e. the key in RenderSpec.nodes.

export interface SvgNodeIndex {
  byNid: Map<string, SVGGElement>;   // "n63244" → <g>
  bySvgId: Map<string, string>;      // "node27" → "n63244"
  allNodeGroups: SVGGElement[];
}

export function buildSvgIndex(svgRoot: SVGSVGElement): SvgNodeIndex {
  const byNid = new Map<string, SVGGElement>();
  const bySvgId = new Map<string, string>();
  const allNodeGroups: SVGGElement[] = [];

  const groups = svgRoot.querySelectorAll<SVGGElement>("g.node");
  for (const g of groups) {
    const titleEl = g.querySelector("title");
    const nid = titleEl?.textContent?.trim();
    const svgId = g.getAttribute("id");
    if (!nid || !svgId) continue;
    byNid.set(nid, g);
    bySvgId.set(svgId, nid);
    allNodeGroups.push(g);
  }

  return { byNid, bySvgId, allNodeGroups };
}

// Build edge index too — Graphviz emits each edge as <g id="edgeN" class="edge">
// with a <title>student_nid-&gt;advisor_nid</title>.
export interface SvgEdgeIndex {
  byEndpoints: Map<string, SVGGElement>;   // "student->advisor" → <g>
  allEdgeGroups: SVGGElement[];
}

export function buildEdgeIndex(svgRoot: SVGSVGElement): SvgEdgeIndex {
  const byEndpoints = new Map<string, SVGGElement>();
  const allEdgeGroups: SVGGElement[] = [];

  const groups = svgRoot.querySelectorAll<SVGGElement>("g.edge");
  for (const g of groups) {
    const titleEl = g.querySelector("title");
    const title = titleEl?.textContent?.trim();
    if (!title) continue;
    // Title looks like "n63244->n101860" (student→advisor in our convention).
    const arrow = title.includes("->") ? "->" : "&#45;>";
    const parts = title.split(arrow);
    if (parts.length !== 2) continue;
    const key = `${parts[0].trim()}->${parts[1].trim()}`;
    byEndpoints.set(key, g);
    allEdgeGroups.push(g);
  }

  return { byEndpoints, allEdgeGroups };
}

// Strip Graphviz-injected xlink:href anchors so single-click doesn't navigate.
// We keep the URLs in RenderSpec, and the side panel exposes them as explicit buttons.
export function neutralizeNodeAnchors(svgRoot: SVGSVGElement): void {
  const anchors = svgRoot.querySelectorAll<SVGAElement>("g.node a");
  for (const a of anchors) {
    a.removeAttribute("href");
    a.removeAttribute("xlink:href");
    a.removeAttribute("target");
  }
}
