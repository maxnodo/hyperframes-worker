import { readFile } from "node:fs/promises";
import { supabase } from "./supabase.js";
import { config } from "./config.js";

/**
 * Sube un archivo local al bucket configurado.
 * Devuelve { storagePath, publicUrl } — publicUrl solo es útil si el bucket es público.
 * Para bucket privado el frontend debe pedir signed URLs.
 */
export async function uploadVideo(localPath, jobId) {
  const buf = await readFile(localPath);
  const storagePath = `${jobId}/${Date.now()}.mp4`;

  const { error } = await supabase.storage
    .from(config.bucket)
    .upload(storagePath, buf, {
      contentType: "video/mp4",
      cacheControl: "3600",
      upsert: true,
    });

  if (error) throw new Error(`storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(config.bucket).getPublicUrl(storagePath);
  return { storagePath, publicUrl: data?.publicUrl ?? null };
}
