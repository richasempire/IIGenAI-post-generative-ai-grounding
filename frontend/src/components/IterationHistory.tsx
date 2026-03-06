"use client";

import { getImageSrc } from "@/lib/api";
import type { Iteration } from "@/lib/api";

interface Props {
  iterations: Iteration[];
  activeNumber: number;
  onSelect: (iteration: Iteration) => void;
}

export default function IterationHistory({ iterations, activeNumber, onSelect }: Props) {
  // Only show strip when there are multiple iterations
  if (iterations.length <= 1) return null;

  return (
    <div>
      <p className="text-xs font-mono text-ghost tracking-[0.15em] uppercase mb-3">
        Iterations
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {iterations.map((iter) => (
          <button
            key={iter.iteration_number}
            type="button"
            onClick={() => onSelect(iter)}
            className={`relative shrink-0 rounded-lg overflow-hidden transition-all cursor-pointer group ${
              iter.iteration_number === activeNumber
                ? "ring-2 ring-sage ring-offset-2 ring-offset-canvas"
                : "ring-1 ring-wire hover:ring-ghost"
            }`}
          >
            {/* Thumbnail */}
            <div className="w-20 h-20">
              {iter.image_url ? (
                <img
                  src={getImageSrc(iter.image_url)}
                  alt={`Iteration ${iter.iteration_number}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-panel2 flex items-center justify-center text-ghost text-xs font-mono">
                  —
                </div>
              )}
            </div>

            {/* Hover overlay: show prompt */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
              <p className="text-white text-[10px] leading-tight line-clamp-3 text-left">
                {iter.prompt}
              </p>
            </div>

            {/* Iteration number badge */}
            <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-mono rounded px-1 py-0.5 leading-none">
              {iter.iteration_number}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
