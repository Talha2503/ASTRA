export type Candidate = {
  candidate_id: string;
  light_curve_id: string;
  target_id: string | null;
  mission: string | null;
  anomaly_score: number;
  priority_score: number | null;
  priority_tier: string | null;
  status: string;
  n_investigations: number;
  latest_investigation_id: string | null;
  latest_investigation_state: string | null;
  created_at: string;
};

// Inner ring = most urgent. The last entry is where unranked stars sit.
export const TIER_KEYS = [
  "tier_1_urgent",
  "tier_2_promising",
  "tier_3_marginal",
  "tier_4_likely_noise",
];

export const RING_LABELS = [
  "Urgent",
  "Promising",
  "Marginal",
  "Likely noise",
  "Not yet ranked",
];

export function ringIndex(c: Candidate): number {
  const i = TIER_KEYS.indexOf(c.priority_tier ?? "");
  return i === -1 ? TIER_KEYS.length : i;
}

export function planetColor(c: Candidate): string {
  const ring = ringIndex(c);
  if (ring <= 1) return "#F2A65A";
  if (ring === 2) return "#3FA9F5";
  if (ring === 3) return "#7E8DB0";
  return c.status === "anomalous" ? "#5EE1E6" : "#7E8DB0";
}

function better(a: Candidate, b: Candidate): boolean {
  if (a.n_investigations !== b.n_investigations) {
    return a.n_investigations > b.n_investigations;
  }
  const pa = a.priority_score ?? -1;
  const pb = b.priority_score ?? -1;
  if (pa !== pb) return pa > pb;
  return a.anomaly_score > b.anomaly_score;
}

// One entry per star: keep the most investigated / highest ranked row.
export function dedupeByStar(list: Candidate[]): Candidate[] {
  const best = new Map<string, Candidate>();
  for (const c of list) {
    const key = c.target_id ?? c.candidate_id;
    const current = best.get(key);
    if (!current || better(c, current)) best.set(key, c);
  }
  return [...best.values()];
}