"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

// ── Architecture quotes ───────────────────────────────────────────────────────

const QUOTES = [
  { text: "The best way to predict the future is to design it.", author: "Buckminster Fuller" },
  { text: "Every great design begins with an even better story.", author: "Lorinda Mamo" },
  { text: "Design is not just what it looks like. Design is how it works.", author: "Steve Jobs" },
  { text: "Imagination is the beginning of creation.", author: "George Bernard Shaw" },
 
  { text: "Have no fear of perfection, you'll never reach it.", author: "Salvador Dali" },
  { text: "Art is not what you see, but what you make others see.", author: "Edgar Degas" },
];

const ACCENT = "#6b8f71";

// ── Component ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [name,      setName]      = useState("");
  const [ready,     setReady]     = useState(false);
  const [isDark,    setIsDark]    = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [visible,   setVisible]   = useState(false);

  // Quote cycling — start on a random quote
  const [quoteIndex, setQuoteIndex] = useState(() =>
    Math.floor(Math.random() * QUOTES.length),
  );
  const [quoteFaded, setQuoteFaded] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    const saved = localStorage.getItem("iigeai-username");
    if (saved) { router.replace("/workspace"); return; }
    setReady(true);
  }, [router]);

  // Trigger entry fade-in once the page is ready
  useEffect(() => {
    if (!ready) return;
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(r2);
    });
    return () => cancelAnimationFrame(r1);
  }, [ready]);

  // Cycle quotes every 4 s with a 500 ms crossfade
  useEffect(() => {
    const id = setInterval(() => {
      setQuoteFaded(true);
      setTimeout(() => {
        setQuoteIndex((i) => (i + 1) % QUOTES.length);
        setQuoteFaded(false);
      }, 500);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem("iigeai-username", trimmed);
    setIsLeaving(true);
    setTimeout(() => router.push("/workspace"), 350);
  };

  if (!ready) return null;

  const hasName = name.trim().length > 0;

  return (
    <div className="min-h-screen bg-canvas flex flex-col">

      {/* Theme toggle */}
      <div className="absolute top-4 right-6">
        <ThemeToggle isDark={isDark} onToggle={() => setIsDark((d) => !d)} />
      </div>

      {/* Centered — mb-[12vh] lands at ~40% from top */}
      <div className="flex-1 flex items-center justify-center">
        <div
          className={`flex flex-col items-center gap-8 w-[75vw] max-w-4xl mb-[12vh]
            transition-all
            ${isLeaving
              ? "duration-300 ease-in  opacity-0 -translate-y-3"
              : visible
                ? "duration-500 ease-out opacity-100 translate-y-0"
                : "duration-0 opacity-0 translate-y-3"
            }`}
        >
          {/* Wordmark */}
          <div className="text-center space-y-3">
            <h1 className="text-6xl font-light tracking-[0.08em] text-ink">
              IIGenAI
            </h1>
            <p className="text-[11px] font-mono text-ghost/50 tracking-widest uppercase">
              Insight-Informed Generative AI
            </p>
          </div>

         

          {/* Underline input */}
          <form onSubmit={handleSubmit} className="w-full max-w-md">
            <div className="relative border-b border-wire focus-within:border-ink transition-colors duration-200">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name..."
                autoFocus
                disabled={isLeaving}
                className="w-full bg-transparent py-3 pr-10 text-lg text-ink placeholder:italic placeholder:text-ghost/40 outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!hasName || isLeaving}
                className="absolute right-0 top-1/2 -translate-y-1/2 transition-all duration-200 disabled:cursor-not-allowed cursor-pointer"
                style={{ opacity: hasName && !isLeaving ? 1 : 0.2 }}
              >
                <ArrowRight size={18} strokeWidth={1.5} className="text-ink" />
              </button>
            </div>
          </form>

          {/* Footer */}
          <p className="text-[11px] text-ghost/25 font-mono tracking-wide">
            v0.1 · Thesis Research Prototype
          </p>
          <div
            className="text-center space-y-1 transition-opacity duration-500 px-4"
            style={{ opacity: quoteFaded ? 0 : 1 }}
          >
            <p className="text-3xl italic leading-relaxed" style={{ color: ACCENT }}>
              &ldquo;{QUOTES[quoteIndex].text}&rdquo;
            </p>
            <p className="text-1xl font-mono" style={{ color: ACCENT, opacity: 0.65 }}>
              - {QUOTES[quoteIndex].author}
            </p>
          </div>
        </div>
         {/* Rotating quote */}
        
      </div>
    </div>
  );
}
