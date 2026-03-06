"use client";

import { X } from "lucide-react";
import type { GroundedMaterial } from "@/lib/api";

// ── Dummy data generator ──────────────────────────────────────────────────────
// All values are plausible estimates based on the material name.
// They do NOT come from the backend — each section is a future integration point.

const ACCENT = "#6b8f71";

interface Supplier { name: string; price: string }
interface MaterialData {
  cost: string;
  nrc: number;
  acousticDesc: string;
  rValue: number;
  thermalDesc: string;
  lifespan: string;
  maintenance: string;
  suppliers: Supplier[];
  fireRating: string;
}

function getMaterialData(name: string): MaterialData {
  const n = name.toLowerCase();

  // ── Cost ───────────────────────────────────────────────────────────────────
  let cost: string;
  if      (n.includes("terrazzo"))                                               cost = "$180 - $350 per m²";
  else if (n.includes("marble") || n.includes("granite") || n.includes("stone")) cost = "$200 - $400 per m²";
  else if (n.includes("hardwood") || n.includes("oak") || n.includes("timber") || n.includes("wood")) cost = "$140 - $220 per m²";
  else if (n.includes("glass"))                                                  cost = "$120 - $250 per m²";
  else if (n.includes("steel") || n.includes("metal") || n.includes("alumin"))   cost = "$95 - $160 per m²";
  else if (n.includes("brick") || n.includes("masonry"))                         cost = "$75 - $130 per m²";
  else if (n.includes("tile") || n.includes("ceramic") || n.includes("porcelain")) cost = "$60 - $120 per m²";
  else if (n.includes("carpet") || n.includes("fabric") || n.includes("textile")) cost = "$40 - $90 per m²";
  else if (n.includes("plaster") || n.includes("gypsum"))                       cost = "$50 - $90 per m²";
  else if (n.includes("concrete"))                                               cost = "$85 - $120 per m²";
  else                                                                            cost = "$80 - $150 per m²";

  // ── Acoustic ───────────────────────────────────────────────────────────────
  let nrc: number;
  let acousticDesc: string;
  if (n.includes("carpet") || n.includes("fabric") || n.includes("textile") ||
      n.includes("acoustic") || n.includes("cork") || n.includes("felt")) {
    nrc = 0.65; acousticDesc = "Highly absorptive";
  } else if (n.includes("wood") || n.includes("oak") || n.includes("timber") ||
             n.includes("plaster") || n.includes("gypsum") || n.includes("brick")) {
    nrc = 0.15; acousticDesc = "Moderately reflective";
  } else {
    nrc = 0.04; acousticDesc = "Highly reflective";
  }

  // ── Thermal ────────────────────────────────────────────────────────────────
  let rValue: number;
  let thermalDesc: string;
  if (n.includes("carpet") || n.includes("fabric") || n.includes("cork")) {
    rValue = 2.50; thermalDesc = "Good insulation";
  } else if (n.includes("wood") || n.includes("oak") || n.includes("timber") || n.includes("hardwood")) {
    rValue = 1.25; thermalDesc = "Moderate insulation";
  } else if (n.includes("plaster") || n.includes("gypsum")) {
    rValue = 0.56; thermalDesc = "Moderate insulation";
  } else if (n.includes("brick")) {
    rValue = 0.20; thermalDesc = "Low insulation";
  } else if (n.includes("glass")) {
    rValue = 0.14; thermalDesc = "Low insulation";
  } else if (n.includes("steel") || n.includes("metal") || n.includes("alumin")) {
    rValue = 0.003; thermalDesc = "Low insulation";
  } else {
    rValue = 0.08; thermalDesc = "Low insulation";
  }

  // ── Durability ─────────────────────────────────────────────────────────────
  let lifespan: string;
  let maintenance: string;
  if (n.includes("concrete") || n.includes("stone") || n.includes("marble") ||
      n.includes("granite") || n.includes("brick") || n.includes("terrazzo") ||
      n.includes("masonry")) {
    lifespan = "50-100+ years"; maintenance = "Low";
  } else if (n.includes("steel") || n.includes("metal") || n.includes("alumin")) {
    lifespan = "40-80 years"; maintenance = "Low";
  } else if (n.includes("wood") || n.includes("oak") || n.includes("timber") ||
             n.includes("hardwood")) {
    lifespan = "30-60 years"; maintenance = "Moderate";
  } else if (n.includes("glass")) {
    lifespan = "20-40 years"; maintenance = "Low";
  } else if (n.includes("tile") || n.includes("ceramic") || n.includes("porcelain")) {
    lifespan = "30-50 years"; maintenance = "Low";
  } else if (n.includes("carpet") || n.includes("fabric") || n.includes("textile")) {
    lifespan = "5-15 years"; maintenance = "High";
  } else {
    lifespan = "25-50 years"; maintenance = "Moderate";
  }

  // ── Suppliers ──────────────────────────────────────────────────────────────
  let suppliers: Supplier[];
  if (n.includes("concrete")) {
    suppliers = [
      { name: "LafargeHolcim · Zurich",        price: "$92/m²"  },
      { name: "CEMEX · Monterrey",              price: "$88/m²"  },
      { name: "HeidelbergCement · Heidelberg",  price: "$96/m²"  },
    ];
  } else if (n.includes("wood") || n.includes("oak") || n.includes("timber") ||
             n.includes("hardwood")) {
    suppliers = [
      { name: "Kebony · Oslo",                  price: "$165/m²" },
      { name: "Accoya · Arnhem",                price: "$178/m²" },
      { name: "Timber Holdings · Portland",     price: "$149/m²" },
    ];
  } else if (n.includes("terrazzo")) {
    suppliers = [
      { name: "Concord Terrazzo · Chicago",     price: "$240/m²" },
      { name: "National Terrazzo · Dallas",     price: "$215/m²" },
      { name: "Terrazzco · Lexington",          price: "$265/m²" },
    ];
  } else if (n.includes("marble") || n.includes("stone") || n.includes("granite")) {
    suppliers = [
      { name: "Carrara Stone · Carrara",        price: "$320/m²" },
      { name: "Stone Source · New York",        price: "$285/m²" },
      { name: "MSI Stone · Atlanta",            price: "$255/m²" },
    ];
  } else if (n.includes("steel") || n.includes("metal") || n.includes("alumin")) {
    suppliers = [
      { name: "ArcelorMittal · Luxembourg",     price: "$118/m²" },
      { name: "Nucor Steel · Charlotte",        price: "$105/m²" },
      { name: "ThyssenKrupp · Essen",           price: "$132/m²" },
    ];
  } else if (n.includes("glass")) {
    suppliers = [
      { name: "Guardian Glass · Auburn Hills",  price: "$165/m²" },
      { name: "AGC Glass · Brussels",           price: "$182/m²" },
      { name: "Pilkington · Lathom",            price: "$148/m²" },
    ];
  } else if (n.includes("brick") || n.includes("masonry")) {
    suppliers = [
      { name: "Wienerberger · Vienna",          price: "$92/m²"  },
      { name: "Acme Brick · Fort Worth",        price: "$86/m²"  },
      { name: "Ibstock Brick · Ibstock",        price: "$98/m²"  },
    ];
  } else if (n.includes("tile") || n.includes("ceramic") || n.includes("porcelain")) {
    suppliers = [
      { name: "Porcelanosa · Villareal",        price: "$78/m²"  },
      { name: "Daltile · Dallas",               price: "$65/m²"  },
      { name: "Marazzi · Sassuolo",             price: "$82/m²"  },
    ];
  } else if (n.includes("carpet") || n.includes("fabric") || n.includes("textile")) {
    suppliers = [
      { name: "Interface · Atlanta",            price: "$52/m²"  },
      { name: "Shaw Floors · Dalton",           price: "$45/m²"  },
      { name: "Milliken · Spartanburg",         price: "$58/m²"  },
    ];
  } else if (n.includes("plaster") || n.includes("gypsum")) {
    suppliers = [
      { name: "Saint-Gobain Gyproc · Paris",   price: "$68/m²"  },
      { name: "USG Corporation · Chicago",      price: "$62/m²"  },
      { name: "Knauf · Iphofen",                price: "$71/m²"  },
    ];
  } else {
    suppliers = [
      { name: "Sika AG · Baar",                 price: "$110/m²" },
      { name: "BASF Construction · Ludwigshafen", price: "$102/m²" },
      { name: "Mapei · Milan",                  price: "$118/m²" },
    ];
  }

  // ── Fire Rating ────────────────────────────────────────────────────────────
  let fireRating: string;
  if (n.includes("concrete") || n.includes("steel") || n.includes("metal") ||
      n.includes("brick") || n.includes("stone") || n.includes("marble") ||
      n.includes("granite") || n.includes("terrazzo") || n.includes("masonry") ||
      n.includes("glass") || n.includes("tile") || n.includes("ceramic") ||
      n.includes("porcelain") || n.includes("gypsum") || n.includes("plaster") ||
      n.includes("alumin")) {
    fireRating = "Class A - Non-combustible";
  } else if (n.includes("wood") || n.includes("oak") || n.includes("timber") ||
             n.includes("hardwood")) {
    fireRating = "Class B - Flame spread treated";
  } else if (n.includes("carpet") || n.includes("fabric") || n.includes("textile")) {
    fireRating = "Class C - Combustible";
  } else {
    fireRating = "Class B - Flame spread treated";
  }

  return { cost, nrc, acousticDesc, rValue, thermalDesc, lifespan, maintenance, suppliers, fireRating };
}

// ── Shared section header label ───────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-mono uppercase tracking-[0.15em] mb-2.5"
      style={{ color: ACCENT }}
    >
      {children}
    </p>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono text-ghost/40 mt-1.5">{children}</p>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  material: GroundedMaterial | null;
  onClose: () => void;
}

export default function MaterialDrawer({ material, onClose }: Props) {
  const open = material !== null;
  const passes = material ? Math.round(material.confidence * 5) : 0;
  const dummy = material ? getMaterialData(material.name) : null;

  return (
    <div
      className={`absolute inset-y-0 right-0 w-1/5 min-w-[280px] bg-panel border-l border-wire flex flex-col z-50 transform transition-transform duration-300 ease-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {material && dummy && (
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

            {/* ── VLM Description ── */}
            <p className="text-sm text-ghost leading-relaxed">
              {material.description}
            </p>

            {/* ── Identification Confidence ── */}
            <div>
              <SectionLabel>Identification Confidence</SectionLabel>
              <div className="flex gap-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${i < passes ? "" : "bg-wire"}`}
                    style={i < passes ? { backgroundColor: ACCENT } : undefined}
                  />
                ))}
              </div>
              <p className="text-xs text-ghost font-mono">
                Identified in {passes} of 5 passes
              </p>
            </div>

            {/* ── Environmental Impact (real API data) ── */}
            <div>
              <SectionLabel>Environmental Impact</SectionLabel>
              {material.co2e_value !== null ? (
                <>
                  <p className="font-mono text-2xl font-light text-ink tracking-tight">
                    {material.co2e_value.toFixed(4)}
                  </p>
                  <p className="text-xs text-ghost font-mono mt-0.5">
                    {material.co2e_unit ?? "kgCO₂e/kg"}
                  </p>
                  {material.database_match && (
                    <div className="mt-3 pt-3 border-t border-wire">
                      <p className="text-[10px] font-mono text-ghost/60 uppercase tracking-[0.15em] mb-1">
                        Database Match
                      </p>
                      <p className="text-xs text-ink leading-snug">
                        {material.database_match}
                      </p>
                      <p className="text-[10px] text-ghost/50 font-mono mt-1">
                        ICE Database V4.1
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-ghost italic">No match found in database</p>
              )}
            </div>

            <div className="border-t border-wire" />

            {/* ── Estimated Cost ── */}
            <div>
              <SectionLabel>Estimated Cost</SectionLabel>
              <p className="text-sm font-mono text-ink">{dummy.cost}</p>
              <Note>Market estimate · Not verified</Note>
            </div>

            {/* ── Acoustic Performance ── */}
            <div>
              <SectionLabel>Acoustic Performance</SectionLabel>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-mono font-light text-ink tracking-tight">
                  {dummy.nrc.toFixed(2)}
                </p>
                <p className="text-xs text-ghost font-mono">NRC</p>
              </div>
              <p className="text-xs text-ghost mt-1">{dummy.acousticDesc}</p>
              <Note>Estimated · Not verified</Note>
            </div>

            {/* ── Thermal Properties ── */}
            <div>
              <SectionLabel>Thermal Properties</SectionLabel>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-mono font-light text-ink tracking-tight">
                  {dummy.rValue < 0.01 ? dummy.rValue.toFixed(3) : dummy.rValue.toFixed(2)}
                </p>
                <p className="text-xs text-ghost font-mono">R-value / inch</p>
              </div>
              <p className="text-xs text-ghost mt-1">{dummy.thermalDesc}</p>
              <Note>Estimated · Not verified</Note>
            </div>

            {/* ── Durability ── */}
            <div>
              <SectionLabel>Durability</SectionLabel>
              <p className="text-sm text-ink font-mono">{dummy.lifespan}</p>
              <p className="text-xs text-ghost mt-1">
                Maintenance — {dummy.maintenance}
              </p>
              <Note>Estimated · Not verified</Note>
            </div>

            {/* ── Top Suppliers ── */}
            <div>
              <SectionLabel>Top Suppliers</SectionLabel>
              <div className="space-y-2.5">
                {dummy.suppliers.map((s) => (
                  <div key={s.name} className="flex items-start justify-between gap-2">
                    <p className="text-xs text-ink leading-snug flex-1">{s.name}</p>
                    <p className="text-xs font-mono text-ghost shrink-0">{s.price}</p>
                  </div>
                ))}
              </div>
              <Note>Representative suppliers · Contact for quotes</Note>
            </div>

            {/* ── Fire Rating ── */}
            <div>
              <SectionLabel>Fire Rating</SectionLabel>
              <p className="text-sm text-ink font-mono">{dummy.fireRating}</p>
              <Note>Typical rating · Verify with local codes</Note>
            </div>

            {/* ── Human review flag ── */}
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
