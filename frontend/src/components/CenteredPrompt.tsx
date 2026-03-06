"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { RoomType } from "@/lib/api";

const ROOM_LABELS: Record<RoomType, string> = {
  living_room:  "Living Room",
  office:       "Office",
  patient_room: "Patient Room",
  free_flowing: "Free",
};

interface Props {
  onGenerate: (prompt: string, roomType: RoomType) => void;
  loading: boolean;
}

export default function CenteredPrompt({ onGenerate, loading }: Props) {
  const [prompt, setPrompt] = useState("");
  const [roomType, setRoomType] = useState<RoomType>("living_room");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;
    onGenerate(trimmed, roomType);
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-sm px-6">
      {/* Headline */}
      <div className="text-center space-y-2">
        <p className="text-2xl font-light text-ghost leading-relaxed">
          Imagine a space.
        </p>
        <p className="text-[11px] font-mono text-ghost/40 tracking-widest uppercase">
          IIGenAI · Post-Generative Material Grounding
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Imagine a space..."
          autoFocus
          className="w-full bg-panel rounded-xl px-5 py-4 text-ink placeholder-ghost text-sm text-center outline-none focus:ring-1 focus:ring-sage transition-all"
        />

        {/* Room type pills */}
        <div className="flex gap-2 justify-center flex-wrap">
          {(Object.entries(ROOM_LABELS) as [RoomType, string][]).map(([rt, label]) => (
            <button
              key={rt}
              type="button"
              onClick={() => setRoomType(rt)}
              className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer ${
                roomType === rt
                  ? "bg-sage text-white"
                  : "bg-panel2 text-ghost hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={!prompt.trim() || loading}
          className="w-full flex items-center justify-center gap-2 bg-sage hover:bg-sage-lt text-white py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Ground this space
          <ArrowRight size={15} strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}
