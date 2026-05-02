import path from "node:path";
import { rm } from "node:fs/promises";
import { config } from "./config.js";
import { markCompleted, markError } from "./jobs.js";
import { renderWithHyperframes } from "./render.js";
import { uploadVideo } from "./storage.js";

export async function processJob(job) {
  const outPath = path.join(config.workDir, job.id, "out.mp4");
  console.log(`[worker] ▶ rendering job ${job.id} (${job.title})`);

  try {
    await renderWithHyperframes(job, outPath);
    const { storagePath, publicUrl } = await uploadVideo(outPath, job.id);
    await markCompleted(job.id, { storagePath, videoUrl: publicUrl });
    console.log(`[worker] ✓ completed job ${job.id} → ${storagePath}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[worker] ✗ job ${job.id} failed: ${msg}`);
    await markError(job.id, msg);
  } finally {
    // Limpieza local
    rm(path.dirname(outPath), { recursive: true, force: true }).catch(() => {});
  }
}
