"use client";

import { AlertTriangle } from "lucide-react";
import MaterialCard from "./MaterialCard";
import type { Iteration } from "@/lib/api";

interface Props {
  iteration: Iteration;
  humanReviewNeeded?: boolean;
  loading?: boolean;
}

export default function MaterialPanel({ iteration, humanReviewNeeded, loading }: Props) {
  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Header ── */}
      <div className="flex items-baseline justify-between shrink-0">
        <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-ghost">
          Material Insights
        </h2>
        {iteration.total_co2e !== null && (
          <div className="text-right">
            <span className="font-mono text-xl font-light text-sage">
              {iteration.total_co2e.toFixed(3)}
            </span>
            <span className="text-xs text-ghost ml-1.5">kgCO₂e/kg</span>
          </div>
        )}
      </div>

      {/* ── Human review banner ── */}
      {humanReviewNeeded && (
        <div className="flex items-center gap-2 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 text-xs text-red-400 shrink-0">
          <AlertTriangle size={13} strokeWidth={1.5} />
          Materials flagged for review — low model confidence
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && iteration.materials.length === 0 && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-r-lg bg-panel animate-pulse border-l-2 border-l-wire"
            />
          ))}
        </div>
      )}

      {/* ── Material list ── */}
      {iteration.materials.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
          {iteration.materials.map((m, i) => (
            <MaterialCard key={`${m.name}-${i}`} material={m} />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && iteration.materials.length === 0 && (
        <p className="text-sm text-ghost text-center mt-8">
          No materials identified
        </p>
      )}
    </div>
  );
}
