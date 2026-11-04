"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LogOut, Orbit, Telescope } from "lucide-react";
import { api } from "@/lib/api";
import { clearToken } from "@/lib/auth";

const NAV = [
  { href: "/", label: "Overview", icon: Orbit, also: [] as string[] },
  {
    href: "/discoveries",
    label: "Discoveries",
    icon: Telescope,
    also: ["/candidates", "/investigations"],
  },
];

function isActive(
  href: string,
  also: string[],
  pathname: string | null,
): boolean {
  if (pathname === null) return false;
  if (href === "/") return pathname === "/";
  return [href, ...also].some((p) => pathname.startsWith(p));
}

function Mark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
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

function useBackendStatus() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        await api("/health");
        if (!cancelled) setOnline(true);
      } catch {
        if (!cancelled) setOnline(false);
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return online;
}

function NavItems({ pathname }: { pathname: string | null }) {
  return (
    <>
      {NAV.map(({ href, label, icon: Icon, also }) => {
        const active = isActive(href, also, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            title={label}
            aria-current={active ? "page" : undefined}
            className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
              active
                ? "bg-ion/15 text-aurora glow-ion"
                : "text-dust hover:bg-white/5 hover:text-starlight"
            }`}
          >
            <Icon size={20} strokeWidth={1.75} />
          </Link>
        );
      })}
    </>
  );
}

// The only piece that reads the URL, so it is the only piece inside Suspense.
function ActiveNav() {
  const pathname = usePathname();
  return <NavItems pathname={pathname} />;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const online = useBackendStatus();

  function signOut() {
    clearToken();
    router.replace("/login");
  }

  const statusText =
    online === null
      ? "Checking backend"
      : online
        ? "Backend online"
        : "Backend offline";
  const dotColor =
    online === null ? "bg-dust" : online ? "bg-aurora" : "bg-ember";

  return (
    <div className="min-h-screen">
      <nav
        aria-label="Main"
        className="panel fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t md:top-0 md:right-auto md:h-auto md:w-[72px] md:flex-col md:justify-start md:gap-2 md:border-t-0 md:border-r md:py-5"
      >
        <Link
          href="/"
          aria-label="ASTRA home"
          className="mb-4 hidden h-11 w-11 items-center justify-center md:flex"
        >
          <Mark />
        </Link>

        <Suspense fallback={<NavItems pathname={null} />}>
          <ActiveNav />
        </Suspense>
      </nav>

      <div className="pb-20 md:pb-0 md:pl-[72px]">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-void/70 px-6 backdrop-blur-md">
          <span className="font-display text-sm font-semibold tracking-wide">
            ASTRA
          </span>
          <div className="flex items-center gap-4">
            <span
              className="flex items-center gap-2 text-sm text-dust"
              role="status"
            >
              <span className={`h-2 w-2 rounded-full ${dotColor}`} />
              {statusText}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-dust transition-colors hover:bg-white/5 hover:text-starlight"
            >
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}