import { Queue, type ConnectionOptions } from "bullmq";

// Single Redis connection config shared by the API (producer) and the
// worker (consumer). BullMQ requires maxRetriesPerRequest: null.
// https://docs.bullmq.io/guide/going-to-production#maxretriesperrequest
//
// NOTE: we intentionally pass plain connection options (not a shared IORedis
// instance) — bullmq bundles its own ioredis version, and the top-level
// `ioredis` package's types are structurally incompatible with it, so
// letting each Queue/Worker manage its own connection avoids a type (and
// potential runtime) mismatch between the two ioredis copies.

export function getRedisConnection(): ConnectionOptions {
  return {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
    maxRetriesPerRequest: null,
  };
}

export const RUNS_QUEUE_NAME = "runs";

export interface RunJobData {
  runId: string;
}

const globalForQueue = globalThis as unknown as {
  runsQueue: Queue<RunJobData> | undefined;
};

export function getRunsQueue(): Queue<RunJobData> {
  if (globalForQueue.runsQueue) return globalForQueue.runsQueue;
  const queue = new Queue<RunJobData>(RUNS_QUEUE_NAME, { connection: getRedisConnection() });
  if (process.env.NODE_ENV !== "production") {
    globalForQueue.runsQueue = queue;
  }
  return queue;
}

/** Enqueues a run for the worker to (re)pick up. */
export async function enqueueRun(runId: string): Promise<void> {
  await getRunsQueue().add("run", { runId }, { removeOnComplete: 100, removeOnFail: 100 });
}
