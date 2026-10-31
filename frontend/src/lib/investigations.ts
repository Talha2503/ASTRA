import { RING_LABELS, TIER_KEYS } from "@/lib/candidates";

export type AgentRun = {
  agent_name: string;
  status: string;
  output_data: Record<string, unknown> | null;
};

export type Hypothesis = {
  id: string;
  description: string;
  confidence: number | null;
  status: string;
};

export type InvestigationDetail = {
  investigation_id: string;
  candidate_id: string;
  state: string;
  started_at: string;
  completed_at: string | null;
  agent_runs: AgentRun[];
  hypotheses: Hypothesis[];
};

export const asText = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;

export const asNumber = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

// Output of the most recent completed run of one agent, or null if it never ran.
export function runOutput(
  inv: InvestigationDetail,
  agent: string,
): Record<string, unknown> | null {
  const runs = inv.agent_runs.filter(
    (r) => r.agent_name === agent && r.status === "completed",
  );
  return runs.length ? runs[runs.length - 1].output_data : null;
}

const VERDICTS: Record<string, string> = {
  supported: "Supported",
  weakly_supported: "Weakly supported",
  not_supported: "Not supported",
};

const RECOMMENDATIONS: Record<string, string> = {
  high_priority_followup: "High priority follow-up",
  moderate_priority_followup: "Moderate priority follow-up",
  low_priority: "Low priority",
  likely_false_positive: "Likely a false positive",
};

const HYPOTHESIS_STATUS: Record<string, string> = {
  proposed: "Proposed",
  supported: "Supported",
  weakly_supported: "Weakly supported",
  rejected: "Rejected",
};

const STATES: Record<string, string> = {
  completed: "Completed",
  failed: "Failed",
};

const fallback = (key: string) => key.replace(/_/g, " ");

export const verdictLabel = (k: string) => VERDICTS[k] ?? fallback(k);
export const recommendationLabel = (k: string) =>
  RECOMMENDATIONS[k] ?? fallback(k);
export const hypothesisStatusLabel = (k: string) =>
  HYPOTHESIS_STATUS[k] ?? fallback(k);
export const stateLabel = (k: string) =>
  STATES[k] ?? `In progress (${fallback(k)})`;

export function tierLabel(tier: string): string {
  const i = TIER_KEYS.indexOf(tier);
  return i === -1 ? fallback(tier) : RING_LABELS[i];
}

// The backend sends UTC timestamps without a timezone marker.
export function formatWhen(iso: string): string {
  const hasZone = /(Z|[+-]\d\d:\d\d)$/.test(iso);
  return new Date(hasZone ? iso : `${iso}Z`).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}