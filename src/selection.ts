import type { LinkKind, RenderSpec, SpecNode } from "./types";
import { LINK_LABELS, LINK_PRIORITY, ROLE_LABELS } from "./types";
import { bestLink, fallbackSearchUrl } from "./links";
import type { SvgNodeIndex } from "./svgIndex";

export interface SelectionUI {
  emptyEl: HTMLElement;
  contentEl: HTMLElement;
  nameEl: HTMLElement;
  rolesEl: HTMLElement;
  factsEl: HTMLDListElement;
  linksEl: HTMLElement;
  notesEl: HTMLElement;
  pathBtn: HTMLButtonElement;
  ancestorsBtn: HTMLButtonElement;
  clearBtn: HTMLButtonElement;
}

export function getSelectionUI(): SelectionUI {
  const $ = <T extends HTMLElement>(id: string) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing #${id}`);
    return el as T;
  };
  return {
    emptyEl: $("side-panel-empty"),
    contentEl: $("side-panel-content"),
    nameEl: $("sp-name"),
    rolesEl: $("sp-roles"),
    factsEl: $<HTMLDListElement>("sp-facts"),
    linksEl: $("sp-links"),
    notesEl: $("sp-notes"),
    pathBtn: $<HTMLButtonElement>("sp-path"),
    ancestorsBtn: $<HTMLButtonElement>("sp-ancestors"),
    clearBtn: $<HTMLButtonElement>("sp-clear"),
  };
}

export function clearSelection(ui: SelectionUI, nodeIndex: SvgNodeIndex): void {
  ui.emptyEl.hidden = false;
  ui.contentEl.hidden = true;
  for (const g of nodeIndex.allNodeGroups) g.classList.remove("selected");
}

export function showNode(
  nid: string,
  spec: RenderSpec,
  ui: SelectionUI,
  nodeIndex: SvgNodeIndex,
): void {
  const node = spec.nodes[nid];
  if (!node) {
    clearSelection(ui, nodeIndex);
    return;
  }

  // Visual selected state on the SVG.
  for (const g of nodeIndex.allNodeGroups) g.classList.remove("selected");
  nodeIndex.byNid.get(nid)?.classList.add("selected");

  // Panel content.
  ui.emptyEl.hidden = true;
  ui.contentEl.hidden = false;
  ui.nameEl.textContent = node.name;
  ui.rolesEl.replaceChildren(...renderRoles(node));
  ui.factsEl.replaceChildren(...renderFacts(node, spec));
  ui.linksEl.replaceChildren(...renderLinks(node));
  if (node.notes) {
    ui.notesEl.textContent = node.notes;
    ui.notesEl.hidden = false;
  } else {
    ui.notesEl.hidden = true;
  }
}

function renderRoles(node: SpecNode): Node[] {
  return node.roles.map((r) => {
    const span = document.createElement("span");
    span.className = `role-chip role-${r}`;
    span.textContent = ROLE_LABELS[r] ?? r;
    return span;
  });
}

function renderFacts(node: SpecNode, _spec: RenderSpec): Node[] {
  const out: Node[] = [];
  const addRow = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = String(value);
    out.push(dt, dd);
  };
  if (node.year) {
    let yearText = node.year;
    if (node.temporal_distance !== null && node.temporal_distance > 0) {
      yearText = `${node.year} · ${node.temporal_distance} years before focal`;
    }
    addRow("Year", yearText);
  }
  addRow("University", node.university);
  addRow("Country", node.country);
  if (node.domain) addRow("Domain", node.domain);
  if (node.distance_from_focal !== null && node.distance_from_focal > 0) {
    addRow("Graph distance from focal", node.distance_from_focal);
  }
  if (node.synthetic) addRow("Note", "Not yet in MGP (synthetic node)");
  return out;
}

function renderLinks(node: SpecNode): Node[] {
  const out: Node[] = [];
  const best = bestLink(node);

  // Primary CTA (always present — falls back to Google search).
  const primary = document.createElement("a");
  primary.className = "link-btn primary";
  primary.href = best.url;
  primary.target = "_blank";
  primary.rel = "noopener noreferrer";
  if (best.isFallback) {
    primary.textContent = "Search the web for this scholar";
  } else {
    primary.textContent = `Open ${LINK_LABELS[best.kind!]}`;
  }
  out.push(primary);

  // Secondary links (in priority order, skipping the primary if non-fallback).
  for (const kind of LINK_PRIORITY) {
    const url = node.links[kind];
    if (!url) continue;
    if (!best.isFallback && kind === best.kind) continue; // already shown as primary
    const a = document.createElement("a");
    a.className = "link-btn secondary";
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = LINK_LABELS[kind];
    out.push(a);
  }

  // Always offer a search fallback when primary is a curated link.
  if (!best.isFallback) {
    const a = document.createElement("a");
    a.className = "link-btn secondary";
    a.href = fallbackSearchUrl(node);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "Search web";
    out.push(a);
  }

  // Non-priority extras (wikidata, mgp) at the end.
  const extras: LinkKind[] = ["wikidata", "mgp"];
  for (const kind of extras) {
    const url = node.links[kind];
    if (!url) continue;
    const a = document.createElement("a");
    a.className = "link-btn tertiary";
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = LINK_LABELS[kind];
    out.push(a);
  }

  return out;
}

// Open the primary link for a node in a new tab. Used by dblclick / Cmd-click.
export function openPrimaryLink(nid: string, spec: RenderSpec): void {
  const node = spec.nodes[nid];
  if (!node) return;
  const { url } = bestLink(node);
  window.open(url, "_blank", "noopener,noreferrer");
}
