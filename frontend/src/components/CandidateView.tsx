"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { API_URL, api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import {
  type Candidate,
  RING_LABELS,
  planetColor,
  ringIndex,
} from "@/lib/candidates";
import {
  FINISHED_STATES,
  type InvestigationDetail,
  asNumber,
  asText,
  formatWhen,
  hypothesisStatusLabel,
  recommendationLabel,
  runOutput,
  stateLabel,
  tierLabel,
  verdictLabel,
} from "@/lib/investigations";

type CandidateDetail = Candidate & {
  features: Record<string, number | null> | null;
};

type Curve = {
  target_id: string;
  mission: string;
  n_points: number;
  time: number[];
  flux: number[];
};

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel rounded-2xl px-5 py-4">
      <dt className="text-sm text-dust">{label}</dt>
      <dd className="font-display mt-1 text-2xl">{value}</dd>
    </div>
  );
}

function Finding({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {badge && (
          <span className="rounded-full bg-ion/15 px-3 py-1 text-sm text-aurora">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-2 text-sm leading-relaxed text-starlight/90">
        {children}
      </div>
    </section>
  );
}

function Findings({ inv }: { inv: InvestigationDetail }) {
  const hypothesis = inv.hypotheses.length
    ? inv.hypotheses[inv.hypotheses.length - 1]
    : null;
  const critic = runOutput(inv, "critic_agent");
  const aggregator = runOutput(inv, "evidence_aggregator");
  const ranker = runOutput(inv, "discovery_ranker");

  const verdict = asText(critic?.verdict);
  const critique = asText(critic?.critique);
  const recommendation = asText(aggregator?.final_recommendation);
  const assessment = asText(aggregator?.overall_assessment);
  const tier = asText(ranker?.priority_tier);
  const rankScore = asNumber(ranker?.priority_score);
  const justification = asText(ranker?.ranking_justification);

  return (
    <div className="space-y-5">
      <p className="text-sm text-dust">
        {stateLabel(inv.state)}, started {formatWhen(inv.started_at)}
      </p>

      {hypothesis && (
        <Finding
          title="Hypothesis"
          badge={hypothesisStatusLabel(hypothesis.status)}
        >
          <p>{hypothesis.description}</p>
          {hypothesis.confidence !== null && (
            <p className="mt-2 text-dust">
              Confidence after the Critic&apos;s review:{" "}
              {Math.round(hypothesis.confidence * 100)}%
            </p>
          )}
        </Finding>
      )}

      {critique && (
        <Finding
          title="Critic's review"
          badge={verdict ? verdictLabel(verdict) : null}
        >
          <p>{critique}</p>
        </Finding>
      )}

      {assessment && (
        <Finding
          title="Combined assessment"
          badge={recommendation ? recommendationLabel(recommendation) : null}
        >
          <p>{assessment}</p>
        </Finding>
      )}

      {justification && (
        <Finding
          title="Final ranking"
          badge={
            tier
              ? `${tierLabel(tier)}${rankScore !== null ? `, ${rankScore.toFixed(2)}` : ""}`
              : null
          }
        >
          <p>{justification}</p>
        </Finding>
      )}

      {inv.state === "completed" && !ranker && (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-dust">
          This investigation finished before the combined assessment and final
          ranking steps existed, so it has no priority score.
        </p>
      )}
    </div>
  );
}

function Measurements({
  features,
}: {
  features: Record<string, number | null>;
}) {
  const f = (k: string) => features[k] ?? null;
  const rows: { label: string; value: string; hint?: string }[] = [];

  const n = f("n_points");
  const span = f("duration_days");
  if (n !== null && span !== null) {
    rows.push({
      label: "Length of the recording",
      value: `${n} readings over ${span.toFixed(1)} days`,
    });
  }

  const period = f("dominant_period_days");
  const power = f("dominant_power");
  if (period !== null) {
    rows.push({
      label: "Strongest repeating signal",
      value: `Every ${period.toFixed(2)} days`,
      hint:
        power !== null
          ? `Signal strength ${power.toFixed(2)} on a 0 to 1 scale.`
          : undefined,
    });
  }

  const std = f("std");
  if (std !== null) {
    rows.push({
      label: "Typical wobble",
      value: `${(std * 100).toFixed(3)}% of the star's brightness`,
    });
  }

  const min = f("min");
  if (min !== null) {
    rows.push({
      label: "Deepest dip",
      value: `${((1 - min) * 100).toFixed(2)}% below normal`,
    });
  }

  const skew = f("skewness");
  if (skew !== null) {
    rows.push({
      label: "Dip sharpness (skewness)",
      value: skew.toFixed(2),
      hint: "Strongly negative means brief, sharp dips rather than gentle swings.",
    });
  }

  return (
    <dl className="space-y-4">
      {rows.map((r) => (
        <div key={r.label}>
          <dt className="text-sm text-dust">{r.label}</dt>
          <dd className="mt-0.5 text-starlight">{r.value}</dd>
          {r.hint && <p className="mt-0.5 text-sm text-dust">{r.hint}</p>}
        </div>
      ))}
    </dl>
  );
}

export function CandidateView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const candidate = useApi<CandidateDetail>(`/candidates/${id}`);
  const c = candidate.status === "ready" ? candidate.data : null;

  const curve = useApi<Curve>(
    c ? `/analysis/curve/${c.light_curve_id}` : null,
  );
  const investigation = useApi<InvestigationDetail>(
    c?.latest_investigation_id
      ? `/investigations/${c.latest_investigation_id}`
      : null,
  );

  const curveData = curve.status === "ready" ? curve.data : null;
  const points = useMemo(
    () =>
      curveData ? curveData.time.map((t, i) => ({ t, f: curveData.flux[i] })) : [],
    [curveData],
  );

  if (candidate.status === "error") {
    const notFound = candidate.message.startsWith("404");
    return (
      <div className="panel max-w-xl rounded-3xl p-6">
        <h1 className="font-display text-2xl font-semibold">
          {notFound ? "Star not found" : "Can't reach the backend"}
        </h1>
        <p className="mt-3 text-dust">
          {notFound
            ? "No candidate exists with this ID. Pick a star from the Discoveries list."
            : `The dashboard tried ${API_URL} and got: ${candidate.message}. Start the backend and reload this page.`}
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

  if (!c) {
    return <p className="text-dust">Loading this star from the backend.</p>;
  }

  const color = planetColor(c);
  const latestId = c.latest_investigation_id;
  const latestState = c.latest_investigation_state;
  const running =
    latestId !== null &&
    latestState !== null &&
    !FINISHED_STATES.includes(latestState);

  const launch = async () => {
    setLaunching(true);
    setLaunchError(null);
    try {
      const res = await api<{ investigation_id: string }>(
        `/investigations/launch/${c.candidate_id}`,
        { method: "POST" },
      );
      router.push(`/investigations/${res.investigation_id}`);
    } catch (e) {
      setLaunchError((e as Error).message);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div>
      <Link
        href="/discoveries"
        className="inline-flex items-center gap-1.5 text-sm text-dust transition-colors hover:text-starlight"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Discoveries
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            {c.target_id}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-dust">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: color, boxShadow: `0 0 8px ${color}` }}
            />
            {c.mission} light curve, {RING_LABELS[ringIndex(c)].toLowerCase()}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <Tile label="Anomaly score" value={c.anomaly_score.toFixed(2)} />
          <Tile
            label="Priority score"
            value={
              c.priority_score !== null ? c.priority_score.toFixed(2) : "Not ranked"
            }
          />
          <Tile label="Investigations" value={String(c.n_investigations)} />
        </dl>
      </header>

      <section className="panel mt-8 rounded-3xl p-6">
        <h2 className="font-display text-xl font-semibold">Light curve</h2>
        <p className="mt-1 text-sm text-dust">
          The star&apos;s brightness over time, cleaned and scaled so 1.0 is
          normal. Points below the dashed line are moments it dimmed.
        </p>
        <div className="mt-4 h-[360px]">
          {curve.status === "ready" ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 28, left: 8 }}>
                <CartesianGrid stroke="rgba(110,150,230,0.12)" />
                <XAxis
                  type="number"
                  dataKey="t"
                  name="Day"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v: number) => v.toFixed(0)}
                  tick={{ fill: "#7E8DB0", fontSize: 12 }}
                  stroke="rgba(110,150,230,0.3)"
                  label={{
                    value: "Day of observation",
                    position: "insideBottom",
                    offset: -14,
                    fill: "#7E8DB0",
                    fontSize: 13,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="f"
                  name="Brightness"
                  width={72}
                  domain={([min, max]: [number, number]) => {
                    const pad = (max - min) * 0.15 || 0.0005;
                    return [min - pad, max + pad];
                  }}
                  tickFormatter={(v: number) => v.toFixed(4)}
                  tick={{ fill: "#7E8DB0", fontSize: 12 }}
                  stroke="rgba(110,150,230,0.3)"
                />
                <ZAxis range={[14, 14]} />
                <ReferenceLine
                  y={1}
                  stroke="#7E8DB0"
                  strokeDasharray="4 6"
                />
                <Tooltip
                  cursor={{ stroke: "#7E8DB0", strokeDasharray: "3 3" }}
                  contentStyle={{
                    background: "#0E1A3A",
                    border: "1px solid rgba(110,150,230,0.3)",
                    borderRadius: 12,
                    color: "#E6EEFF",
                  }}
                  itemStyle={{ color: "#E6EEFF" }}
                  formatter={(value) =>
                    typeof value === "number" ? value.toFixed(5) : String(value)
                  }
                />
                <Scatter
                  data={points}
                  fill="#5EE1E6"
                  fillOpacity={0.8}
                  isAnimationActive={false}
                />
              </ScatterChart>
            </ResponsiveContainer>
          ) : curve.status === "error" ? (
            <p className="text-dust">
              The light curve couldn&apos;t be loaded ({curve.message}).
            </p>
          ) : (
            <p className="text-dust">Loading the light curve.</p>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="panel rounded-3xl p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">
              What the agents concluded
            </h2>
            {latestId && (
              <Link
                href={`/investigations/${latestId}`}
                className="text-sm text-aurora hover:underline"
              >
                View the agent timeline
              </Link>
            )}
          </div>

          <div className="mt-4">
            {c.n_investigations === 0 ? (
              <p className="text-sm text-dust">
                No investigation has run on this star yet.
              </p>
            ) : investigation.status === "ready" ? (
              <Findings inv={investigation.data} />
            ) : investigation.status === "error" ? (
              <p className="text-sm text-dust">
                The investigation couldn&apos;t be loaded ({investigation.message}).
              </p>
            ) : (
              <p className="text-sm text-dust">Loading the latest investigation.</p>
            )}
          </div>

          <div className="mt-6 border-t border-line pt-5">
            {running ? (
              <>
                <Link
                  href={`/investigations/${latestId}`}
                  className="inline-block rounded-xl bg-ion/15 px-4 py-2.5 text-sm font-medium text-aurora transition-colors hover:bg-ion/25"
                >
                  Watch the live run
                </Link>
                <p className="mt-2 text-sm text-dust">
                  An investigation is already running on this star. If it looks
                  stuck,{" "}
                  <button
                    type="button"
                    disabled={launching}
                    onClick={() => void launch()}
                    className="text-aurora underline-offset-2 hover:underline disabled:opacity-60"
                  >
                    start a new one
                  </button>
                  .
                </p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={launching}
                  onClick={() => void launch()}
                  className="rounded-xl bg-ion/15 px-4 py-2.5 text-sm font-medium text-aurora transition-colors hover:bg-ion/25 disabled:opacity-60"
                >
                  {launching
                    ? "Starting a new run"
                    : c.n_investigations === 0
                      ? "Run investigation"
                      : "Run another investigation"}
                </button>
                <p className="mt-2 text-sm text-dust">
                  Each run uses eight AI calls, one per agent, and usually takes
                  under a minute.
                </p>
              </>
            )}
            {launchError && (
              <p className="mt-2 text-sm text-ember">
                Couldn&apos;t start an investigation: {launchError}
              </p>
            )}
          </div>
        </section>

        <section className="panel rounded-3xl p-6">
          <h2 className="font-display text-xl font-semibold">Measurements</h2>
          <div className="mt-4">
            {c.features ? (
              <Measurements features={c.features} />
            ) : (
              <p className="text-sm text-dust">No measurements stored.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}