"use client";

import { useMemo } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import {
  type Candidate,
  RING_LABELS,
  dedupeByStar,
  planetColor,
  ringIndex,
} from "@/lib/candidates";

export function ReportsView() {
  const candidates = useApi<Candidate[]>("/candidates/");
  const raw = candidates.status === "ready" ? candidates.data : null;

  const rows = useMemo(
    () =>
      raw
        ? dedupeByStar(raw)
            .filter((c) => c.n_investigations > 0)
            .sort(
              (a, b) =>
                (b.priority_score ?? -1) - (a.priority_score ?? -1) ||
                b.anomaly_score - a.anomaly_score,
            )
        : [],
    [raw],
  );

  if (candidates.status === "error") {
    return (
      <div className="panel max-w-xl rounded-3xl p-6">
        <h1 className="font-display text-2xl font-semibold">
          Can&apos;t reach the backend
        </h1>
        <p className="mt-3 text-dust">
          The dashboard tried {API_URL} and got: {candidates.message}. Start the
          backend and reload this page.
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
          Reports
        </h1>
        <p className="mt-3 text-dust">
          One written report for every star the agents have investigated. Open
          one to read it, print it, or save it as a PDF.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="panel mt-6 max-w-xl rounded-3xl p-6">
          <h2 className="font-display text-xl font-semibold">
            No reports yet
          </h2>
          <p className="mt-2 text-sm text-dust">
            A report appears here once a star has been investigated. Open a star
            from Discoveries and run an investigation.
          </p>
        </div>
      ) : (
        <div className="panel mt-6 overflow-x-auto rounded-3xl">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-dust">
                <th scope="col" className="px-6 py-4 font-medium">
                  Star
                </th>
                <th scope="col" className="px-6 py-4 font-medium">
                  Priority ring
                </th>
                <th scope="col" className="px-6 py-4 text-right font-medium">
                  Priority score
                </th>
                <th scope="col" className="px-6 py-4 text-right font-medium">
                  Investigations
                </th>
                <th scope="col" className="px-6 py-4 text-right font-medium">
                  <span className="sr-only">Report</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.candidate_id} className="border-t border-line">
                  <td className="px-6 py-4">
                    <p className="font-display text-base font-semibold text-starlight">
                      {c.target_id}
                    </p>
                    <p className="mt-0.5 text-dust">{c.mission} light curve</p>
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
                  <td className="px-6 py-4 text-right">{c.n_investigations}</td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/reports/${c.candidate_id}`}
                      className="text-aurora hover:underline"
                    >
                      Open report
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}