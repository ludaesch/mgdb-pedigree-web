import type { RenderSpec, Role } from "./types";
import { ROLE_LABELS } from "./types";

const ROLE_KEYWORDS: Record<string, Role[]> = {
  focal: ["focal_student"],
  student: ["focal_student"],
  committee: ["committee", "informal_committee"],
  famous: ["famous"],
  lca: ["lca", "pairwise_lca"],
  uiuc: ["uiuc_sibling"],
  sibling: ["uiuc_sibling", "other_sibling"],
  primary: ["primary_advisor"],
  advisor: ["primary_advisor"],
};

export interface SearchResult {
  nid: string;
  name: string;
  roles: Role[];
  year: string | null;
  score: number; // lower is better
}

// Substring + role-keyword search. Case-insensitive. Returns up to `limit` results.
export function search(query: string, spec: RenderSpec, limit = 12): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];

  const tokens = q.split(/\s+/).filter(Boolean);
  const roleTokens = tokens.filter((t) => ROLE_KEYWORDS[t]);
  const nameTokens = tokens.filter((t) => !ROLE_KEYWORDS[t]);
  const requiredRoles = new Set<Role>();
  for (const t of roleTokens) for (const r of ROLE_KEYWORDS[t]) requiredRoles.add(r);

  const out: SearchResult[] = [];
  for (const [nid, node] of Object.entries(spec.nodes)) {
    if (requiredRoles.size > 0) {
      const hasAny = node.roles.some((r) => requiredRoles.has(r));
      if (!hasAny) continue;
    }
    if (nameTokens.length === 0) {
      out.push({ nid, name: node.name, roles: node.roles, year: node.year, score: 1000 });
      continue;
    }
    const nameLower = node.name.toLowerCase();
    let score = 0;
    let allHit = true;
    for (const t of nameTokens) {
      const idx = nameLower.indexOf(t);
      if (idx < 0) {
        allHit = false;
        break;
      }
      score += idx; // earlier match scores better
    }
    if (!allHit) continue;
    // Bonus if name starts with first token.
    if (nameLower.startsWith(nameTokens[0])) score -= 100;
    out.push({ nid, name: node.name, roles: node.roles, year: node.year, score });
  }

  out.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return out.slice(0, limit);
}

export function renderSearchResults(
  results: SearchResult[],
  listEl: HTMLUListElement,
  onPick: (nid: string) => void,
): void {
  listEl.replaceChildren();
  if (results.length === 0) {
    listEl.hidden = true;
    return;
  }
  for (const r of results) {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.dataset.nid = r.nid;
    const name = document.createElement("span");
    name.className = "result-name";
    name.textContent = r.name;
    const meta = document.createElement("span");
    meta.className = "result-meta";
    const role = r.roles[0] ? ROLE_LABELS[r.roles[0]] : "";
    meta.textContent = [role, r.year].filter(Boolean).join(" · ");
    li.append(name, meta);
    li.addEventListener("mousedown", (e) => {
      e.preventDefault(); // don't blur the input before click registers
      onPick(r.nid);
    });
    listEl.append(li);
  }
  listEl.hidden = false;
}
