"use client";

import { API_URL } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { AGENT_STEPS, formatWhen } from "@/lib/investigations";

type AgentStat = {
  agent_name: string;
  total_runs: number;
  completed: number;
  failed: number;
  running: number;
  last_run_at: string | null;
  avg_seconds: number | null;
  success_rate: number | null;
};

type Stats = {
  agents: AgentStat[];
  investigations: {
    total: number;
    completed: number;
    completed_with_errors: number;
    failed: number;
    in_progress: number;
  };
};

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="panel rounded-2xl px-5 py-4">
      <dt className="text-sm text-dust">{label}</dt>
      <dd className="font-display mt-1 text-3xl">{value}</dd>
      <p className="mt-1 text-sm text-dust">{hint}</p>
    </div>
  );
}

function rateColor(rate: number): string {
  if (rate >= 0.95) return "#5EE1E6";
  if (rate >= 0.8) return "#3FA9F5";
  return "#F2A65A";
}

export function AgentsView() {
  const stats = useApi<Stats>("/agents/stats");

  if (stats.status === "error") {
    return (
      <div className="panel max-w-xl rounded-3xl p-6">
        <h1 className="font-display text-2xl font-semibold">
          Can&apos;t reach the backend
        </h1>
        <p className="mt-3 text-dust">
          The dashboard tried {API_URL} and got: {stats.message}. Start the
          backend and reload this page.
        </p>
      </div>
    );
  }

  if (stats.status !== "ready") {
    return <p className="text-dust">Loading agent history from the backend.</p>;
  }

  const { agents, investigations: inv } = stats.data;
  const byName = new Map(agents.map((a) => [a.agent_name, a]));
  const withErrors = inv.completed_with_errors + inv.failed;

  return (
    <div>
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Agents
        </h1>
        <p className="mt-3 text-dust">
          Eight AI agents work through every star in turn. This is their record
          across all the investigations so far.
        </p>
      </header>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <Tile
          label="Investigations run"
          value={inv.total}
          hint="Across all stars"
        />
        <Tile
          label="Completed cleanly"
          value={inv.completed}
          hint="Every agent finished its step"
        />
        <Tile
          label="Had agent errors"
          value={withErrors}
          hint="At least one agent failed"
        />
      </dl>
      {inv.in_progress > 0 && (
        <p className="mt-3 text-sm text-dust" aria-live="polite">
          {inv.in_progress} {inv.in_progress === 1 ? "investigation is" : "investigations are"}{" "}
          running right now.
        </p>
      )}

      <div className="panel mt-6 overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="text-dust">
              <th scope="col" className="px-6 py-4 font-medium">
                Agent
              </th>
              <th scope="col" className="px-6 py-4 font-medium">
                Success rate
              </th>
              <th scope="col" className="px-6 py-4 text-right font-medium">
                Average time
              </th>
              <th scope="col" className="px-6 py-4 text-right font-medium">
                Last run
              </th>
            </tr>
          </thead>
          <tbody>
            {AGENT_STEPS.map((step, i) => {
              const s = byName.get(step.key);
              const rate = s?.success_rate ?? null;
              return (
                <tr key={step.key} className="border-t border-line align-top">
                  <td className="px-6 py-4">
                    <p className="font-display text-base font-semibold text-starlight">
                      {i + 1}. {step.name}
                    </p>
                    <p className="mt-0.5 text-dust">{step.job}</p>
                  </td>
                  <td className="px-6 py-4">
                    {s && rate !== null ? (
                      <div>
                        <div className="flex items-center gap-3">
                          <div
                            className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10"
                            aria-hidden="true"
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.round(rate * 100)}%`,
                                background: rateColor(rate),
                              }}
                            />
                          </div>
                          <span className="font-display text-base">
                            {Math.round(rate * 100)}%
                          </span>
                        </div>
                        <p className="mt-1 text-dust">
                          {s.completed} of {s.total_runs}{" "}
                          {s.total_runs === 1 ? "run" : "runs"} succeeded
                        </p>
                      </div>
                    ) : (
                      <span className="text-dust">Never run</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {s?.avg_seconds != null ? (
                      `${s.avg_seconds.toFixed(1)}s`
                    ) : (
                      <span className="text-dust">No data</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-dust">
                    {s?.last_run_at ? formatWhen(s.last_run_at) : "Never"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}