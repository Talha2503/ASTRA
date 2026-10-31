"use client";

import { useEffect, useMemo, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import {
  type Candidate,
  RING_LABELS,
  planetColor,
  ringIndex,
} from "@/lib/candidates";

const RINGS = [120, 195, 270, 345, 430];
const TWIST = [50, -40, 30, -30, 0];

const clamp = (v: number) => Math.min(1, Math.max(0, v));

type Placed = {
  c: Candidate;
  ring: number;
  theta: number;
  x: number;
  y: number;
  r: number;
};

function layout(stars: Candidate[]): Placed[] {
  const byRing: Candidate[][] = RINGS.map(() => []);
  for (const c of stars) byRing[ringIndex(c)].push(c);

  const placed: Placed[] = [];
  byRing.forEach((list, ring) => {
    list.sort((a, b) => b.anomaly_score - a.anomaly_score);
    const n = list.length;
    const step = 360 / n;
    list.forEach((c, k) => {
      // Half-step offset keeps planets clear of the ring label at the top.
      const theta = (k + 0.5) * step + (n <= 2 ? TWIST[ring] : 0);
      const rad = (theta * Math.PI) / 180;
      placed.push({
        c,
        ring,
        theta,
        x: RINGS[ring] * Math.sin(rad),
        y: -RINGS[ring] * Math.cos(rad),
        r: 10 + 16 * c.anomaly_score,
      });
    });
  });
  return placed;
}

type Props = {
  stars: Candidate[];
  hoverId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
};

export function Orrery({ stars, hoverId, selectedId, onHover, onSelect }: Props) {
  const reduce = useReducedMotion();
  const [p, setP] = useState(0);

  // The one orchestrated moment: rings appear, then planets sweep into place.
  useEffect(() => {
    const controls = animate(0, 1, {
      duration: reduce ? 0.001 : 2.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: setP,
    });
    return () => controls.stop();
  }, [reduce]);

  const placed = useMemo(() => layout(stars), [stars]);
  const activeId = hoverId ?? selectedId;

  return (
    <svg
      viewBox="-600 -540 1200 1080"
      className="h-auto w-full"
      role="group"
      aria-label="Orbit chart of stars, grouped by priority ring"
    >
      <defs>
        <radialGradient id="core-gradient">
          <stop offset="0" stopColor="#E6EEFF" />
          <stop offset="0.4" stopColor="#5EE1E6" />
          <stop offset="1" stopColor="#3FA9F5" stopOpacity="0" />
        </radialGradient>
        <filter id="planet-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {RINGS.map((radius, i) => (
        <g key={radius} opacity={clamp(p * 2.2 - i * 0.25)}>
          <circle
            r={radius}
            fill="none"
            stroke="rgba(110,150,230,0.22)"
            strokeWidth={1.2}
            strokeDasharray={i === RINGS.length - 1 ? "3 8" : undefined}
          />
          <text
            y={-radius - 9}
            textAnchor="middle"
            fill="#7E8DB0"
            fontSize={17}
          >
            {RING_LABELS[i]}
          </text>
        </g>
      ))}

      <g opacity={clamp(p * 4)} aria-hidden="true">
        <circle r={96} fill="url(#core-gradient)" opacity={0.28} />
        <circle r={34} fill="url(#core-gradient)" />
      </g>

      {RINGS.map((_, ring) => (
        <g
          key={ring}
          transform={`rotate(${-(1 - p) * (70 + ring * 30)})`}
          opacity={clamp(p * 3 - 0.5)}
        >
          {placed
            .filter((pl) => pl.ring === ring)
            .map(({ c, theta, x, y, r }) => {
              const id = c.candidate_id;
              const isActive = activeId === id;
              const isSelected = selectedId === id;
              const dimmed = activeId !== null && !isActive;

              const rad = (theta * Math.PI) / 180;
              const s = Math.sin(rad);
              const co = Math.cos(rad);
              const dx = (r + 16) * s;
              const dy = -(r + 16) * co;
              const anchor = s > 0.3 ? "start" : s < -0.3 ? "end" : "middle";

              return (
                <g
                  key={id}
                  transform={`translate(${x} ${y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${c.target_id}, ${RING_LABELS[ring]}, anomaly score ${c.anomaly_score.toFixed(2)}`}
                  className="cursor-pointer outline-none"
                  style={{ opacity: dimmed ? 0.4 : 1, transition: "opacity .2s" }}
                  onMouseEnter={() => onHover(id)}
                  onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover(id)}
                  onBlur={() => onHover(null)}
                  onClick={() => onSelect(id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(id);
                    }
                  }}
                >
                  <circle r={r + 14} fill="transparent" />
                  {(isActive || isSelected) && (
                    <circle
                      r={r + 9}
                      fill="none"
                      stroke="#5EE1E6"
                      strokeWidth={1.5}
                      opacity={isSelected ? 1 : 0.5}
                    />
                  )}
                  <g
                    style={{
                      transform: `scale(${isActive ? 1.2 : 1})`,
                      transition: "transform .2s",
                      transformBox: "fill-box",
                      transformOrigin: "center",
                    }}
                  >
                    <circle r={r} fill={planetColor(c)} filter="url(#planet-glow)" />
                  </g>
                  <text
                    x={dx}
                    y={dy}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                    fontSize={17}
                    fill={isActive ? "#E6EEFF" : "#7E8DB0"}
                    stroke="#050A18"
                    strokeWidth={4}
                    paintOrder="stroke"
                    style={{ transition: "fill .2s" }}
                  >
                    {c.target_id}
                  </text>
                </g>
              );
            })}
        </g>
      ))}
    </svg>
  );
}