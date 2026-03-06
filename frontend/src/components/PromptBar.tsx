"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
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

export default function PromptBar({ onGenerate, loading }: Props) {
  const [prompt, setPrompt] = useState("");
  const [roomType, setRoomType] = useState<RoomType>("living_room");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;
    onGenerate(trimmed, roomType);
  };

  return (
    <div className="px-8 py-4 border-b border-wire shrink-0">
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your interior space..."
          disabled={loading}
          className="flex-1 bg-panel rounded-lg px-4 py-3 text-ink placeholder-ghost text-sm outline-none focus:ring-1 focus:ring-sage transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!prompt.trim() || loading}
          className="flex items-center gap-2 bg-sage hover:bg-sage-lt text-white px-5 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <ArrowRight size={15} />
          )}
          Generate
        </button>
      </form>

      {/* Room type pills */}
      <div className="flex gap-2 mt-3">
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
    </div>
  );
}
