"use client";

import type { GroundedMaterial } from "@/lib/api";

interface IconProps {
  confidence: number;
}

function ConfidenceIcon({ confidence }: IconProps) {
  const symbol = confidence >= 0.6 ? "✓" : confidence >= 0.4 ? "?" : "!";
  const label = `Model is ${Math.round(confidence * 100)}% confident`;

  return (
    <div className="group/tooltip relative shrink-0">
      <span className="w-5 h-5 rounded-full bg-panel2 text-ink text-[11px] font-mono flex items-center justify-center select-none">
        {symbol}
      </span>
      {/* Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-panel2 border border-wire text-ink text-[11px] font-mono rounded whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150 z-50">
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-wire" />
      </div>
    </div>
  );
}

interface Props {
  material: GroundedMaterial;
  onClick: () => void;
}

export default function MaterialTile({ material, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 bg-panel hover:bg-panel2 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer w-40 border"
      style={{ borderColor: "rgba(107,143,113,0.5)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-xs font-medium text-ink leading-snug line-clamp-2 flex-1">
          {material.name}
        </p>
        <ConfidenceIcon confidence={material.confidence} />
      </div>

      <p className="text-[11px] font-mono text-ghost truncate">
        {material.co2e_value !== null
          ? `${material.co2e_value.toFixed(3)} ${material.co2e_unit ?? "kgCO₂e/kg"}`
          : "No data"}
      </p>
    </button>
  );
}
