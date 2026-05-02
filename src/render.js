import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

const HYPERFRAMES_COMPOSITION_ID = "hyperframes-worker-video";

/**
 * Renderiza un video HyperFrames real a partir de input_data.
 *
 * @param {object} job Fila de video_jobs (incluye input_data)
 * @param {string} outPath Ruta donde dejar el .mp4 final
 */
export async function renderWithHyperframes(job, outPath) {
  console.log("[render] starting hyperframes render");
  console.log("[render] job:", job.id);

  await mkdir(path.dirname(outPath), { recursive: true });

  const input = normalizeInput(job);
  console.log("final content:", input);
  const { width, height } = formatToSize(input.format);
  const duration = calculateDuration(input.scenes.length);
  const projectDir = path.join(path.dirname(outPath), "hyperframes-project");

  await rm(projectDir, { recursive: true, force: true });
  await mkdir(projectDir, { recursive: true });
  await writeFile(
    path.join(projectDir, "index.html"),
    buildCompositionHtml({ ...input, width, height, duration }),
    "utf8",
  );

  await runHyperframesRender(projectDir, outPath, config.renderTimeoutMs);

  console.log("[render] completed:", outPath);
  return outPath;
}

function normalizeInput(job) {
  const data = job?.input_data ?? {};
  const promptContent = data.prompt && !data.mainText
    ? parsePromptToScenes(data.prompt)
    : {};
  const mainText = cleanText(data.mainText ?? promptContent.mainText ?? job?.title ?? "Video");
  const subText = cleanText(data.subText ?? promptContent.subText ?? "");
  const scenes = normalizeScenes(data.scenes ?? promptContent.scenes);

  return {
    mainText,
    subText,
    imageNames: normalizeImageNames(data.imageNames),
    scenes,
    format: data.format ?? "9:16",
  };
}

function parsePromptToScenes(prompt) {
  const cleaned = cleanPrompt(prompt);
  const explicitScenes = [...cleaned.matchAll(/(?:^|\s)(?:escena|scene|slide)\s*\d*\s*[:.-]\s*([^.!?]+[.!?]?)/gi)]
    .map((match) => toSceneText(match[1]))
    .filter(Boolean);
  const sentences = cleaned
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const candidates = sentences.length > 0 ? sentences : cleaned.split(/[,;]+/);
  const sceneTexts = (explicitScenes.length > 0 ? explicitScenes : candidates)
    .map((part) => toSceneText(part))
    .filter((part) => !isPromptInstruction(part))
    .filter(Boolean)
    .slice(0, 5);
  const fallbackScenes = sceneTexts.length > 0
    ? sceneTexts
    : ["Idea principal", "Mensaje clave", "Cierre"];

  return {
    mainText: toHeadline(fallbackScenes[0]),
    subText: fallbackScenes[1] ? toCaption(fallbackScenes[1]) : "",
    scenes: fallbackScenes.map((text) => ({
      text,
      duration: 2.5,
    })),
  };
}

function normalizeScenes(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((scene) => {
      if (typeof scene === "string") {
        return { text: cleanText(scene).slice(0, 90), duration: 2.5 };
      }
      return {
        text: cleanText(scene?.text).slice(0, 90),
        duration: normalizeDuration(scene?.duration),
      };
    })
    .filter((scene) => scene.text)
    .slice(0, 6);
}

function normalizeDuration(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration)) return 2.5;
  return Math.min(6, Math.max(1.5, duration));
}

function normalizeImageNames(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, 6);
}

function formatToSize(format) {
  switch (format) {
    case "1:1":
      return { width: 1080, height: 1080 };
    case "16:9":
      return { width: 1280, height: 720 };
    case "9:16":
    default:
      return { width: 720, height: 1280 };
  }
}

function calculateDuration(scenesCount) {
  return scenesCount > 0 ? 5 + scenesCount * 2.5 : 8;
}

function buildCompositionHtml({ mainText, subText, imageNames, scenes: contentScenes, width, height, duration }) {
  const scenes = buildScenes({ mainText, subText, imageNames, contentScenes });
  const sceneMarkup = scenes
    .map((scene, index) => buildSceneMarkup(scene, index, width, height, duration))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        background: #0b1020;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #root {
        position: relative;
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        color: #f8fafc;
        background:
          radial-gradient(circle at 18% 18%, rgba(45, 212, 191, 0.34), transparent 34%),
          radial-gradient(circle at 80% 12%, rgba(250, 204, 21, 0.22), transparent 28%),
          linear-gradient(145deg, #101827 0%, #111827 48%, #271533 100%);
      }
      .scene {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        padding: ${Math.round(Math.min(width, height) * 0.08)}px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: ${Math.round(Math.min(width, height) * 0.035)}px;
        opacity: 0;
      }
      #scene-0 { opacity: 1; }
      .kicker {
        width: max-content;
        max-width: 100%;
        padding: 10px 16px;
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 999px;
        color: #67e8f9;
        font-size: ${Math.max(20, Math.round(width * 0.026))}px;
        font-weight: 700;
        letter-spacing: 0;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        max-width: 100%;
        color: #ffffff;
        font-size: ${Math.max(54, Math.round(width * 0.11))}px;
        line-height: 0.96;
        letter-spacing: 0;
      }
      .caption {
        margin: 0;
        max-width: 88%;
        color: #dbeafe;
        font-size: ${Math.max(26, Math.round(width * 0.042))}px;
        line-height: 1.22;
      }
      .image-frame {
        width: 100%;
        min-height: 46%;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 28px;
        overflow: hidden;
        background: rgba(15, 23, 42, 0.58);
        box-shadow: 0 28px 90px rgba(0, 0, 0, 0.34);
      }
      .image-frame img {
        width: 100%;
        height: 100%;
        min-height: ${Math.round(height * 0.42)}px;
        object-fit: cover;
        display: block;
      }
      .image-label {
        min-height: ${Math.round(height * 0.42)}px;
        display: grid;
        place-items: center;
        padding: 42px;
        text-align: center;
        font-size: ${Math.max(36, Math.round(width * 0.072))}px;
        font-weight: 800;
        line-height: 1.05;
        background:
          linear-gradient(135deg, rgba(20, 184, 166, 0.28), rgba(59, 130, 246, 0.24)),
          rgba(15, 23, 42, 0.88);
      }
      .slide-title {
        margin: 0;
        color: #ffffff;
        font-size: ${Math.max(36, Math.round(width * 0.063))}px;
        line-height: 1.05;
      }
      .accent {
        position: absolute;
        right: -12%;
        bottom: -10%;
        width: 46%;
        aspect-ratio: 1;
        border-radius: 50%;
        background: rgba(45, 212, 191, 0.17);
        filter: blur(12px);
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="${HYPERFRAMES_COMPOSITION_ID}"
      data-width="${width}"
      data-height="${height}"
      data-start="0"
      data-duration="${duration}"
    >
      ${sceneMarkup}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });
      var scenes = ${JSON.stringify(scenes.map((_, index) => `#scene-${index}`))};
      var sceneDuration = ${duration / scenes.length};

      scenes.forEach(function(selector, index) {
        var start = index * sceneDuration;
        if (index > 0) {
          tl.to(selector, { opacity: 1, duration: 0.45, ease: "power2.out" }, start);
        }
        tl.from(selector + " .content > *", {
          y: 36,
          opacity: 0,
          duration: 0.65,
          stagger: 0.11,
          ease: "power3.out"
        }, start + 0.18);
        tl.to(selector + " .content", {
          y: -18,
          duration: sceneDuration - 0.6,
          ease: "none"
        }, start + 0.2);
        if (index < scenes.length - 1) {
          tl.to(selector, { opacity: 0, duration: 0.38, ease: "power2.in" }, start + sceneDuration - 0.38);
        }
      });

      window.__timelines["${HYPERFRAMES_COMPOSITION_ID}"] = tl;
    </script>
  </body>
</html>
`;
}

function buildScenes({ mainText, subText, imageNames, contentScenes }) {
  const scenes = [
    {
      type: "title",
      kicker: "HyperFrames Render",
      title: mainText,
      caption: subText || "Generated automatically from your video job.",
    },
  ];

  const maxScenes = Math.max(imageNames.length, contentScenes.length);
  for (let index = 0; index < maxScenes; index += 1) {
    const imageName = imageNames[index];
    const contentScene = contentScenes[index];
    scenes.push({
      type: imageName ? "image" : "text",
      kicker: `Slide ${index + 1}`,
      title: contentScene?.text ?? mainText,
      caption: subText,
      imageName,
      duration: contentScene?.duration,
    });
  }

  if (maxScenes === 0) {
    scenes.push({
      type: "title",
      kicker: "Ready",
      title: mainText,
      caption: subText || "No image assets were provided for this job.",
    });
  }

  return scenes;
}

function buildSceneMarkup(scene, index) {
  const imageMarkup = scene.type === "image" ? buildImageMarkup(scene.imageName) : "";
  return `<section id="scene-${index}" class="scene">
        <div class="accent"></div>
        <div class="content">
          <div class="kicker">${escapeHtml(scene.kicker)}</div>
          ${imageMarkup}
          <h1 class="${scene.type === "image" ? "slide-title" : ""}">${escapeHtml(scene.title)}</h1>
          ${scene.caption ? `<p class="caption">${escapeHtml(scene.caption)}</p>` : ""}
        </div>
      </section>`;
}

function buildImageMarkup(imageName) {
  if (isRenderableImageSource(imageName)) {
    return `<div class="image-frame"><img src="${escapeAttribute(imageName)}" alt="" /></div>`;
  }
  return `<div class="image-frame"><div class="image-label">${escapeHtml(imageName)}</div></div>`;
}

function isRenderableImageSource(value) {
  return /^(https?:\/\/|data:image\/|file:\/\/|\/)/i.test(value);
}

function cleanText(value) {
  return String(value ?? "").trim().slice(0, 240);
}

function cleanPrompt(value) {
  return String(value ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toHeadline(value) {
  return toSceneText(value).slice(0, 64) || "Video";
}

function toCaption(value) {
  return toSceneText(value).slice(0, 96);
}

function toSceneText(value) {
  return String(value ?? "")
    .replace(/^(objetivo|contexto|instrucciones|prompt|escena|scene|slide)\s*[:.-]\s*/i, "")
    .replace(/^(crear|generar|hacer|producir|renderizar)\s+(un|una)\s+video\s+/i, "")
    .replace(/^[\s#>*\-–—\d.)]+/, "")
    .trim()
    .slice(0, 90);
}

function isPromptInstruction(value) {
  return /^(crear|generar|hacer|producir|renderizar|necesito|quiero)\b/i.test(value)
    || /\b(no deben aparecer|instrucciones internas|prompt completo)\b/i.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function runHyperframesRender(projectDir, outPath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const args = [
      "hyperframes",
      "render",
      "--output",
      outPath,
      "--quality",
      "standard",
      "--fps",
      "30",
      "--workers",
      "1",
      "--no-browser-gpu",
    ];

    const child = spawn("npx", args, {
      cwd: projectDir,
      env: {
        ...process.env,
        CI: "1",
        PUPPETEER_CACHE_DIR: path.join(config.workDir, ".puppeteer-cache"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`hyperframes timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`hyperframes spawn failed: ${err.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`hyperframes exited with code ${code}: ${(stderr || stdout).slice(-1200)}`));
    });
  });
}
