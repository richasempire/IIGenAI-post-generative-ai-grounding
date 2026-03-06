"use client";

import { X } from "lucide-react";
import type { GroundedMaterial } from "@/lib/api";

interface Props {
  material: GroundedMaterial | null;
  onClose: () => void;
}

export default function MaterialDrawer({ material, onClose }: Props) {
  const open = material !== null;
  // passes = how many of the 5 vision passes identified this material
  const passes = material ? Math.round(material.confidence * 5) : 0;

  return (
    <div
      className={`absolute inset-y-0 right-0 w-1/5 min-w-[260px] bg-panel border-l border-wire flex flex-col z-50 transform transition-transform duration-300 ease-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {material && (
        <>
          {/* Header */}
          <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-wire shrink-0">
            <h2 className="text-base font-semibold text-ink leading-tight pr-2">
              {material.name}
            </h2>
            <button
              onClick={onClose}
              className="text-ghost hover:text-ink transition-colors shrink-0 cursor-pointer mt-0.5"
            >
              <X size={15} strokeWidth={1.5} />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

            {/* Description */}
            <p className="text-sm text-ghost leading-relaxed">
              {material.description}
            </p>

            {/* Identification Confidence */}
            <div>
              <p className="text-[10px] font-mono text-ghost/60 uppercase tracking-[0.15em] mb-2.5">
                Identification Confidence
              </p>
              {/* 5-segment fill bar */}
              <div className="flex gap-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i < passes ? "bg-sage" : "bg-wire"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-ghost font-mono">
                Identified in {passes} of 5 passes
              </p>
            </div>

            {/* CO₂e data */}
            <div>
              <p className="text-[10px] font-mono text-ghost/60 uppercase tracking-[0.15em] mb-2.5">
                Embodied Carbon
              </p>
              {material.co2e_value !== null ? (
                <>
                  <p className="font-mono text-2xl font-light text-ink tracking-tight">
                    {material.co2e_value.toFixed(4)}
                  </p>
                  <p className="text-xs text-ghost font-mono mt-0.5">
                    {material.co2e_unit ?? "kgCO₂e/kg"}
                  </p>

                  {material.database_match && (
                    <div className="mt-4 pt-4 border-t border-wire">
                      <p className="text-[10px] font-mono text-ghost/60 uppercase tracking-[0.15em] mb-1.5">
                        Database Match
                      </p>
                      <p className="text-xs text-ink leading-snug">
                        {material.database_match}
                      </p>
                      <p className="text-[11px] text-ghost/60 font-mono mt-1">
                        ICE Database V4.1
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-ghost italic">
                  No match found in database
                </p>
              )}
            </div>

            {/* Human review flag */}
            {material.requires_human_review && (
              <div className="pt-4 border-t border-wire">
                <p className="text-[11px] text-ghost/70 font-mono">
                  ⚑ Flagged for review — low model confidence
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
