"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import PromptBar from "@/components/PromptBar";
import CenteredPrompt from "@/components/CenteredPrompt";
import PipelineLoader from "@/components/PipelineLoader";
import GeneratedImage from "@/components/GeneratedImage";
import MaterialTile from "@/components/MaterialTile";
import MaterialDrawer from "@/components/MaterialDrawer";
import HistoryPanel from "@/components/HistoryPanel";
import { generateDesign, getAllSessions } from "@/lib/api";
import type { Iteration, RoomType, GroundedMaterial } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract session_id from /api/image/{session_id}/{n}?username=... */
function sessionIdFromUrl(imageUrl: string): string | null {
  const m = imageUrl.match(/\/api\/image\/([^/?]+)\//);
  return m ? m[1] : null;
}

/** Merge `b` into `a`, deduplicating by image_url. */
function mergeIterations(a: Iteration[], b: Iteration[]): Iteration[] {
  const seen = new Set(a.map((i) => i.image_url));
  return [...a, ...b.filter((i) => !seen.has(i.image_url))];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkspacePage() {
  const router = useRouter();

  // ── Identity ────────────────────────────────────────────────────────────────
  const [username, setUsername] = useState("");
  const [isDark,   setIsDark]   = useState(false);
  // Entry animation — fades in once auth confirms the user
  const [visible,  setVisible]  = useState(false);

  // ── Current design session (cleared on "New Design") ────────────────────────
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentIterations, setCurrentIterations] = useState<Iteration[]>([]);

  // ── Cross-session history (preserved through "New Design" clicks) ────────────
  // All known iterations across all sessions, deduped by image_url.
  const [historyCache, setHistoryCache] = useState<Iteration[]>([]);

  // ── Active item — identified by image_url (globally unique across sessions) ──
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerMaterial, setDrawerMaterial] = useState<GroundedMaterial | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // ── Derived: everything the history panel can show ──────────────────────────
  const historyForPanel = useMemo(
    () => mergeIterations(historyCache, currentIterations),
    [historyCache, currentIterations],
  );

  // ── Derived: the iteration currently on-screen ──────────────────────────────
  const activeIteration =
    historyForPanel.find((i) => i.image_url === activeImageUrl) ?? null;

  // ── Theme sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("iigeai-username");
    if (!saved) { router.replace("/"); return; }
    setUsername(saved);
  }, [router]);

  // ── Entry fade-in — fires once username is confirmed ────────────────────────
  useEffect(() => {
    if (!username) return;
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(r2);
    });
    return () => cancelAnimationFrame(r1);
  }, [username]);

  // ── Load all past sessions on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!username) return;
    getAllSessions(username)
      .then((sessions) => {
        const all = Object.values(sessions).flat();
        if (!all.length) return;

        // Seed the history cache with every known iteration.
        // Do NOT pre-load any session — always start with a clean empty state.
        setHistoryCache(all);
      })
      .catch(() => { /* network unavailable on first load — silent */ });
  }, [username]);

  // ── Escape key ───────────────────────────────────────────────────────────────
  const closeAll = useCallback(() => {
    setDrawerMaterial(null);
    setShowHistory(false);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeAll(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [closeAll]);

  // ── Generate ─────────────────────────────────────────────────────────────────
  const handleGenerate = async (prompt: string, roomType: RoomType) => {
    setLoading(true);
    setError(null);
    setDrawerMaterial(null);

    try {
      const response = await generateDesign(
        prompt, roomType, sessionId ?? undefined, username,
      );
      const newIterations = [...response.history, response.current_iteration];
      setSessionId(response.session_id);
      setCurrentIterations(newIterations);
      setActiveImageUrl(response.current_iteration.image_url);
      setHistoryCache((prev) => mergeIterations(prev, newIterations));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ── New Design (logo click) — keeps history, starts fresh ───────────────────
  const handleNewDesign = () => {
    if (currentIterations.length > 0) {
      setHistoryCache((prev) => mergeIterations(prev, currentIterations));
    }
    setCurrentIterations([]);
    setSessionId(null);
    setActiveImageUrl(null);
    setDrawerMaterial(null);
    setShowHistory(false);
    setError(null);
  };

  // ── Panel handlers ───────────────────────────────────────────────────────────
  const handleOpenDrawer = (mat: GroundedMaterial) => {
    setDrawerMaterial(mat);
    setShowHistory(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("iigeai-username");
    router.replace("/");
  };

  // History item selected — restore that session's context
  const handleHistorySelect = (iter: Iteration) => {
    setActiveImageUrl(iter.image_url);
    const sid = sessionIdFromUrl(iter.image_url);
    if (sid && sid !== sessionId) {
      setSessionId(sid);
      const sessionIters = historyForPanel.filter(
        (i) => sessionIdFromUrl(i.image_url) === sid,
      );
      if (sessionIters.length > 0) setCurrentIterations(sessionIters);
    }
    setShowHistory(false);
  };

  // ── Derived state ─────────────────────────────────────────────────────────────
  //
  //  isEmpty      — nothing on screen, not loading → show CenteredPrompt
  //  isFirstLoad  — loading with no prior results → show skeleton tiles (no old tiles to show)
  //  showLoader   — any generation in progress → always show PipelineLoader in image area
  //  showImage    — only when idle AND there's an active iteration
  //
  const isEmpty      = !loading && currentIterations.length === 0 && activeImageUrl === null;
  const isFirstLoad  = loading  && currentIterations.length === 0;
  const showLoader   = loading;
  const showImage    = !loading && activeIteration !== null;
  const showTiles    = !loading && activeIteration !== null && activeIteration.materials.length > 0;
  // Show bottom bar whenever there's something on screen (current session OR history preview)
  const showPromptBar = currentIterations.length > 0 || (activeImageUrl !== null && !loading);
  const panelOpen    = drawerMaterial !== null || showHistory;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={`h-screen flex flex-col overflow-hidden bg-canvas text-ink transition-all duration-500 ease-out ${
      visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
    }`}>
      <TopBar
        username={username}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        onOpenHistory={() => { setShowHistory(true); setDrawerMaterial(null); }}
        onLogout={handleLogout}
        onNewDesign={handleNewDesign}
      />

      <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden">

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-3 shrink-0 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2 text-sm text-red-400 font-mono">
            {error}
          </div>
        )}

        {/* Image area */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-2">
          {isEmpty     && <CenteredPrompt onGenerate={handleGenerate} loading={loading} />}
          {showLoader  && <PipelineLoader />}
          {showImage   && (
            <GeneratedImage
              imageUrl={activeIteration.image_url}
              loading={false}
              alt={activeIteration.prompt}
            />
          )}
        </div>

        {/* Material tiles strip */}
        {showTiles && (
          <div className="h-28 shrink-0 border-t border-wire flex items-center gap-3 px-5 overflow-x-auto">
            {activeIteration.materials.map((m, i) => (
              <MaterialTile
                key={`${m.name}-${i}`}
                material={m}
                onClick={() => handleOpenDrawer(m)}
              />
            ))}
          </div>
        )}

        {/* Tile skeletons during first load */}
        {isFirstLoad && (
          <div className="h-28 shrink-0 border-t border-wire flex items-center gap-3 px-5">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-40 h-20 rounded-lg bg-panel animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        )}

        {/* Bottom prompt bar */}
        {showPromptBar && (
          <div className="shrink-0 border-t border-wire">
            <PromptBar onGenerate={handleGenerate} loading={loading} />
          </div>
        )}

        {/* Backdrop */}
        {panelOpen && (
          <div className="absolute inset-0 z-40" onClick={closeAll} />
        )}

        <MaterialDrawer
          material={drawerMaterial}
          onClose={() => setDrawerMaterial(null)}
        />

        <HistoryPanel
          open={showHistory}
          iterations={historyForPanel}
          activeImageUrl={activeImageUrl ?? ""}
          onClose={() => setShowHistory(false)}
          onSelect={handleHistorySelect}
        />
      </div>
    </div>
  );
}
