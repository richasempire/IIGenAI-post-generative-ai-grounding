"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    // Redirect if already logged in
    const saved = localStorage.getItem("iigeai-username");
    if (saved) {
      router.replace("/workspace");
      return;
    }
    setReady(true);
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem("iigeai-username", trimmed);
    router.push("/workspace");
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* Theme toggle in corner */}
      <div className="absolute top-4 right-6">
        <ThemeToggle isDark={isDark} onToggle={() => setIsDark((d) => !d)} />
      </div>

      {/* Centered content */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-xs">
          {/* Wordmark */}
          <div className="mb-14 text-center">
            <h1 className="text-6xl font-light tracking-[0.08em] text-ink mb-4">
              IIGenAI
            </h1>
            <p className="text-sm text-ghost leading-relaxed tracking-wide">
              Insight-Informed Generative AI
            </p>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name to begin"
              autoFocus
              className="w-full bg-panel rounded-lg px-4 py-3 text-ink placeholder-ghost text-sm text-center outline-none focus:ring-1 focus:ring-sage transition-all"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full flex items-center justify-center gap-2 bg-sage hover:bg-sage-lt text-white py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Begin
              <ArrowRight size={15} strokeWidth={2} />
            </button>
          </form>

          {/* Footer */}
          <p className="text-[11px] text-ghost/50 text-center mt-10 font-mono tracking-wide">
            v0.1 · Thesis Research Prototype
          </p>
        </div>
      </div>
    </div>
  );
}
