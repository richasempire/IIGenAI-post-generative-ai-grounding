"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowRight, Loader2, Plus, Pencil, ChevronDown, Check } from "lucide-react";
import type { RoomType } from "@/lib/api";

// ── Room type config ──────────────────────────────────────────────────────────

const ROOM_LABELS: Record<RoomType, string> = {
  living_room:  "Living Room",
  office:       "Office",
  patient_room: "Patient Room",
  free_flowing: "Freestyle",
};

// "freestyle" is a local UI concept — maps to free_flowing on the wire
type RoomTypeOrFreestyle = RoomType | "freestyle";

// ── Model config ──────────────────────────────────────────────────────────────

const MODELS = [
  { id: "gpt-image-1",        label: "DALL·E gpt-image-1",    available: true  },
  { id: "midjourney-v7",      label: "Midjourney v7",          available: false },
  { id: "stable-diffusion-4", label: "Stable Diffusion 4",     available: false },
  { id: "imagen-4",           label: "Imagen 4",               available: false },
  { id: "claude-sonnet",      label: "Claude Sonnet 4.6",      available: false },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onGenerate: (prompt: string, roomType: RoomType) => void;
  loading: boolean;
  /**
   * When true the PromptBar is in iterative mode (an image already exists).
   * No room type is pre-selected so the prompt is sent without a prefix —
   * the Responses API already carries the room context from previous turns.
   * The user can still click a pill to explicitly override the room type.
   */
  iterativeMode?: boolean;
}

export default function PromptBar({ onGenerate, loading, iterativeMode = false }: Props) {
  const [prompt,         setPrompt]         = useState("");
  // null = no room type selected (iterative mode default — no prefix added)
  const [roomType,       setRoomType]       = useState<RoomTypeOrFreestyle | null>(
    iterativeMode ? null : "living_room",
  );
  const [freestyleLabel, setFreestyleLabel] = useState("");
  const [model,          setModel]          = useState("gpt-image-1");
  const [modelOpen,      setModelOpen]      = useState(false);
  const [toast,          setToast]          = useState<string | null>(null);

  const modelRef = useRef<HTMLDivElement>(null);
  const currentModel = MODELS.find((m) => m.id === model)!;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node))
        setModelOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    // null  → no pill selected (iterative mode) → free_flowing = no prefix
    // "freestyle" → custom label appended but still free_flowing on the wire
    const finalRoomType: RoomType =
      roomType === null || roomType === "freestyle" ? "free_flowing" : roomType;
    const finalPrompt =
      roomType === "freestyle" && freestyleLabel.trim()
        ? `${trimmed}. Space type: ${freestyleLabel.trim()}`
        : trimmed;

    onGenerate(finalPrompt, finalRoomType);
  };

  const hasInput = prompt.trim().length > 0;

  return (
    <div className="px-6 pt-3 pb-2 shrink-0">

      {/* ── Main input row ── */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your interior space..."
            disabled={loading}
            className="w-full bg-panel rounded-lg px-4 py-2.5 text-sm text-ink placeholder-ghost outline-none focus:ring-1 focus:ring-wire transition-all pr-10 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!hasInput || loading}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-all duration-200 disabled:cursor-not-allowed cursor-pointer"
            style={{ opacity: hasInput ? 1 : 0.22 }}
          >
            {loading
              ? <Loader2 size={15} strokeWidth={1.5} className="text-ghost animate-spin" />
              : <ArrowRight size={15} strokeWidth={1.5} className="text-ink" />
            }
          </button>
        </div>
      </form>

      {/* ── Room pills  +  compact action buttons ── */}
      <div className="flex items-center justify-between mt-2">

        {/* Room type pills */}
        <div className="flex gap-1.5 flex-wrap items-center">
          {(Object.entries(ROOM_LABELS) as [RoomType, string][]).map(([rt, label]) => (
            <button
              key={rt}
              type="button"
              onClick={() => setRoomType(rt)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] transition-colors cursor-pointer border ${
                roomType === rt
                  ? "bg-panel2 text-ink"
                  : "border-transparent bg-panel2 text-ghost hover:text-ink"
              }`}
              style={roomType === rt ? { borderColor: "#6b8f71" } : undefined}
            >
              {label}
            </button>
          ))}

          {/* Freestyle pill — morphs into inline input when active */}
          {roomType === "freestyle" ? (
            <input
              autoFocus
              value={freestyleLabel}
              onChange={(e) => setFreestyleLabel(e.target.value)}
              placeholder="describe your space..."
              className="px-2.5 py-0.5 rounded-full text-[11px] bg-panel2 text-ink outline-none w-36 placeholder:text-ghost/40 placeholder:italic border"
              style={{ borderColor: "#6b8f71" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setRoomType("freestyle")}
              className="px-2.5 py-0.5 rounded-full text-[11px] bg-panel2 text-ghost hover:text-ink transition-colors cursor-pointer border border-transparent"
            >
              Custom
            </button>
          )}
        </div>

        {/* Compact action buttons */}
        <div className="flex items-center gap-1">

          {/* Model selector */}
          <div ref={modelRef} className="relative">
            <button
              type="button"
              onClick={() => setModelOpen((o) => !o)}
              className="flex items-center gap-0.5 px-2 py-1 rounded-md text-ghost hover:text-ink text-[10px] font-mono transition-colors cursor-pointer"
            >
              {currentModel.label}
              <ChevronDown
                size={10}
                strokeWidth={1.5}
                className={`transition-transform duration-200 ${modelOpen ? "rotate-180" : ""}`}
              />
            </button>

            {modelOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-panel border border-wire rounded-xl shadow-lg overflow-hidden z-50">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!m.available}
                    onClick={() => {
                      if (m.available) { setModel(m.id); setModelOpen(false); }
                    }}
                    title={!m.available ? "Coming soon" : undefined}
                    className={`w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono text-left transition-colors ${
                      m.available
                        ? "text-ink hover:bg-panel2 cursor-pointer"
                        : "text-ghost/35 cursor-not-allowed"
                    }`}
                  >
                    <span>{m.label}</span>
                    {model === m.id && m.available
                      ? <Check size={10} strokeWidth={2} className="text-ink" />
                      : !m.available
                        ? <span className="text-ghost/30 text-[9px]">soon</span>
                        : null
                    }
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="w-px h-2.5 bg-wire" />

          <button
            type="button"
            title="Upload reference sketch (coming soon)"
            onClick={() => setToast("Sketch upload coming soon")}
            className="p-1 rounded-md text-ghost hover:text-ink transition-colors cursor-pointer"
          >
            <Plus size={12} strokeWidth={1.5} />
          </button>

          <button
            type="button"
            title="Freehand sketch (coming soon)"
            onClick={() => setToast("Sketch canvas coming soon")}
            className="p-1 rounded-md text-ghost hover:text-ink transition-colors cursor-pointer"
          >
            <Pencil size={12} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-panel border border-wire rounded-lg px-4 py-2 text-[11px] font-mono text-ghost shadow-lg pointer-events-none z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
