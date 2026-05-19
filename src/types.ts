// Mirrors tool/mgdb/spec.py. Update both when extending.

export type Role =
  | "focal_student"
  | "primary_advisor"
  | "committee"
  | "informal_committee"
  | "famous"
  | "lca"
  | "pairwise_lca"
  | "uiuc_sibling"
  | "other_sibling"
  | "ancestor";

export type LinkKind = "wikipedia" | "wikidata" | "scholar" | "dblp" | "homepage" | "mgp";

export interface SpecNode {
  name: string;
  year: string | null;
  university: string | null;
  country: string | null;
  synthetic: boolean;
  roles: Role[];
  links: Partial<Record<LinkKind, string>>;
  notes: string | null;
  display_year_suffix: string | null;
  distance_from_focal: number | null;
  temporal_distance: number | null;
  domain: string | null;
}

export type EdgeKind = "advisor" | "primary" | "committee";

export interface SpecEdge {
  student: string;
  advisor: string;
  kind: EdgeKind;
  hidden_count: number;
}

export interface SpecMeta {
  title: string;
  subtitle: string | null;
  edge_direction: "student_to_advisor";
  generated_at: string;
  source?: Record<string, unknown> | null;
  query?: { focal_pid?: number; focal_year?: number; [k: string]: unknown } | null;
  rank_same?: string[][];
  clusters?: Array<{ name: string; label?: string; roles?: string[] }>;
}

export interface RenderSpec {
  meta: SpecMeta;
  nodes: Record<string, SpecNode>;
  edges: SpecEdge[];
  groups: Partial<Record<Role, string[]>>;
}

// Priority order for primary external link (matches SPEC.org §5.1 / enrichment.py).
export const LINK_PRIORITY: LinkKind[] = ["wikipedia", "scholar", "dblp", "homepage"];

// Human-readable labels for link kinds (UI buttons).
export const LINK_LABELS: Record<LinkKind, string> = {
  wikipedia: "Wikipedia",
  scholar: "Google Scholar",
  dblp: "DBLP",
  homepage: "Homepage",
  wikidata: "Wikidata",
  mgp: "MGP",
};

export const ROLE_LABELS: Record<Role, string> = {
  focal_student: "Focal student",
  primary_advisor: "Primary advisor",
  committee: "Committee",
  informal_committee: "Informal committee",
  famous: "Famous ancestor",
  lca: "LCA",
  pairwise_lca: "Pairwise LCA",
  uiuc_sibling: "UIUC sibling",
  other_sibling: "Sibling",
  ancestor: "Ancestor",
};
