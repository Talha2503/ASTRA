"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { api, API_URL } from "@/lib/api";
import {
  type Candidate,
  RING_LABELS,
  dedupeByStar,
  planetColor,
  ringIndex,
} from "@/lib/candidates";

type SortKey = "target" | "ring" | "priority" | "anomaly" | "investigations";
type Dir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "target", label: "Star", numeric: false },
  { key: "ring", label: "Priority ring", numeric: false },
  { key: "priority", label: "Priority score", numeric: true },
  { key: "anomaly", label: "Anomaly score", numeric: true },
  { key: "investigations", label: "Investigations", numeric: true },
];

function compare(a: Candidate, b: Candidate, key: SortKey): number {
  switch (key) {
    case "target":
      return (a.target_id ?? "").localeCompare(b.target_id ?? "", undefined, {
        numeric: true,
      });
    case "ring":
      return ringIndex(a) - ringIndex(b);
    case "priority":
      return (a.priority_score ?? -1) - (b.priority_score ?? -1);
    case "anomaly":
      return a.anomaly_score - b.anomaly_score;
    case "investigations":
      return a.n_investigations - b.n_investigations;
  }
}

export function Discoveries() {
  const router = useRouter();
  const [raw, setRaw] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [dir, setDir] = useState<Dir>("desc");
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  useEffect(() => {
    api<Candidate[]>("/candidates/")
      .then(setRaw)
      .catch((e: Error) => setError(e.message));
  }, []);

  const stars = useMemo(() => (raw ? dedupeByStar(raw) : []), [raw]);

  const rows = useMemo(() => {
    const list = flaggedOnly
      ? stars.filter((c) => c.status === "anomalous")
      : stars;
    const sign = dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const result = compare(a, b, sortKey) * sign;
      return result !== 0 ? result : b.anomaly_score - a.anomaly_score;
    });
  }, [stars, sortKey, dir, flaggedOnly]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDir(key === "target" || key === "ring" ? "asc" : "desc");
  }

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
    return <p className="text-dust">Loading stars from the backend.</p>;
  }

  return (
    <div>
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Discoveries
        </h1>
        <p className="mt-3 text-dust">
          Every star the anomaly detector has scanned, one row each. Click a
          column to sort, or open a star to see its investigation.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-dust" aria-live="polite">
          Showing {rows.length} of {stars.length} stars
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-starlight">
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(e) => setFlaggedOnly(e.target.checked)}
            className="h-4 w-4 accent-[#3FA9F5]"
          />
          Only stars flagged as unusual
        </label>
      </div>

      <div className="panel mt-4 overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="text-dust">
              {COLUMNS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      active
                        ? dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={`px-6 py-4 font-medium ${col.numeric ? "text-right" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`inline-flex items-center gap-1.5 rounded-md transition-colors hover:text-starlight ${active ? "text-starlight" : ""}`}
                    >
                      {col.label}
                      {active &&
                        (dir === "asc" ? (
                          <ArrowUp size={14} aria-hidden="true" />
                        ) : (
                          <ArrowDown size={14} aria-hidden="true" />
                        ))}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr className="border-t border-line">
                <td colSpan={COLUMNS.length} className="px-6 py-8 text-dust">
                  No stars match this filter. Untick the box to see all{" "}
                  {stars.length} stars.
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr
                key={c.candidate_id}
                onClick={() => router.push(`/candidates/${c.candidate_id}`)}
                className="cursor-pointer border-t border-line transition-colors hover:bg-white/[0.03]"
              >
                <td className="px-6 py-4">
                  <Link
                    href={`/candidates/${c.candidate_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-display text-base font-semibold text-starlight hover:text-aurora"
                  >
                    {c.target_id}
                  </Link>
                  <p className="mt-0.5 text-dust">
                    {c.mission}
                    {c.status === "anomalous"
                      ? " light curve, flagged as unusual"
                      : " light curve, normal"}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: planetColor(c),
                        boxShadow: `0 0 8px ${planetColor(c)}`,
                      }}
                    />
                    {RING_LABELS[ringIndex(c)]}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {c.priority_score !== null ? (
                    <span className="font-display text-base">
                      {c.priority_score.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-dust">Not ranked</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-3">
                    <div
                      className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round(c.anomaly_score * 100)}%`,
                          background: planetColor(c),
                        }}
                      />
                    </div>
                    <span className="w-10 text-right">
                      {c.anomaly_score.toFixed(2)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">{c.n_investigations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}