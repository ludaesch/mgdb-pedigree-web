import type { LinkKind, SpecNode } from "./types";
import { LINK_PRIORITY } from "./types";

// Pick the highest-priority link, or null if the scholar has none.
export function primaryLink(node: SpecNode): { kind: LinkKind; url: string } | null {
  for (const kind of LINK_PRIORITY) {
    const url = node.links[kind];
    if (url) return { kind, url };
  }
  return null;
}

// Always-available fallback search URL — firstname + lastname only (no qualifiers).
export function fallbackSearchUrl(node: SpecNode): string {
  const name = node.name.replace(/[.,]/g, "").trim();
  const q = encodeURIComponent(name);
  return `https://www.google.com/search?q=${q}`;
}

// The "click here first" URL: priority list, then fallback search.
export function bestLink(node: SpecNode): { url: string; isFallback: boolean; kind: LinkKind | null } {
  const primary = primaryLink(node);
  if (primary) return { url: primary.url, isFallback: false, kind: primary.kind };
  return { url: fallbackSearchUrl(node), isFallback: true, kind: null };
}
