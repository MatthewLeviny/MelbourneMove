"use client";

import { useState } from "react";

export interface LayerVisibility {
  trains: boolean;
  vline: boolean;
  trams: boolean;
}

interface LayersControlProps {
  layers: LayerVisibility;
  onToggle: (key: keyof LayerVisibility) => void;
}

export default function LayersControl({ layers, onToggle }: LayersControlProps) {
  const [open, setOpen] = useState(false);

  const items: { key: keyof LayerVisibility; label: string }[] = [
    { key: "trains", label: "Metro Trains" },
    { key: "vline", label: "V/Line" },
    { key: "trams", label: "Trams" },
  ];

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {open && (
        <div className="absolute bottom-full right-0 pb-2" >
        <div className="bg-zinc-900/90 backdrop-blur-md rounded-xl border border-zinc-700/50 shadow-lg p-3 w-48">
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
            Layers
          </h3>
          <div className="space-y-1.5">
            {items.map((item) => (
              <button
                key={item.key}
                onClick={() => onToggle(item.key)}
                className="flex items-center gap-2.5 w-full px-1.5 py-1 rounded-md hover:bg-zinc-800/60 transition-colors cursor-pointer"
              >
                <span
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    layers[item.key]
                      ? "bg-cyan-500 border-cyan-500"
                      : "border-zinc-600 bg-transparent"
                  }`}
                >
                  {layers[item.key] && (
                    <svg
                      className="w-3 h-3 text-zinc-950"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </span>
                <span className="text-sm text-zinc-200">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
        </div>
      )}

      <button
        className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
        onClick={() => setOpen((o) => !o)}
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
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
        <span className="hidden sm:inline text-sm">Layers</span>
      </button>
    </div>
  );
}
