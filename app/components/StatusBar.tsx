"use client";

import { useEffect, useState } from "react";
import LayersControl, { type LayerVisibility } from "./LayersControl";

interface StatusBarProps {
  trainCount: number;
  fetchedAt: number | null;
  status: "loading" | "connected" | "error";
  layers: LayerVisibility;
  onToggleLayer: (key: keyof LayerVisibility) => void;
}

const POLL_INTERVAL_S = 30;

const TRAIN_LINES = [
  { name: "Alamein", color: "#152C6B" },
  { name: "Belgrave", color: "#152C6B" },
  { name: "City Circle", color: "#0072CE" },
  { name: "Craigieburn", color: "#FFBE00" },
  { name: "Cranbourne", color: "#34ACE1" },
  { name: "Flemington Racecourse", color: "#95979A" },
  { name: "Frankston", color: "#028430" },
  { name: "Glen Waverley", color: "#152C6B" },
  { name: "Hurstbridge", color: "#BE1014" },
  { name: "Lilydale", color: "#152C6B" },
  { name: "Mernda", color: "#BE1014" },
  { name: "Pakenham", color: "#34ACE1" },
  { name: "Sandringham", color: "#F178AF" },
  { name: "Stony Point", color: "#028430" },
  { name: "Sunbury", color: "#34ACE1" },
  { name: "Upfield", color: "#FFBE00" },
  { name: "Werribee", color: "#F178AF" },
  { name: "Williamstown", color: "#F178AF" },
];

function nextUpdateIn(fetchedAt: number): string {
  const elapsed = Math.round((Date.now() - fetchedAt) / 1000);
  const remaining = Math.max(0, POLL_INTERVAL_S - elapsed);
  if (remaining === 0) return "updating...";
  return `${remaining}s`;
}

export default function StatusBar({
  trainCount,
  fetchedAt,
  status,
  layers,
  onToggleLayer,
}: StatusBarProps) {
  const [, setTick] = useState(0);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const statusColor =
    status === "connected"
      ? "bg-emerald-400"
      : status === "error"
        ? "bg-red-400"
        : "bg-yellow-400";

  const statusText =
    status === "connected"
      ? "Live"
      : status === "error"
        ? "Disconnected"
        : "Connecting...";

  return (
    <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
      {/* Legend popup */}
      {showKey && (
        <div className="bg-zinc-900/90 backdrop-blur-md rounded-xl border border-zinc-700/50 shadow-lg p-3 w-56">
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
            Train Lines
          </h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {TRAIN_LINES.map((line) => (
              <div key={line.name} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-[3px] rounded-full shrink-0"
                  style={{ backgroundColor: line.color }}
                />
                <span className="text-xs text-zinc-300 truncate">
                  {line.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-zinc-900/80 backdrop-blur-md rounded-xl border border-zinc-700/50 text-sm text-zinc-200 shadow-lg">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
          <span>{statusText}</span>
        </div>

        <div className="w-px h-4 bg-zinc-700" />

        <div className="flex items-center gap-1.5">
          <svg
            className="w-4 h-4 text-cyan-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"
            />
          </svg>
          <span className="font-medium">{trainCount}</span>
          <span className="text-zinc-400 hidden sm:inline">trains</span>
        </div>

        {fetchedAt && (
          <>
            <div className="w-px h-4 bg-zinc-700" />
            <span className="text-zinc-400">Next update in {nextUpdateIn(fetchedAt)}</span>
          </>
        )}

        <div className="w-px h-4 bg-zinc-700" />

        <LayersControl layers={layers} onToggle={onToggleLayer} />

        <div className="w-px h-4 bg-zinc-700" />

        <button
          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
          onMouseEnter={() => setShowKey(true)}
          onMouseLeave={() => setShowKey(false)}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 6h11M9 12h11M9 18h11M5 6h.01M5 12h.01M5 18h.01"
            />
          </svg>
          <span className="hidden sm:inline text-sm">Key</span>
        </button>
      </div>
    </div>
  );
}
