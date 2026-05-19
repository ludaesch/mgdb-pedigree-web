import svgPanZoom from "svg-pan-zoom";
import type { RenderSpec } from "./types";
import { buildSvgIndex, neutralizeNodeAnchors, type SvgNodeIndex } from "./svgIndex";
import { buildAdjacency } from "./graph";
import {
  applyHighlight,
  ancestorsHighlight,
  focalNid,
  initialHighlightState,
  pathToFocal,
  type HighlightState,
} from "./highlight";
import {
  clearSelection,
  getSelectionUI,
  openPrimaryLink,
  showNode,
  type SelectionUI,
} from "./selection";
import { renderSearchResults, search } from "./search";

interface AppState {
  spec: RenderSpec;
  svgRoot: SVGSVGElement;
  nodeIndex: SvgNodeIndex;
  adjacency: ReturnType<typeof buildAdjacency>;
  ui: SelectionUI;
  panZoom: ReturnType<typeof svgPanZoom> | null;
  selectedNid: string | null;
  highlight: HighlightState;
}

async function loadAssets(): Promise<{ spec: RenderSpec; svgText: string }> {
  // BASE_URL is "/" in dev and e.g. "/mgdb-pedigree-web/" in prod (Vite injects).
  const base = import.meta.env.BASE_URL;
  const [specRes, svgRes] = await Promise.all([
    fetch(`${base}spec.json`),
    fetch(`${base}pedigree.svg`),
  ]);
  if (!specRes.ok) throw new Error(`spec.json: ${specRes.status}`);
  if (!svgRes.ok) throw new Error(`pedigree.svg: ${svgRes.status}`);
  const spec = (await specRes.json()) as RenderSpec;
  const svgText = await svgRes.text();
  return { spec, svgText };
}

function injectSvg(svgText: string, host: HTMLElement): SVGSVGElement {
  host.innerHTML = svgText;
  const svg = host.querySelector("svg");
  if (!svg) throw new Error("No <svg> in pedigree.svg");
  // Strip Graphviz hard-coded width/height so the SVG fills the host.
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.style.width = "100%";
  svg.style.height = "100%";
  return svg as SVGSVGElement;
}

function applyRoleClasses(spec: RenderSpec, nodeIndex: SvgNodeIndex): void {
  for (const [nid, node] of Object.entries(spec.nodes)) {
    const g = nodeIndex.byNid.get(nid);
    if (!g) continue;
    for (const role of node.roles) g.classList.add(`role-${role}`);
    if (node.domain) g.classList.add(`domain-${node.domain}`);
    if (node.synthetic) g.classList.add("synthetic");
    // Accessibility
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    const ariaLabel = [node.name, node.year ? `(${node.year})` : null]
      .filter(Boolean)
      .join(" ");
    g.setAttribute("aria-label", ariaLabel);
  }
}

function attachNodeHandlers(state: AppState): void {
  for (const g of state.nodeIndex.allNodeGroups) {
    const nid = g.querySelector("title")?.textContent?.trim();
    if (!nid) continue;
    g.style.cursor = "pointer";

    g.addEventListener("click", (e) => {
      const me = e as MouseEvent;
      if (me.metaKey || me.ctrlKey) {
        me.preventDefault();
        openPrimaryLink(nid, state.spec);
        return;
      }
      selectNode(nid, state);
    });

    g.addEventListener("dblclick", (e) => {
      e.preventDefault();
      openPrimaryLink(nid, state.spec);
    });

    g.addEventListener("keydown", (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key === "Enter" || ke.key === " ") {
        ke.preventDefault();
        selectNode(nid, state);
      }
    });
  }
}

function selectNode(nid: string, state: AppState): void {
  state.selectedNid = nid;
  showNode(nid, state.spec, state.ui, state.nodeIndex);
}

function clearHighlight(state: AppState): void {
  state.highlight = initialHighlightState;
  applyHighlight(state.highlight, state.svgRoot, state.nodeIndex, state.spec);
}

function attachPanelButtons(state: AppState): void {
  state.ui.pathBtn.addEventListener("click", () => {
    if (!state.selectedNid) return;
    const focal = focalNid(state.spec);
    if (!focal) return;
    if (state.selectedNid === focal) {
      // Same node: just highlight the focal alone.
      state.highlight = { mode: "path", highlightedNids: new Set([focal]) };
    } else {
      state.highlight = pathToFocal(state.selectedNid, focal, state.adjacency);
    }
    applyHighlight(state.highlight, state.svgRoot, state.nodeIndex, state.spec);
  });

  state.ui.ancestorsBtn.addEventListener("click", () => {
    if (!state.selectedNid) return;
    state.highlight = ancestorsHighlight(state.selectedNid, state.adjacency);
    applyHighlight(state.highlight, state.svgRoot, state.nodeIndex, state.spec);
  });

  state.ui.clearBtn.addEventListener("click", () => {
    clearHighlight(state);
  });
}

function attachGlobalHandlers(state: AppState): void {
  document.getElementById("btn-reset")?.addEventListener("click", () => {
    clearHighlight(state);
    clearSelection(state.ui, state.nodeIndex);
    state.selectedNid = null;
    state.panZoom?.resetZoom();
    state.panZoom?.center();
    state.panZoom?.fit();
  });

  const legendBtn = document.getElementById("btn-legend") as HTMLButtonElement | null;
  const legendEl = document.getElementById("legend");
  legendBtn?.addEventListener("click", () => {
    if (!legendEl) return;
    const hidden = legendEl.hidden;
    legendEl.hidden = !hidden;
    legendBtn.setAttribute("aria-expanded", String(hidden));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      clearHighlight(state);
      clearSelection(state.ui, state.nodeIndex);
      state.selectedNid = null;
    }
  });

  state.svgRoot.addEventListener("click", (e) => {
    // Click on empty SVG background → clear selection.
    const target = e.target as Element;
    if (target.tagName.toLowerCase() === "svg") {
      clearSelection(state.ui, state.nodeIndex);
      state.selectedNid = null;
    }
  });
}

function attachSearch(state: AppState): void {
  const input = document.getElementById("search-input") as HTMLInputElement | null;
  const list = document.getElementById("search-results") as HTMLUListElement | null;
  if (!input || !list) return;

  const onPick = (nid: string) => {
    selectNode(nid, state);
    list.hidden = true;
    input.value = "";
    panToNode(nid, state);
  };

  input.addEventListener("input", () => {
    const results = search(input.value, state.spec);
    renderSearchResults(results, list, onPick);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      list.hidden = true;
      (e.target as HTMLElement).blur();
    } else if (e.key === "Enter") {
      const first = list.querySelector("li[data-nid]") as HTMLElement | null;
      const nid = first?.dataset.nid;
      if (nid) onPick(nid);
    }
  });

  input.addEventListener("blur", () => {
    // Delay slightly so click on result fires first.
    setTimeout(() => {
      list.hidden = true;
    }, 150);
  });
  input.addEventListener("focus", () => {
    if (list.children.length > 0) list.hidden = false;
  });
}

function panToNode(nid: string, state: AppState): void {
  const g = state.nodeIndex.byNid.get(nid);
  if (!g || !state.panZoom) return;

  const bbox = (g as unknown as SVGGraphicsElement).getBBox();
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;

  // svg-pan-zoom coordinates: we want to center the bbox.
  // Get sizes and current zoom.
  const sizes = state.panZoom.getSizes();
  const zoom = state.panZoom.getZoom();

  // svg-pan-zoom places content using a matrix; we use pan() to move the viewport
  // so that the bbox center maps to the screen center.
  const targetX = sizes.width / 2 - (cx * sizes.realZoom);
  const targetY = sizes.height / 2 - (cy * sizes.realZoom);
  state.panZoom.pan({ x: targetX, y: targetY });

  // Briefly pulse the selected node.
  g.classList.add("pulse");
  setTimeout(() => g.classList.remove("pulse"), 700);
  void zoom; // keep zoom unchanged
}

function setTitleFromSpec(spec: RenderSpec): void {
  const titleEl = document.getElementById("app-title");
  if (titleEl && spec.meta.title) {
    titleEl.textContent = spec.meta.title;
    document.title = spec.meta.title;
  }
  // Stash focal_year as a CSS custom property for optional background art (ideas-BL.org).
  const focalYear = spec.meta.query?.focal_year;
  if (typeof focalYear === "number") {
    document.documentElement.style.setProperty("--focal-year", String(focalYear));
  }
}

async function main(): Promise<void> {
  const loadingEl = document.getElementById("graph-loading");
  try {
    const { spec, svgText } = await loadAssets();
    setTitleFromSpec(spec);

    const host = document.getElementById("svg-host");
    if (!host) throw new Error("Missing #svg-host");
    const svgRoot = injectSvg(svgText, host);
    if (loadingEl) loadingEl.hidden = true;

    neutralizeNodeAnchors(svgRoot);
    const nodeIndex = buildSvgIndex(svgRoot);
    applyRoleClasses(spec, nodeIndex);

    const adjacency = buildAdjacency(spec);
    const ui = getSelectionUI();

    // svg-pan-zoom requires the SVG to have an id.
    if (!svgRoot.id) svgRoot.id = "pedigree-svg";
    const panZoom = svgPanZoom(svgRoot, {
      controlIconsEnabled: false,
      zoomScaleSensitivity: 0.3,
      minZoom: 0.1,
      maxZoom: 20,
      fit: true,
      center: true,
      contain: false,
      dblClickZoomEnabled: false,        // we use dblclick to open links
      preventMouseEventsDefault: false,  // let node click handlers fire
    });

    const state: AppState = {
      spec,
      svgRoot,
      nodeIndex,
      adjacency,
      ui,
      panZoom,
      selectedNid: null,
      highlight: initialHighlightState,
    };

    attachNodeHandlers(state);
    attachPanelButtons(state);
    attachGlobalHandlers(state);
    attachSearch(state);

    // Auto-select the focal student on initial load.
    const focal = focalNid(spec);
    if (focal) selectNode(focal, state);

    console.info(
      `[mgdb-web] Loaded: ${Object.keys(spec.nodes).length} nodes, ${spec.edges.length} edges. Focal: ${focal ?? "(none)"}`,
    );
  } catch (err) {
    console.error(err);
    if (loadingEl) {
      loadingEl.textContent = `Failed to load pedigree: ${(err as Error).message}`;
    }
  }
}

void main();
