import { RING_LABELS, TIER_KEYS } from "@/lib/candidates";

export type AgentRun = {
  agent_name: string;
  status: string;
  output_data: Record<string, unknown> | null;
  started_at?: string;
  completed_at?: string | null;
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

export const FINISHED_STATES = ["completed", "failed"];

// The eight agents in the order they run, with the investigation state each one sets.
export const AGENT_STEPS = [
  {
    key: "data_agent",
    state: "data_analysis",
    name: "Data Agent",
    job: "Summarises the light curve",
  },
  {
    key: "astronomy_analyst",
    state: "astronomy_analysis",
    name: "Astronomy Analyst",
    job: "Interprets what the pattern could mean",
  },
  {
    key: "research_agent",
    state: "research",
    name: "Research Agent",
    job: "Adds background from known cases",
  },
  {
    key: "scientific_tool_agent",
    state: "scientific_tools",
    name: "Scientific Tool Agent",
    job: "Runs the transit search and statistical tests",
  },
  {
    key: "hypothesis_agent",
    state: "hypothesis",
    name: "Hypothesis Agent",
    job: "Proposes one testable explanation",
  },
  {
    key: "critic_agent",
    state: "critique",
    name: "Critic Agent",
    job: "Tries to find holes in that explanation",
  },
  {
    key: "evidence_aggregator",
    state: "evidence_aggregation",
    name: "Evidence Aggregator",
    job: "Weighs all the evidence together",
  },
  {
    key: "discovery_ranker",
    state: "ranking",
    name: "Discovery Ranker",
    job: "Sets the final priority score",
  },
];

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
export function parseUtc(iso: string): Date {
  const hasZone = /(Z|[+-]\d\d:\d\d)$/.test(iso);
  return new Date(hasZone ? iso : `${iso}Z`);
}

export function formatWhen(iso: string): string {
  return parseUtc(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function secondsBetween(
  start?: string,
  end?: string | null,
): number | null {
  if (!start || !end) return null;
  const s = (parseUtc(end).getTime() - parseUtc(start).getTime()) / 1000;
  return Number.isFinite(s) && s >= 0 ? s : null;
}

// One plain-language line about what a finished agent produced.
export function stepSummary(
  agent: string,
  out: Record<string, unknown> | null,
): string | null {
  if (!out) return null;

  switch (agent) {
    case "data_agent": {
      const n = asNumber(out.n_points);
      return n !== null ? `${n} cleaned readings analysed` : null;
    }
    case "astronomy_analyst": {
      const c = asText(out.confidence);
      return c ? `Confidence this is a real signal: ${c}` : null;
    }
    case "research_agent": {
      const cases = out.similar_known_cases;
      if (!Array.isArray(cases)) return null;
      return `${cases.length} comparable known ${cases.length === 1 ? "case" : "cases"} found`;
    }
    case "scientific_tool_agent": {
      const t = out.transit_search as Record<string, unknown> | undefined;
      const period = asNumber(t?.best_period_days);
      const snr = asNumber(t?.transit_depth_snr);
      if (period === null) return "The transit search could not run";
      return `Best repeating dip every ${period.toFixed(2)} days${
        snr !== null ? `, signal-to-noise ${snr.toFixed(1)}` : ""
      }`;
    }
    case "hypothesis_agent": {
      const c = asNumber(out.confidence);
      return c !== null
        ? `Proposed with ${Math.round(c * 100)}% confidence`
        : null;
    }
    case "critic_agent": {
      const v = asText(out.verdict);
      const c = asNumber(out.revised_confidence);
      if (!v) return null;
      return `${verdictLabel(v)}${
        c !== null ? `, confidence revised to ${Math.round(c * 100)}%` : ""
      }`;
    }
    case "evidence_aggregator": {
      const r = asText(out.final_recommendation);
      return r ? recommendationLabel(r) : null;
    }
    case "discovery_ranker": {
      const tier = asText(out.priority_tier);
      const score = asNumber(out.priority_score);
      if (!tier) return null;
      return `${tierLabel(tier)} ring${
        score !== null ? `, priority ${score.toFixed(2)}` : ""
      }`;
    }
    default:
      return null;
  }
}