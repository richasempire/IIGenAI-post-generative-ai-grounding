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
}

export default function CenteredPrompt({ onGenerate, loading }: Props) {
  const [prompt,         setPrompt]         = useState("");
  const [roomType,       setRoomType]       = useState<RoomTypeOrFreestyle>("living_room");
  const [freestyleLabel, setFreestyleLabel] = useState("");
  const [model,          setModel]          = useState("gpt-image-1");
  const [modelOpen,      setModelOpen]      = useState(false);
  const [toast,          setToast]          = useState<string | null>(null);

  const modelRef = useRef<HTMLDivElement>(null);
  const currentModel = MODELS.find((m) => m.id === model)!;

  // Close model dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node))
        setModelOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    // Map local "freestyle" to the API's free_flowing + optionally enrich prompt
    const finalRoomType: RoomType =
      roomType === "freestyle" ? "free_flowing" : roomType;
    const finalPrompt =
      roomType === "freestyle" && freestyleLabel.trim()
        ? `${trimmed}. Space type: ${freestyleLabel.trim()}`
        : trimmed;

    onGenerate(finalPrompt, finalRoomType);
  };

  const hasInput = prompt.trim().length > 0;

  return (
    /*
      mb-[12vh] shifts the block above the geometric center of the flex
      container — visually lands at roughly 40% from the top.
    */
    <div className="flex flex-col items-center gap-5 w-[75vw] max-w-4xl mb-[12vh]">

      {/* Headline */}
      <div className="text-center space-y-1.5">
        <p className="text-2xl font-light text-ghost leading-relaxed">
          Imagine a space.
        </p>
        <p className="text-[11px] font-mono text-ghost/40 tracking-widest uppercase">
          IIGenAI · Post-Generative Material Grounding
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-3">

        {/* ── Input with inline arrow ── */}
        <div className="relative">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Imagine a space..."
            autoFocus
            disabled={loading}
            className="w-full bg-panel rounded-xl px-6 py-5 text-xl text-ink placeholder:italic placeholder:text-ghost/45 outline-none focus:ring-1 focus:ring-wire transition-all pr-14 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!hasInput || loading}
            className="absolute right-4 top-1/2 -translate-y-1/2 transition-all duration-200 disabled:cursor-not-allowed cursor-pointer"
            style={{ opacity: hasInput ? 1 : 0.22 }}
          >
            {loading
              ? <Loader2 size={20} strokeWidth={1.5} className="text-ghost animate-spin" />
              : <ArrowRight size={20} strokeWidth={1.5} className="text-ink" />
            }
          </button>
        </div>

        {/* ── Room pills  +  Action buttons ── */}
        <div className="flex items-center justify-between">

          {/* Room type pills */}
          <div className="flex gap-2 flex-wrap items-center">
            {(Object.entries(ROOM_LABELS) as [RoomType, string][]).map(([rt, label]) => (
              <button
                key={rt}
                type="button"
                onClick={() => setRoomType(rt)}
                className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer border ${
                  roomType === rt
                    ? "bg-panel2 text-ink"
                    : "border-transparent bg-panel2 text-ghost hover:text-ink"
                }`}
                style={roomType === rt ? { borderColor: "#6b8f71" } : undefined}
              >
                {label}
              </button>
            ))}

            {/* Freestyle pill — morphs into an inline text input when selected */}
            {roomType === "freestyle" ? (
              <input
                autoFocus
                value={freestyleLabel}
                onChange={(e) => setFreestyleLabel(e.target.value)}
                placeholder="describe your space..."
                className="px-3 py-1 rounded-full text-xs bg-panel2 text-ink outline-none w-44 placeholder:text-ghost/40 placeholder:italic border"
                style={{ borderColor: "#6b8f71" }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setRoomType("freestyle")}
                className="px-3 py-1 rounded-full text-xs bg-panel2 text-ghost hover:text-ink transition-colors cursor-pointer border border-transparent"
              >
                Custom
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">

            {/* Model selector */}
            <div ref={modelRef} className="relative">
              <button
                type="button"
                onClick={() => setModelOpen((o) => !o)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-ghost hover:text-ink text-[11px] font-mono tracking-wide transition-colors cursor-pointer"
              >
                {currentModel.label}
                <ChevronDown
                  size={11}
                  strokeWidth={1.5}
                  className={`transition-transform duration-200 ${modelOpen ? "rotate-180" : ""}`}
                />
              </button>

              {modelOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-52 bg-panel border border-wire rounded-xl shadow-lg overflow-hidden z-50">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!m.available}
                      onClick={() => {
                        if (m.available) { setModel(m.id); setModelOpen(false); }
                      }}
                      title={!m.available ? "Coming soon" : undefined}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-mono text-left transition-colors ${
                        m.available
                          ? "text-ink hover:bg-panel2 cursor-pointer"
                          : "text-ghost/35 cursor-not-allowed"
                      }`}
                    >
                      <span>{m.label}</span>
                      {model === m.id && m.available
                        ? <Check size={11} strokeWidth={2} className="text-ink" />
                        : !m.available
                          ? <span className="text-ghost/30 text-[10px]">soon</span>
                          : null
                      }
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="w-px h-3 bg-wire" />

            {/* Upload reference */}
            <button
              type="button"
              title="Upload reference sketch (coming soon)"
              onClick={() => setToast("Sketch upload coming soon")}
              className="p-1.5 rounded-lg text-ghost hover:text-ink transition-colors cursor-pointer"
            >
              <Plus size={14} strokeWidth={1.5} />
            </button>

            {/* Freehand sketch */}
            <button
              type="button"
              title="Freehand sketch (coming soon)"
              onClick={() => setToast("Sketch canvas coming soon")}
              className="p-1.5 rounded-lg text-ghost hover:text-ink transition-colors cursor-pointer"
            >
              <Pencil size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </form>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-panel border border-wire rounded-lg px-4 py-2 text-[11px] font-mono text-ghost shadow-lg pointer-events-none z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
