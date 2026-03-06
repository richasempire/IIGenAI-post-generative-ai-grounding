"use client";

import { X } from "lucide-react";
import { getImageSrc } from "@/lib/api";
import type { Iteration } from "@/lib/api";

interface Props {
  open: boolean;
  iterations: Iteration[];
  /** image_url of the active iteration — globally unique across sessions */
  activeImageUrl: string;
  onClose: () => void;
  onSelect: (iter: Iteration) => void;
}

export default function HistoryPanel({
  open,
  iterations,
  activeImageUrl,
  onClose,
  onSelect,
}: Props) {
  return (
    <div
      className={`absolute inset-y-0 right-0 w-1/5 min-w-[260px] bg-panel border-l border-wire flex flex-col z-50 transform transition-transform duration-300 ease-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-wire shrink-0">
        <h2 className="text-[10px] font-mono text-ghost/70 uppercase tracking-[0.2em]">
          History
        </h2>
        <button
          onClick={onClose}
          className="text-ghost hover:text-ink transition-colors cursor-pointer"
        >
          <X size={15} strokeWidth={1.5} />
        </button>
      </div>

      {/* Iteration list — newest first */}
      <div className="flex-1 overflow-y-auto">
        {iterations.length === 0 ? (
          <p className="text-xs text-ghost text-center mt-10 font-mono">
            No history yet
          </p>
        ) : (
          [...iterations].reverse().map((iter) => {
            const isActive = iter.image_url === activeImageUrl;
            return (
              <button
                key={iter.image_url || `${iter.iteration_number}`}
                type="button"
                onClick={() => onSelect(iter)}
                className={`w-full flex gap-3 px-4 py-3.5 border-b border-wire text-left transition-colors cursor-pointer ${
                  isActive ? "bg-panel2" : "hover:bg-panel2"
                }`}
              >
                {/* Thumbnail */}
                <div className="shrink-0 w-14 h-14 rounded overflow-hidden bg-panel2">
                  {iter.image_url ? (
                    <img
                      src={getImageSrc(iter.image_url)}
                      alt={`Iteration ${iter.iteration_number}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-ghost text-xs font-mono">
                      —
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono text-ghost mb-1">
                    #{iter.iteration_number}
                  </p>
                  <p className="text-xs text-ink leading-snug line-clamp-2">
                    {iter.prompt}
                  </p>

                  {/* Mini material chips */}
                  {iter.materials.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {iter.materials.slice(0, 3).map((m, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-mono text-ghost bg-panel2 border border-wire px-1.5 py-0.5 rounded"
                        >
                          {m.name}
                        </span>
                      ))}
                      {iter.materials.length > 3 && (
                        <span className="text-[10px] font-mono text-ghost/50">
                          +{iter.materials.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
