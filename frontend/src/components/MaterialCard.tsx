"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import ConfidenceBadge from "./ConfidenceBadge";
import type { GroundedMaterial } from "@/lib/api";

const BORDER: Record<string, string> = {
  green:  "border-l-green-400",
  yellow: "border-l-yellow-400",
  red:    "border-l-red-400",
};

interface Props {
  material: GroundedMaterial;
}

export default function MaterialCard({ material }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border-l-2 ${BORDER[material.flag]} bg-panel rounded-r-lg pl-4 pr-3 py-3 cursor-pointer hover:bg-panel2 transition-colors`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* ── Main row ── */}
      <div className="flex items-start justify-between gap-3">
        {/* Left: name + db match */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{material.name}</p>
          {material.database_match && (
            <p className="text-xs text-ghost mt-0.5 truncate font-mono">
              {material.database_match}
            </p>
          )}
        </div>

        {/* Right: CO₂e + confidence + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {material.co2e_value !== null ? (
            <div className="text-right">
              <span className="font-mono text-sm font-semibold text-sage">
                {material.co2e_value.toFixed(3)}
              </span>
              <span className="text-xs text-ghost ml-1">
                {material.co2e_unit ?? "kgCO₂e/kg"}
              </span>
            </div>
          ) : (
            <span className="font-mono text-xs text-ghost italic">No data</span>
          )}

          <ConfidenceBadge flag={material.flag} confidence={material.confidence} />

          <span className="text-ghost">
            {expanded
              ? <ChevronUp size={13} strokeWidth={1.5} />
              : <ChevronDown size={13} strokeWidth={1.5} />}
          </span>
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-wire space-y-1.5 text-xs text-ghost">
          <p className="text-ink/80 leading-relaxed">{material.description}</p>
          {material.database_match && (
            <p>
              <span className="text-ghost">Source: </span>
              <span className="font-mono">ICE Database V4.1</span>
            </p>
          )}
          {material.requires_human_review && (
            <p className="text-red-400">⚠ Flagged for human review (low model confidence)</p>
          )}
        </div>
      )}
    </div>
  );
}
