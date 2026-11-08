"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { API_URL } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { type Candidate, RING_LABELS, ringIndex } from "@/lib/candidates";
import {
  AGENT_STEPS,
  FINISHED_STATES,
  type InvestigationDetail,
  asText,
  formatWhen,
  hypothesisStatusLabel,
  recommendationLabel,
  runOutput,
  stateLabel,
  stepSummary,
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

const textList = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : [];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 break-inside-avoid">
      <h2 className="font-display border-b border-slate-200 pb-2 text-lg font-semibold text-slate-900">
        {title}
      </h2>
      <div className="mt-3 text-[15px] leading-relaxed text-slate-700">
        {children}
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="font-display mt-0.5 text-xl font-semibold text-slate-900">
        {value}
      </dd>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-2 rounded-full bg-sky-100 px-2.5 py-0.5 align-middle text-xs font-medium text-sky-800">
      {children}
    </span>
  );
}

function measurementRows(features: Record<string, number | null>) {
  const f = (k: string) => features[k] ?? null;
  const rows: { label: string; value: string }[] = [];

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
      value: `Every ${period.toFixed(2)} days${
        power !== null ? `, strength ${power.toFixed(2)} on a 0 to 1 scale` : ""
      }`,
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
    rows.push({ label: "Dip sharpness (skewness)", value: skew.toFixed(2) });
  }

  return rows;
}

export function ReportView() {
  const { id } = useParams<{ id: string }>();

  const candidate = useApi<CandidateDetail>(`/candidates/${id}`);
  const c = candidate.status === "ready" ? candidate.data : null;

  const curve = useApi<Curve>(c ? `/analysis/curve/${c.light_curve_id}` : null);
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
            ? "No candidate exists with this ID. Pick a report from the Reports list."
            : `The dashboard tried ${API_URL} and got: ${candidate.message}. Start the backend and reload this page.`}
        </p>
        <Link
          href="/reports"
          className="mt-4 inline-block text-sm text-aurora hover:underline"
        >
          Back to Reports
        </Link>
      </div>
    );
  }

  if (!c) {
    return <p className="text-dust">Loading this report.</p>;
  }

  if (c.n_investigations === 0) {
    return (
      <div className="panel max-w-xl rounded-3xl p-6">
        <h1 className="font-display text-2xl font-semibold">
          No report for {c.target_id} yet
        </h1>
        <p className="mt-3 text-dust">
          This star hasn&apos;t been investigated, so there is nothing to
          report. Open the star and run an investigation first.
        </p>
        <Link
          href={`/candidates/${c.candidate_id}`}
          className="mt-4 inline-block text-sm text-aurora hover:underline"
        >
          Open {c.target_id}
        </Link>
      </div>
    );
  }

  if (investigation.status === "error") {
    return (
      <p className="text-dust">
        The investigation couldn&apos;t be loaded ({investigation.message}).
      </p>
    );
  }

  if (investigation.status !== "ready") {
    return <p className="text-dust">Loading this report.</p>;
  }

  const inv = investigation.data;
  const hypothesis = inv.hypotheses.length
    ? inv.hypotheses[inv.hypotheses.length - 1]
    : null;
  const analyst = runOutput(inv, "astronomy_analyst");
  const hypAgent = runOutput(inv, "hypothesis_agent");
  const critic = runOutput(inv, "critic_agent");
  const aggregator = runOutput(inv, "evidence_aggregator");
  const ranker = runOutput(inv, "discovery_ranker");

  const justification = asText(ranker?.ranking_justification);
  const tier = asText(ranker?.priority_tier);
  const recommendation = asText(aggregator?.final_recommendation);
  const assessment = asText(aggregator?.overall_assessment);
  const critique = asText(critic?.verdict ? critic.critique : critic?.critique);
  const verdict = asText(critic?.verdict);
  const weaknesses = textList(critic?.weaknesses_identified);
  const howToTest = asText(hypAgent?.how_to_test);
  const nextStep = asText(analyst?.recommended_next_step);
  const measurements = c.features ? measurementRows(c.features) : [];
  const finished = FINISHED_STATES.includes(inv.state) && inv.state === "completed";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 text-sm text-dust transition-colors hover:text-starlight"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Reports
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-ion/15 px-4 py-2.5 text-sm font-medium text-aurora transition-colors hover:bg-ion/25"
        >
          <Printer size={16} aria-hidden="true" />
          Print or save as PDF
        </button>
      </div>

      <article className="report-sheet mx-auto max-w-[820px] rounded-2xl bg-white p-8 text-slate-800 shadow-2xl sm:p-12 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header>
          <p className="text-sm font-medium tracking-wide text-sky-700">
            ASTRA investigation report
          </p>
          <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-slate-900">
            {c.target_id}
          </h1>
          <p className="mt-2 text-slate-500">
            {c.mission} light curve. Investigated {formatWhen(inv.started_at)}.
          </p>
        </header>

        {!finished && (
          <p className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            The latest investigation is {stateLabel(inv.state).toLowerCase()}, so
            this report may be incomplete.
          </p>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-5 rounded-xl bg-slate-50 p-5 sm:grid-cols-4">
          <Fact label="Anomaly score" value={c.anomaly_score.toFixed(2)} />
          <Fact
            label="Priority score"
            value={
              c.priority_score !== null ? c.priority_score.toFixed(2) : "Not ranked"
            }
          />
          <Fact label="Priority ring" value={RING_LABELS[ringIndex(c)]} />
          <Fact
            label="Recommendation"
            value={recommendation ? recommendationLabel(recommendation) : "None"}
          />
        </dl>

        <Section title="In short">
          <p>
            {justification ??
              "This investigation finished before the final ranking step existed, so there is no ranking summary for this star."}
          </p>
        </Section>

        <Section title="Light curve">
          <p className="text-sm text-slate-500">
            The star&apos;s brightness over time, cleaned and scaled so 1.0 is
            normal. Points below the dashed line are moments it dimmed.
          </p>
          <div className="mt-3 h-[260px] w-full">
            {curve.status === "ready" ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
                  <CartesianGrid stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    dataKey="t"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(v: number) => v.toFixed(0)}
                    tick={{ fill: "#475569", fontSize: 11 }}
                    stroke="#94a3b8"
                    label={{
                      value: "Day of observation",
                      position: "insideBottom",
                      offset: -12,
                      fill: "#475569",
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="f"
                    width={64}
                    domain={([min, max]: [number, number]) => {
                      const pad = (max - min) * 0.15 || 0.0005;
                      return [min - pad, max + pad];
                    }}
                    tickFormatter={(v: number) => v.toFixed(4)}
                    tick={{ fill: "#475569", fontSize: 11 }}
                    stroke="#94a3b8"
                  />
                  <ZAxis range={[10, 10]} />
                  <ReferenceLine y={1} stroke="#94a3b8" strokeDasharray="4 6" />
                  <Scatter
                    data={points}
                    fill="#1d6fb8"
                    fillOpacity={0.75}
                    isAnimationActive={false}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            ) : curve.status === "error" ? (
              <p className="text-sm text-slate-500">
                The light curve couldn&apos;t be loaded ({curve.message}).
              </p>
            ) : (
              <p className="text-sm text-slate-500">Loading the light curve.</p>
            )}
          </div>
        </Section>

        {measurements.length > 0 && (
          <Section title="Measurements">
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {measurements.map((m) => (
                <div key={m.label}>
                  <dt className="text-sm text-slate-500">{m.label}</dt>
                  <dd className="text-slate-900">{m.value}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}

        {hypothesis && (
          <Section title="Hypothesis">
            <p>
              {hypothesis.description}
              <Badge>{hypothesisStatusLabel(hypothesis.status)}</Badge>
            </p>
            {hypothesis.confidence !== null && (
              <p className="mt-2 text-slate-500">
                Confidence after the Critic&apos;s review:{" "}
                {Math.round(hypothesis.confidence * 100)}%
              </p>
            )}
          </Section>
        )}

        {critique && (
          <Section title="Critic's review">
            <p>
              {critique}
              {verdict && <Badge>{verdictLabel(verdict)}</Badge>}
            </p>
            {weaknesses.length > 0 && (
              <>
                <p className="mt-3 font-medium text-slate-900">
                  Weaknesses the Critic found
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {weaknesses.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </>
            )}
          </Section>
        )}

        {assessment && (
          <Section title="Combined assessment">
            <p>{assessment}</p>
          </Section>
        )}

        {(howToTest || nextStep) && (
          <Section title="Suggested next steps">
            <ul className="list-disc space-y-2 pl-5">
              {nextStep && <li>{nextStep}</li>}
              {howToTest && <li>{howToTest}</li>}
            </ul>
          </Section>
        )}

        {tier && (
          <Section title="Final ranking">
            <p>
              Placed in the {tierLabel(tier)} ring
              {c.priority_score !== null
                ? ` with a priority score of ${c.priority_score.toFixed(2)}`
                : ""}
              .
            </p>
          </Section>
        )}

        <Section title="How this report was produced">
          <p>
            Eight AI agents worked through the star in turn. What each one
            contributed:
          </p>
          <table className="mt-3 w-full text-left text-sm">
            <tbody>
              {AGENT_STEPS.map((step) => {
                const out = runOutput(inv, step.key);
                return (
                  <tr key={step.key} className="border-t border-slate-200 align-top">
                    <td className="py-2 pr-4 font-medium whitespace-nowrap text-slate-900">
                      {step.name}
                    </td>
                    <td className="py-2 text-slate-600">
                      {out
                        ? (stepSummary(step.key, out) ?? "Completed")
                        : "Did not run"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-4">
            The priority score is a weighted mix: 25% how unusual the anomaly
            detector found the light curve, 30% the Critic&apos;s revised
            confidence, 15% evidence quality, and 30% the Evidence Aggregator&apos;s
            recommendation.
          </p>
        </Section>

        <Section title="Limits of this report">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              The written findings are AI-generated and preliminary. Treat them
              as leads for follow-up, not confirmed discoveries.
            </li>
            <li>
              The Research Agent works from general knowledge, not a live
              literature search.
            </li>
            <li>
              Each light curve covers a single stretch of Kepler data, so a
              repeating signal much longer than about half that stretch cannot
              be confirmed.
            </li>
          </ul>
        </Section>
      </article>
    </div>
  );
}