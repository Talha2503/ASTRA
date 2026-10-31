"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type Load<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

type Stored<T> = {
  path: string;
  result: { status: "ready"; data: T } | { status: "error"; message: string };
};

// Pass null to skip the request (status stays "idle").
export function useApi<T>(path: string | null): Load<T> {
  const [stored, setStored] = useState<Stored<T> | null>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api<T>(path)
      .then((data) => {
        if (!cancelled) setStored({ path, result: { status: "ready", data } });
      })
      .catch((e: Error) => {
        if (!cancelled)
          setStored({ path, result: { status: "error", message: e.message } });
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!path) return { status: "idle" };
  if (!stored || stored.path !== path) return { status: "loading" };
  return stored.result;
}