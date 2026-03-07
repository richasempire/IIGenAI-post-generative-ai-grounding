"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { getImageSrc } from "@/lib/api";

// ── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#6b8f71";

type BrushSize = "S" | "M" | "L";
const BRUSH_PX: Record<BrushSize, number> = { S: 12, M: 28, L: 56 };

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  imageUrl: string | null;
  loading: boolean;
  alt?: string;
  /**
   * Called with the base64 mask PNG when the user clicks "Apply Edit".
   * The mask RGBA encodes: painted pixels = alpha 255 (server inverts to 0 =
   * transparent = OpenAI replaces), unpainted pixels = alpha 0.
   * If this prop is omitted the Edit Region button is hidden.
   */
  onMaskCapture?: (maskBase64: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GeneratedImage({
  imageUrl,
  loading,
  alt = "Generated interior design",
  onMaskCapture,
}: Props) {
  // ── Edit mode state ───────────────────────────────────────────────────────
  const [editMode,  setEditMode]  = useState(false);
  const [brushSize, setBrushSize] = useState<BrushSize>("M");
  const [isDrawing, setIsDrawing] = useState(false);

  const imgRef    = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPos   = useRef<{ x: number; y: number } | null>(null);

  // Exit edit mode whenever the displayed image changes (new iteration loaded)
  useEffect(() => {
    setEditMode(false);
    setIsDrawing(false);
    lastPos.current = null;
  }, [imageUrl]);

  // Sync canvas pixel dimensions to the image's layout dimensions when edit opens
  useEffect(() => {
    if (!editMode) return;
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;
    canvas.width  = img.clientWidth;
    canvas.height = img.clientHeight;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, [editMode]);

  // ── Drawing helpers ───────────────────────────────────────────────────────

  const getXY = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  /** Stamp a single brush circle at (x, y) */
  const stamp = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(107, 143, 113, 0.55)";
      ctx.beginPath();
      ctx.arc(x, y, BRUSH_PX[brushSize] / 2, 0, Math.PI * 2);
      ctx.fill();
    },
    [brushSize],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current) return;
      setIsDrawing(true);
      const { x, y } = getXY(e);
      lastPos.current = { x, y };
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) stamp(ctx, x, y);
    },
    [stamp],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      const { x, y } = getXY(e);
      const lp = lastPos.current;
      if (lp) {
        // Interpolate between last and current point for smooth brush strokes
        const dist  = Math.hypot(x - lp.x, y - lp.y);
        const step  = Math.max(1, BRUSH_PX[brushSize] / 4);
        const steps = Math.max(1, Math.floor(dist / step));
        for (let i = 1; i <= steps; i++) {
          stamp(
            ctx,
            lp.x + ((x - lp.x) * i) / steps,
            lp.y + ((y - lp.y) * i) / steps,
          );
        }
      }
      lastPos.current = { x, y };
    },
    [isDrawing, brushSize, stamp],
  );

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    lastPos.current = null;
  }, []);

  // ── Canvas actions ────────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditMode(false);
    setIsDrawing(false);
    lastPos.current = null;
  }, []);

  /**
   * Export the drawing canvas as a binary mask PNG and notify the parent.
   *
   * Output format:
   *   painted  pixels → RGBA (255, 255, 255, 255)  (opaque white)
   *   unpainted pixels → RGBA (  0,   0,   0,   0)  (transparent)
   *
   * The server (edit_image in generator.py) inverts the alpha channel so
   * that painted = alpha 0 = "transparent" = OpenAI edit zone.
   */
  const handleApply = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onMaskCapture) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const src = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Build a clean binary mask on an off-screen canvas
    const mc    = document.createElement("canvas");
    mc.width    = canvas.width;
    mc.height   = canvas.height;
    const mctx  = mc.getContext("2d")!;
    const md    = mctx.createImageData(canvas.width, canvas.height);

    for (let i = 0; i < src.data.length; i += 4) {
      if (src.data[i + 3] > 10) {
        // Painted: opaque white
        md.data[i]     = 255;
        md.data[i + 1] = 255;
        md.data[i + 2] = 255;
        md.data[i + 3] = 255;
      }
      // Unpainted: stays (0, 0, 0, 0) — transparent
    }
    mctx.putImageData(md, 0, 0);

    const base64 = mc.toDataURL("image/png").split(",")[1];
    setEditMode(false);
    onMaskCapture(base64);
  }, [onMaskCapture]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!imageUrl) return null;

  return (
    // inline-block so the overlay matches the image dimensions exactly
    <div className="relative inline-block max-w-full group">
      <img
        ref={imgRef}
        src={getImageSrc(imageUrl)}
        alt={alt}
        // max-h keeps the image inside the viewport regardless of aspect ratio.
        // w-auto + max-w-full lets it scale proportionally without cropping.
        // The 272px constant = TopBar (~52) + PromptBar (~82) + Tiles (~104) + pt-5 (20) + buffer.
        className="block rounded-lg object-contain max-w-full"
        style={{ maxHeight: "calc(100vh - 272px)" }}
      />

      {/* ── Edit Region button — shown on hover when idle ── */}
      {onMaskCapture && !editMode && !loading && (
        <button
          onClick={() => setEditMode(true)}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100
                     transition-opacity duration-150 bg-panel/90 border border-wire
                     rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-ghost
                     hover:text-ink flex items-center gap-1.5 backdrop-blur-sm"
          style={{ ["--tw-border-opacity" as string]: 1 }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.borderColor = ACCENT)
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.borderColor = "")
          }
          title="Paint a region to edit"
        >
          {/* Pencil icon */}
          <svg
            className="w-3 h-3"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 1.5l2.5 2.5-8.5 8.5H1.5V10L10 1.5z" />
          </svg>
          Edit Region
        </button>
      )}

      {/* ── Canvas drawing overlay ── */}
      {editMode && (
        <>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 rounded-lg cursor-crosshair"
            style={{ touchAction: "none" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
          />

          {/* Hint label */}
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none
                       bg-panel/90 border border-wire rounded-full px-3 py-1
                       text-[10px] font-mono text-ghost whitespace-nowrap backdrop-blur-sm"
          >
            Paint the region you want to change
          </div>

          {/* Brush toolbar */}
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2
                       flex items-center gap-2 bg-panel/95 border border-wire
                       rounded-full px-3 py-1.5 backdrop-blur-sm"
          >
            {/* Brush size selector */}
            {(["S", "M", "L"] as BrushSize[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setBrushSize(s)}
                className={`w-6 h-6 rounded-full border flex items-center justify-center
                           text-[10px] font-mono transition-all ${
                  brushSize === s
                    ? "text-ink"
                    : "border-transparent text-ghost hover:text-ink"
                }`}
                style={brushSize === s ? { borderColor: ACCENT, color: ACCENT } : undefined}
              >
                {s}
              </button>
            ))}

            <span className="w-px h-4 bg-wire mx-0.5" />

            <button
              type="button"
              onClick={handleClear}
              className="px-2 text-[10px] font-mono text-ghost hover:text-ink transition-colors"
            >
              Clear
            </button>

            <span className="w-px h-4 bg-wire mx-0.5" />

            <button
              type="button"
              onClick={cancelEdit}
              className="px-2 text-[10px] font-mono text-ghost hover:text-ink transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="px-3 py-1 rounded-full text-[11px] font-mono text-white"
              style={{ backgroundColor: ACCENT }}
            >
              Apply Edit
            </button>
          </div>
        </>
      )}

      {/* Re-generating overlay — sized to the image, not the container */}
      {loading && (
        <div className="absolute inset-0 bg-canvas/70 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-2.5 bg-panel border border-wire px-4 py-2 rounded-full text-sm text-ghost font-mono">
            <div className="w-3.5 h-3.5 rounded-full border border-sage border-t-transparent animate-spin" />
            Generating next iteration…
          </div>
        </div>
      )}
    </div>
  );
}
