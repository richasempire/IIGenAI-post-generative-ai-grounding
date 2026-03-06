"use client";

import { getImageSrc } from "@/lib/api";

interface Props {
  imageUrl: string | null;
  loading: boolean;
  alt?: string;
}

export default function GeneratedImage({
  imageUrl,
  loading,
  alt = "Generated interior design",
}: Props) {
  if (!imageUrl) return null;

  return (
    <div className="relative h-full w-full flex items-center justify-center">
      <img
        src={getImageSrc(imageUrl)}
        alt={alt}
        className="max-h-full max-w-full object-contain rounded-lg"
      />

      {/* Re-generating overlay */}
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
