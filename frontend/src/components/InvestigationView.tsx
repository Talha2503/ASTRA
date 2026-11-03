"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import { api, API_URL } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import type { Candidate } from "@/lib/candidates";
import {
  AGENT_STEPS,
  FINISHED_STATES,
  type InvestigationDetail,
  asNumber,
  asText,
  formatWhen,
  recommendationLabel,
  runOutput,
  secondsBetween,
  stateLabel,
  stepSummary,
  tierLabel,
} from "@/lib/investigations";

type Snapshot = { id: string; inv: InvestigationDetail };
type Problem = { id: string; message: string };

// Loads the investigation, then re-loads it whenever the live stream reports progress.
// A slow poll runs alongside as a safety net in case the stream drops.
function useLiveInvestigation(id: string) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;

    function stop() {
      source?.close();
      source = null;
      if (timer) clearInterval(timer);
      timer = undefined;
    }

    async function load() {
      try {
        const inv = await api<InvestigationDetail>(`/investigations/${id}`);
        if (cancelled) return;
        setSnap({ id, inv });
        setProblem(null);
        if (FINISHED_STATES.includes(inv.state)) stop();
      } catch (e) {
        if (cancelled) return;
        const message = (e as Error).message;
        setProblem({ id, message });
        if (message.startsWith("404")) stop();
      }
    }

    void load();
    source = new EventSource(`${API_URL}/events/investigations/${id}/stream`);
    source.onmessage = () => {
      void load();
    };
    timer = setInterval(() => {
      void load();
    }, 5000);

    return () => {
      cancelled = true;
      stop();
    };
  }, [id]);

  return {
    inv: snap && snap.id === id ? snap.inv : null,
    problem: problem && problem.id === id ? problem.message : null,
  };
}

type StepStatus = "done" | "running" | "waiting" | "failed" | "skipped";

function stepStatus(
  inv: InvestigationDetail,
  step: (typeof AGENT_STEPS)[number],
): StepStatus {
  const runs = inv.agent_runs.filter((r) => r.agent_name === step.key);
  if (runs.some((r) => r.status === "completed")) return "done";
  if (runs.some((r) => r.status === "failed")) return "failed";
  if (!FINISHED_STATES.includes(inv.state) && inv.state === step.state) {
    return "running";
  }
  if (inv.state === "completed") return "skipped";
  return "waiting";
}

const NODE_STYLE: Record<StepStatus, string> = {
  done: "border-aurora/50 bg-aurora/10 text-aurora",
  running: "border-ion bg-ion/10 glow-ion",
  failed: "border-ember/60 bg-ember/10 text-ember",
  waiting: "border-line text-dust",
  skipped: "border-line text-dust opacity-60",
};

const STATUS_COLOR: Record<StepStatus, string> = {
  done: "text-aurora",
  running: "text-ion",
  failed: "text-ember",
  waiting: "text-dust",
  skipped: "text-dust",
};

export function InvestigationView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { inv, problem } = useLiveInvestigation(id);
  const star = useApi<Candidate>(
    inv ? `/candidates/${inv.candidate_id}` : null,
  );
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  async function runAgain(candidateId: string) {
    setLaunching(true);
    setLaunchError(null);
    try {
      const res = await api<{ investigation_id: string }>(
        `/investigations/launch/${candidateId}`,
        { method: "POST" },
      );
      router.push(`/investigations/${res.investigation_id}`);
    } catch (e) {
      setLaunchError((e as Error).message);
    } finally {
      setLaunching(false);
    }
  }

  if (!inv) {
    if (problem) {
      const notFound = problem.startsWith("404");
      return (
        <div className="panel max-w-xl rounded-3xl p-6">
          <h1 className="font-display text-2xl font-semibold">
            {notFound ? "Investigation not found" : "Can't reach the backend"}
          </h1>
          <p className="mt-3 text-dust">
            {notFound
              ? "No investigation exists with this ID. Open a star from the Discoveries list to see its investigations."
              : `The dashboard tried ${API_URL} and got: ${problem}. Start the backend and reload this page.`}
          </p>
          <Link
            href="/discoveries"
            className="mt-4 inline-block text-sm text-aurora hover:underline"
          >
            Back to Discoveries
          </Link>
        </div>
      );
    }
    return <p className="text-dust">Loading this investigation.</p>;
  }

  const starName = star.status === "ready" ? star.data.target_id : null;
  const finished = FINISHED_STATES.includes(inv.state);
  const statuses = AGENT_STEPS.map((s) => stepStatus(inv, s));
  const doneCount = statuses.filter((s) => s === "done").length;

  const failedRun = inv.agent_runs.find((r) => r.status === "failed");
  const failedStep = failedRun
    ? AGENT_STEPS.find((s) => s.key === failedRun.agent_name)
    : undefined;
  const errorText = asText(failedRun?.output_data?.error);

  const ranker = runOutput(inv, "discovery_ranker");
  const aggregator = runOutput(inv, "evidence_aggregator");
  const tier = asText(ranker?.priority_tier);
  const score = asNumber(ranker?.priority_score);
  const justification = asText(ranker?.ranking_justification);
  const recommendation = asText(aggregator?.final_recommendation);
  const hot = tier === "tier_1_urgent" || tier === "tier_2_promising";

  return (
    <div>
      <Link
        href={`/candidates/${inv.candidate_id}`}
        className="inline-flex items-center gap-1.5 text-sm text-dust transition-colors hover:text-starlight"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {starName ?? "Back to the star"}
      </Link>

      <header className="mt-4 max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {starName ? `Investigation of ${starName}` : "Investigation"}
        </h1>
        <p className="mt-3 text-dust" aria-live="polite">
          {finished
            ? `${stateLabel(inv.state)}. Started ${formatWhen(inv.started_at)}.`
            : "Live: this page updates as each agent finishes."}
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="panel rounded-3xl p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl font-semibold">Agent timeline</h2>
            <p className="text-sm text-dust">
              {doneCount} of {AGENT_STEPS.length} agents done
            </p>
          </div>
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full bg-aurora transition-[width] duration-500"
              style={{ width: `${(doneCount / AGENT_STEPS.length) * 100}%` }}
            />
          </div>

          <ol className="mt-6">
            {AGENT_STEPS.map((step, i) => {
              const status = statuses[i];
              const run = [...inv.agent_runs]
                .reverse()
                .find((r) => r.agent_name === step.key);
              const seconds =
                status === "done"
                  ? secondsBetween(run?.started_at, run?.completed_at)
                  : null;
              const summary =
                status === "done"
                  ? stepSummary(step.key, runOutput(inv, step.key))
                  : null;
              const statusText =
                status === "done"
                  ? "Done"
                  : status === "running"
                    ? "Working"
                    : status === "failed"
                      ? "Failed"
                      : status === "skipped"
                        ? "Not part of this run"
                        : inv.state === "failed"
                          ? "Not reached"
                          : "Waiting";
              const dim = status === "waiting" || status === "skipped";

              return (
                <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < AGENT_STEPS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute top-9 left-[17px] h-[calc(100%-2.25rem)] w-px bg-line"
                    />
                  )}
                  <span
                    className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${NODE_STYLE[status]}`}
                  >
                    {status === "done" && <Check size={18} aria-hidden="true" />}
                    {status === "failed" && <X size={18} aria-hidden="true" />}
                    {status === "running" && (
                      <span className="h-2.5 w-2.5 rounded-full bg-ion motion-safe:animate-pulse" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <h3
                        className={`font-display text-base font-semibold ${dim ? "text-dust" : "text-starlight"}`}
                      >
                        {step.name}
                      </h3>
                      <p className={`text-sm ${STATUS_COLOR[status]}`}>
                        {statusText}
                        {seconds !== null && ` in ${seconds.toFixed(1)}s`}
                      </p>
                    </div>
                    <p className="mt-0.5 text-sm text-dust">{step.job}</p>
                    {summary && (
                      <p className="mt-1.5 text-sm text-starlight">{summary}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="flex flex-col gap-4">
          {!finished && (
            <section className="panel rounded-3xl p-6">
              <h2 className="font-display text-xl font-semibold">Result</h2>
              <p className="mt-2 text-sm text-dust">
                The final ranking appears here when all {AGENT_STEPS.length}{" "}
                agents have finished. A run usually takes under a minute.
              </p>
            </section>
          )}

          {inv.state === "failed" && (
            <section className="panel glow-ember rounded-3xl p-6">
              <h2 className="font-display text-xl font-semibold">
                Stopped early
              </h2>
              <p className="mt-2 text-sm text-dust">
                {failedStep
                  ? `The ${failedStep.name} failed, so the run stopped before the later steps.`
                  : "Something went wrong, so the run stopped before it finished."}
              </p>
              {errorText && (
                <p className="mt-3 text-sm break-words text-starlight/80">
                  {errorText}
                </p>
              )}
            </section>
          )}

          {inv.state === "completed" && (
            <section
              className={`panel rounded-3xl p-6 ${hot ? "glow-ember" : "glow-ion"}`}
            >
              <h2 className="font-display text-xl font-semibold">
                Final ranking
              </h2>
              {tier ? (
                <>
                  <p
                    className={`font-display mt-3 text-4xl font-semibold ${hot ? "text-ember" : "text-ion"}`}
                  >
                    {score !== null ? score.toFixed(2) : "No score"}
                  </p>
                  <p className="mt-1 text-starlight">{tierLabel(tier)} ring</p>
                  {recommendation && (
                    <p className="mt-1 text-sm text-dust">
                      {recommendationLabel(recommendation)}
                    </p>
                  )}
                  {justification && (
                    <p className="mt-4 text-sm leading-relaxed text-starlight/90">
                      {justification}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-dust">
                  This investigation finished before the ranking step existed,
                  so it has no priority score.
                </p>
              )}
              <Link
                href={`/candidates/${inv.candidate_id}`}
                className="mt-5 inline-block text-sm text-aurora hover:underline"
              >
                Read the full findings on the star page
              </Link>
            </section>
          )}

          {finished && (
            <div>
              <button
                type="button"
                disabled={launching}
                onClick={() => void runAgain(inv.candidate_id)}
                className="w-full rounded-xl bg-ion/15 px-4 py-2.5 text-sm font-medium text-aurora transition-colors hover:bg-ion/25 disabled:opacity-60"
              >
                {launching ? "Starting a new run" : "Run another investigation"}
              </button>
              {launchError && (
                <p className="mt-2 text-sm text-ember">
                  Couldn&apos;t start a new investigation: {launchError}
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}