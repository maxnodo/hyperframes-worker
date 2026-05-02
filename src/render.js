import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

/**
 * STUB: genera un MP4 dummy con ffmpeg para validar el pipeline.
 *
 * Cuando integremos HyperFrames de verdad, reemplazar el cuerpo de esta
 * función por la llamada al SDK / API de HyperFrames y dejar el resultado
 * final en `outPath`.
 *
 * @param {object} job  Fila de video_jobs (incluye input_data)
 * @param {string} outPath  Ruta donde dejar el .mp4 final
 */
export async function renderWithHyperframes(job, outPath) {
  await mkdir(path.dirname(outPath), { recursive: true });

  const format = job?.input_data?.format ?? "9:16";
  const size = formatToSize(format);
  const text = sanitizeForDrawtext(job?.input_data?.mainText ?? job?.title ?? "Video");

  // Video de 4 segundos, fondo degradado simple + texto centrado.
  const args = [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=0x4F46E5:size=${size}:duration=4:rate=30`,
    "-vf",
    `drawtext=text='${text}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2`,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outPath,
  ];

  await runFfmpeg(args, config.renderTimeoutMs);
  return outPath;
}

function formatToSize(format) {
  switch (format) {
    case "1:1":  return "720x720";
    case "16:9": return "1280x720";
    case "9:16":
    default:     return "720x1280";
  }
}

function sanitizeForDrawtext(s) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .slice(0, 80);
}

function runFfmpeg(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`ffmpeg timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`ffmpeg spawn failed: ${err.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}
