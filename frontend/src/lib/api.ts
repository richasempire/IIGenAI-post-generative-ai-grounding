const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────────────

export interface GroundedMaterial {
  name: string;
  description: string;
  confidence: number;
  flag: "green" | "yellow" | "red";
  co2e_value: number | null;
  co2e_unit: string | null;
  database_match: string | null;
  requires_human_review: boolean;
}

export interface Iteration {
  iteration_number: number;
  prompt: string;
  image_url: string; // path like /api/image/{session_id}/{n}
  materials: GroundedMaterial[];
  timestamp: string;
  total_co2e: number | null;
}

export interface GenerateResponse {
  session_id: string;
  current_iteration: Iteration;
  history: Iteration[]; // previous iterations, oldest first
  human_review_needed: boolean;
}

export type RoomType = "office" | "living_room" | "patient_room" | "free_flowing";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve a relative image_url path to a full URL */
export function getImageSrc(imageUrl: string): string {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("http")) return imageUrl;
  return `${API_BASE}${imageUrl}`;
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function generateDesign(
  prompt: string,
  roomType: RoomType,
  sessionId?: string,
  username?: string,
): Promise<GenerateResponse> {
  const body: Record<string, string> = {
    prompt,
    room_type: roomType,
    username: username ?? "anonymous",
  };
  if (sessionId) body.session_id = sessionId;

  const res = await fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function getAllSessions(
  username: string,
): Promise<Record<string, Iteration[]>> {
  const res = await fetch(
    `${API_BASE}/api/sessions/${encodeURIComponent(username)}`,
  );
  if (!res.ok) return {};
  return res.json();
}
