import { config } from "./config.js";
import { claimNextPendingJob } from "./jobs.js";
import { processJob } from "./process-job.js";

let stopping = false;
process.on("SIGINT",  () => { console.log("\n[worker] SIGINT received, stopping…");  stopping = true; });
process.on("SIGTERM", () => { console.log("\n[worker] SIGTERM received, stopping…"); stopping = true; });

async function workerLoop(workerId) {
  while (!stopping) {
    try {
      const job = await claimNextPendingJob();
      if (!job) {
        await sleep(config.pollIntervalMs);
        continue;
      }
      await processJob(job);
    } catch (err) {
      console.error(`[worker#${workerId}] loop error:`, err);
      await sleep(config.pollIntervalMs);
    }
  }
  console.log(`[worker#${workerId}] stopped.`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

console.log(`[worker] starting hyperframes-worker`);
console.log(`[worker]   bucket=${config.bucket} concurrency=${config.concurrency} poll=${config.pollIntervalMs}ms`);

const loops = Array.from({ length: config.concurrency }, (_, i) => workerLoop(i + 1));
await Promise.all(loops);
