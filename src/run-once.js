import { claimNextPendingJob } from "./jobs.js";
import { processJob } from "./process-job.js";

const job = await claimNextPendingJob();
if (!job) {
  console.log("[run-once] no pending jobs");
  process.exit(0);
}

await processJob(job);
console.log("[run-once] done");
process.exit(0);
