"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function WorkspacePage() {
  const router = useRouter();

  // ── App state ──────────────────────────────────────────────────────────────
  const [username, setUsername] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);

  const [allIterations, setAllIterations] = useState<Iteration[]>([]);
  const [activeIterNum, setActiveIterNum] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Panel state ────────────────────────────────────────────────────────────
  const [drawerMaterial, setDrawerMaterial] = useState<GroundedMaterial | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const activeIteration =
    allIterations.find((i) => i.iteration_number === activeIterNum) ?? null;

  // ── Theme ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // ── Auth check ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("iigeai-username");
    if (!saved) {
      router.replace("/");
      return;
    }
    setUsername(saved);
  }, [router]);

  // ── Load most-recent past session on mount ─────────────────────────────────
  useEffect(() => {
    if (!username) return;
    getAllSessions(username)
      .then((sessions) => {
        const entries = Object.entries(sessions);
        if (entries.length === 0) return;

        // Pick the session whose last iteration has the most recent timestamp
        entries.sort((a, b) => {
          const aLast = a[1][a[1].length - 1]?.timestamp ?? "";
          const bLast = b[1][b[1].length - 1]?.timestamp ?? "";
          return bLast.localeCompare(aLast);
        });

        const [mostRecentId, iterations] = entries[0];
        if (iterations.length > 0) {
          setSessionId(mostRecentId);
          setAllIterations(iterations);
          setActiveIterNum(iterations[iterations.length - 1].iteration_number);
        }
      })
      .catch(() => {
        /* silently ignore — network may be unavailable on first load */
      });
  }, [username]);

  // ── Escape key closes any open panel ──────────────────────────────────────
  const closeAll = useCallback(() => {
    setDrawerMaterial(null);
    setShowHistory(false);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [closeAll]);

  // ── Generate ───────────────────────────────────────────────────────────────
  const handleGenerate = async (prompt: string, roomType: RoomType) => {
    setLoading(true);
    setError(null);
    setDrawerMaterial(null);

    try {
      const response = await generateDesign(
        prompt,
        roomType,
        sessionId ?? undefined,
        username,
      );
      setSessionId(response.session_id);
      const iterations = [...response.history, response.current_iteration];
      setAllIterations(iterations);
      setActiveIterNum(response.current_iteration.iteration_number);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ── Panel handlers ─────────────────────────────────────────────────────────
  const handleOpenDrawer = (mat: GroundedMaterial) => {
    setDrawerMaterial(mat);
    setShowHistory(false);
  };

  const handleOpenHistory = () => {
    setShowHistory(true);
    setDrawerMaterial(null);
  };

  const handleLogout = () => {
    localStorage.removeItem("iigeai-username");
    router.replace("/");
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  //
  //  isEmpty      — no results yet, not loading → show CenteredPrompt
  //  isFirstLoad  — loading with no prior results → show PipelineLoader
  //  hasContent   — results exist (possibly loading another) → show image + bottom bar
  //
  const isEmpty = !loading && allIterations.length === 0;
  const isFirstLoad = loading && allIterations.length === 0;
  const hasContent = allIterations.length > 0;

  const showTiles =
    hasContent &&
    !isFirstLoad &&
    activeIteration !== null &&
    activeIteration.materials.length > 0;

  const panelOpen = drawerMaterial !== null || showHistory;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-canvas text-ink">
      <TopBar
        username={username}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        onOpenHistory={handleOpenHistory}
        onLogout={handleLogout}
      />

      {/*
        Main content — `relative` so absolute panels are positioned within it.
        `overflow-hidden` clips sliding panels when translated off-screen.
      */}
      <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden">

        {/* ── Error banner ── */}
        {error && (
          <div className="mx-6 mt-3 shrink-0 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2 text-sm text-red-400 font-mono">
            {error}
          </div>
        )}

        {/* ── Image area — flex-1 dominates vertical space ── */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-6">

          {/* First-time: centered prompt (no generation yet) */}
          {isEmpty && (
            <CenteredPrompt onGenerate={handleGenerate} loading={loading} />
          )}

          {/* First generation in progress: witty cycling words */}
          {isFirstLoad && <PipelineLoader />}

          {/* Has results: show image (dims during subsequent re-generation) */}
          {hasContent && !isFirstLoad && (
            <GeneratedImage
              imageUrl={activeIteration?.image_url ?? null}
              loading={loading}
              alt={activeIteration?.prompt}
            />
          )}
        </div>

        {/* ── Material tiles strip (~1/8 height) ── */}
        {showTiles && (
          <div className="h-28 shrink-0 border-t border-wire flex items-center gap-3 px-5 overflow-x-auto">
            {activeIteration!.materials.map((m, i) => (
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
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        )}

        {/* ── Bottom prompt bar — only shown after first generation ── */}
        {hasContent && (
          <div className="shrink-0 border-t border-wire">
            <PromptBar onGenerate={handleGenerate} loading={loading} />
          </div>
        )}

        {/* ── Backdrop: click outside to close any open panel ── */}
        {panelOpen && (
          <div
            className="absolute inset-0 z-40"
            onClick={closeAll}
          />
        )}

        {/* ── Material detail drawer (right, slides in) ── */}
        <MaterialDrawer
          material={drawerMaterial}
          onClose={() => setDrawerMaterial(null)}
        />

        {/* ── History panel (right, slides in) ── */}
        <HistoryPanel
          open={showHistory}
          iterations={allIterations}
          activeNumber={activeIterNum ?? 0}
          onClose={() => setShowHistory(false)}
          onSelect={(iter) => {
            setActiveIterNum(iter.iteration_number);
            setShowHistory(false);
          }}
        />
      </div>
    </div>
  );
}
