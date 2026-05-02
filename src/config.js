import "dotenv/config";

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const config = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  bucket: process.env.SUPABASE_STORAGE_BUCKET || "videos",
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 5000),
  workDir: process.env.WORK_DIR || "/tmp/hyperframes",
  concurrency: Math.max(1, Number(process.env.CONCURRENCY || 1)),
  renderTimeoutMs: Number(process.env.RENDER_TIMEOUT_MS || 600_000),
};
