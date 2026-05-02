import { readFile } from "node:fs/promises";
import { supabase } from "./supabase.js";

const STORAGE_BUCKET = "videos";

/**
 * Sube un archivo local al bucket videos.
 * Devuelve { storagePath, publicUrl } — publicUrl solo es útil si el bucket es público.
 * Para bucket privado el frontend debe pedir signed URLs.
 */
export async function uploadVideo(localPath, jobId) {
  const buf = await readFile(localPath);
  const storagePath = `renders/${jobId}.mp4`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buf, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (error) throw new Error(`storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return { storagePath, publicUrl: data?.publicUrl ?? null };
}
