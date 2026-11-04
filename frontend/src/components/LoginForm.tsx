"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_URL, LoginError, type LoginFailure, login } from "@/lib/api";
import { authStatus, serverAuthStatus, subscribeAuth } from "@/lib/auth";

const RINGS = [
  { r: 150, seconds: 70, phase: 0.1, color: "#5EE1E6", size: 9 },
  { r: 245, seconds: 110, phase: 0.45, color: "#F2A65A", size: 13 },
  { r: 345, seconds: 160, phase: 0.7, color: "#3FA9F5", size: 17 },
  { r: 450, seconds: 230, phase: 0.3, color: "#7E8DB0", size: 11 },
];

function problemText(reason: LoginFailure): string {
  switch (reason) {
    case "wrong_credentials":
      return "That email or password isn't right.";
    case "not_configured":
      return "Login isn't set up on the server yet. Check ADMIN_EMAIL, ADMIN_PASSWORD and AUTH_SECRET in the backend's .env file.";
    case "unreachable":
      return `Can't reach the backend at ${API_URL}. Start it with uvicorn, then try again.`;
    case "storage":
      return "Your browser is blocking local storage, so the login can't be remembered. Allow storage for this site and try again.";
    default:
      return "Something went wrong. Try again.";
  }
}

function Mark() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="5" fill="#3FA9F5" />
      <ellipse
        cx="16"
        cy="16"
        rx="14"
        ry="6"
        transform="rotate(-24 16 16)"
        stroke="#5EE1E6"
        strokeOpacity="0.7"
        strokeWidth="1.2"
      />
      <circle cx="28.8" cy="10.3" r="1.8" fill="#F2A65A" />
    </svg>
  );
}

function OrbitArt() {
  return (
    <svg viewBox="0 0 1000 1000" className="h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id="login-core">
          <stop offset="0" stopColor="#E6EEFF" />
          <stop offset="0.4" stopColor="#5EE1E6" />
          <stop offset="1" stopColor="#3FA9F5" stopOpacity="0" />
        </radialGradient>
        <filter id="login-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx={500} cy={500} r={170} fill="url(#login-core)" opacity={0.3} />
      <circle cx={500} cy={500} r={50} fill="url(#login-core)" />

      {RINGS.map((ring) => (
        <g key={ring.r}>
          <circle
            cx={500}
            cy={500}
            r={ring.r}
            fill="none"
            stroke="rgba(110,150,230,0.22)"
            strokeWidth={1.4}
          />
          <g
            style={{
              transformOrigin: "500px 500px",
              animation: `login-orbit ${ring.seconds}s linear infinite`,
              animationDelay: `-${ring.seconds * ring.phase}s`,
            }}
          >
            <circle
              cx={500}
              cy={500 - ring.r}
              r={ring.size}
              fill={ring.color}
              filter="url(#login-glow)"
            />
          </g>
        </g>
      ))}
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const expired = useSearchParams().get("expired") === "1";
  const status = useSyncExternalStore(subscribeAuth, authStatus, serverAuthStatus);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<LoginFailure | null>(null);

  // Already signed in: skip the form.
  useEffect(() => {
    if (status === "yes") router.replace("/");
  }, [status, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      await login(email, password);
      router.replace("/");
    } catch (err) {
      setProblem(err instanceof LoginError ? err.reason : "unknown");
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <style>{"@keyframes login-orbit{to{transform:rotate(360deg)}}"}</style>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 -right-[18%] h-[min(120vh,1000px)] w-[min(120vh,1000px)] -translate-y-1/2 opacity-40 lg:opacity-100"
      >
        <OrbitArt />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3">
            <Mark />
            <span className="font-display text-lg font-semibold tracking-wide">
              ASTRA
            </span>
          </div>

          <h1 className="font-display mt-8 text-4xl leading-tight font-semibold tracking-tight">
            Find the stars worth a second look.
          </h1>
          <p className="mt-4 text-dust">
            A team of AI agents investigates unusual stars in NASA light curve
            data and ranks what deserves a closer look. Sign in to see what
            they found.
          </p>

          <form
            onSubmit={onSubmit}
            className="panel glow-ion mt-8 rounded-3xl p-6"
          >
            {expired && !problem && (
              <p
                role="status"
                className="mb-4 rounded-xl bg-white/5 px-4 py-3 text-sm text-starlight"
              >
                Your session ended. Sign in again to continue.
              </p>
            )}

            <label htmlFor="email" className="block text-sm text-dust">
              Email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-line bg-void/60 px-4 py-3 text-starlight placeholder:text-dust focus:border-ion"
            />

            <label htmlFor="password" className="mt-4 block text-sm text-dust">
              Password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-line bg-void/60 px-4 py-3 text-starlight placeholder:text-dust focus:border-ion"
            />

            {problem && (
              <p role="alert" className="mt-4 text-sm text-ember">
                {problemText(problem)}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-6 w-full rounded-xl bg-ion px-4 py-3 text-sm font-semibold text-void transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Signing in" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}