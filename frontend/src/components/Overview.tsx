"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, API_URL } from "@/lib/api";
import {
  type Candidate,
  RING_LABELS,
  dedupeByStar,
  ringIndex,
} from "@/lib/candidates";
import { Orrery } from "@/components/Orrery";

const LEGEND = [
  { color: "#F2A65A", label: "Urgent or promising" },
  { color: "#3FA9F5", label: "Marginal" },
  { color: "#5EE1E6", label: "Flagged as unusual, not yet ranked" },
  { color: "#7E8DB0", label: "Normal, or likely noise" },
];

function investigationLine(c: Candidate): string {
  const times = `${c.n_investigations} ${c.n_investigations === 1 ? "time" : "times"}`;
  if (c.n_investigations === 0) return "Not investigated yet.";
  if (c.priority_score === null) {
    return `Investigated ${times}, before ranking existed. Run a new investigation to rank it.`;
  }
  return `${RING_LABELS[ringIndex(c)]}. Investigated ${times}.`;
}

export function Overview() {
  const router = useRouter();
  const [raw, setRaw] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    api<Candidate[]>("/candidates/")
      .then(setRaw)
      .catch((e: Error) => setError(e.message));
  }, []);

  const stars = useMemo(() => (raw ? dedupeByStar(raw) : []), [raw]);
  const active = stars.find((c) => c.candidate_id === (hoverId ?? selectedId));

  if (error) {
    return (
      <div className="panel max-w-xl rounded-3xl p-6">
        <h1 className="font-display text-2xl font-semibold">
          Can&apos;t reach the backend
        </h1>
        <p className="mt-3 text-dust">
          The dashboard tried {API_URL} and got: {error}. Start the backend with{" "}
          <code className="text-starlight">uvicorn app.main:app</code> in the
          backend folder, then reload this page.
        </p>
      </div>
    );
  }

  if (!raw) {
    return <p className="text-dust">Loading candidates from the backend.</p>;
  }

  if (stars.length === 0) {
    return (
      <div className="panel max-w-xl rounded-3xl p-6">
        <h1 className="font-display text-2xl font-semibold">No stars yet</h1>
        <p className="mt-3 text-dust">
          Ingest some light curves, then run anomaly detection with{" "}
          <code className="text-starlight">POST /candidates/detect</code>. Your
          stars will appear here as planets.
        </p>
      </div>
    );
  }

  const flagged = stars.filter((c) => c.status === "anomalous").length;
  const ranked = stars.filter((c) => c.priority_score !== null).length;

  return (
    <div>
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {stars.length} stars scanned
        </h1>
        <p className="mt-3 text-dust">
          {flagged} flagged as unusual by the anomaly detector, {ranked} ranked
          by the agents so far. Inner rings mean higher priority, and bigger
          planets looked more unusual.
        </p>
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="mx-auto w-full max-w-[900px]">
          <Orrery
            stars={stars}
            hoverId={hoverId}
            selectedId={selectedId}
            onHover={setHoverId}
            onSelect={setSelectedId}
          />
        </div>

        <aside className="flex flex-col gap-4 lg:pt-10">
          <section className="panel rounded-3xl p-6" aria-live="polite">
            {active ? (
              <>
                <p className="text-sm text-dust">{active.mission} light curve</p>
                <h2 className="font-display mt-1 text-3xl font-semibold">
                  {active.target_id}
                </h2>
                <dl className="mt-5 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-dust">Anomaly score</dt>
                    <dd className="font-display text-2xl">
                      {active.anomaly_score.toFixed(2)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-dust">Priority score</dt>
                    <dd className="font-display text-2xl">
                      {active.priority_score !== null
                        ? active.priority_score.toFixed(2)
                        : "Not ranked"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-sm text-dust">
                  {investigationLine(active)}
                </p>
                <button
                  type="button"
                  onClick={() => router.push(`/candidates/${active.candidate_id}`)}
                  className="mt-5 w-full rounded-xl bg-ion/15 px-4 py-2.5 text-sm font-medium text-aurora transition-colors hover:bg-ion/25"
                >
                  Open candidate
                </button>
              </>
            ) : (
              <>
                <h2 className="font-display text-xl font-semibold">
                  Pick a planet
                </h2>
                <p className="mt-2 text-sm text-dust">
                  Hover or tap a star to see what the agents found, then open
                  it for the full investigation.
                </p>
              </>
            )}
          </section>

          <section className="panel rounded-3xl p-6">
            <h2 className="text-sm font-medium">Colour key</h2>
            <ul className="mt-3 space-y-2">
              {LEGEND.map(({ color, label }) => (
                <li key={label} className="flex items-center gap-3 text-sm text-dust">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: color, boxShadow: `0 0 10px ${color}` }}
                  />
                  {label}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}