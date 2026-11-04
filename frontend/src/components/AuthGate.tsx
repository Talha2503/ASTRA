"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { authStatus, serverAuthStatus, subscribeAuth } from "@/lib/auth";

// Shows the dashboard only when a token is stored; otherwise sends you to the login page.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const status = useSyncExternalStore(subscribeAuth, authStatus, serverAuthStatus);

  useEffect(() => {
    if (status === "no") router.replace("/login");
  }, [status, router]);

  if (status !== "yes") {
    return <p className="p-8 text-dust">Checking your session.</p>;
  }

  return <>{children}</>;
}