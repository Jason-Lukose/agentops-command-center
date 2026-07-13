import "dotenv/config";
import { Worker, type Job } from "bullmq";
import { prisma } from "../lib/db";
import { getRedisConnection, RUNS_QUEUE_NAME, type RunJobData } from "../lib/queue";
import { executeRun } from "../lib/runner";

const worker = new Worker<RunJobData>(
  RUNS_QUEUE_NAME,
  async (job: Job<RunJobData>) => {
    const { runId } = job.data;
    try {
      await executeRun(runId, { prisma });
    } catch (err) {
      // Defensive top-level guard: executeRun handles its own step-level
      // errors, but if something unexpected escapes it we still want the
      // run to land in a terminal, visible state rather than hang forever.
      console.error(`worker: unhandled error executing run ${runId}:`, err);
      await prisma.run
        .update({
          where: { id: runId },
          data: {
            status: "failed",
            errorMessage: err instanceof Error ? err.message : "Unhandled worker error",
            finishedAt: new Date(),
          },
        })
        .catch((updateErr) => {
          console.error(`worker: failed to mark run ${runId} as failed after unhandled error:`, updateErr);
        });
      throw err;
    }
  },
  { connection: getRedisConnection(), concurrency: 1 }
);

worker.on("completed", (job) => {
  console.log(`worker: run ${job.data.runId} job completed`);
});

worker.on("failed", (job, err) => {
  console.error(`worker: run ${job?.data.runId} job failed:`, err.message);
});

console.log("worker: listening on queue", RUNS_QUEUE_NAME);

async function shutdown(signal: string) {
  console.log(`worker: received ${signal}, shutting down gracefully...`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
