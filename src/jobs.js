import { supabase } from "./supabase.js";

/**
 * Reclama un job pendiente de forma atómica.
 * Devuelve el job si lo conseguimos, o null si no hay ninguno disponible.
 */
export async function claimNextPendingJob() {
  // 1. Buscar el más antiguo pendiente
  const { data: candidates, error: selErr } = await supabase
    .from("video_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (selErr) throw selErr;
  if (!candidates || candidates.length === 0) return null;

  const candidate = candidates[0];

  // 2. Intentar pasarlo a 'rendering' SOLO si sigue 'pending' (claim atómico)
  const { data: claimed, error: updErr } = await supabase
    .from("video_jobs")
    .update({ status: "rendering", error_message: null })
    .eq("id", candidate.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (updErr) throw updErr;
  if (!claimed) return null; // otro worker lo cogió primero

  return claimed;
}

export async function markCompleted(jobId, { storagePath, videoUrl }) {
  const { error } = await supabase
    .from("video_jobs")
    .update({
      status: "completed",
      storage_path: storagePath,
      video_url: videoUrl,
      error_message: null,
    })
    .eq("id", jobId);
  if (error) throw error;
}

export async function markError(jobId, message) {
  const { error } = await supabase
    .from("video_jobs")
    .update({
      status: "error",
      error_message: String(message ?? "Unknown error").slice(0, 2000),
    })
    .eq("id", jobId);
  if (error) {
    // Si ni siquiera podemos marcar el error, lo logueamos pero no relanzamos
    console.error("[worker] failed to mark job as error:", error);
  }
}
