import { Queue } from "bullmq";
import { getBullConnection } from "@/src/redis/client";
import { IMAGE_QUEUE, type ProcessImageJob } from "@/src/queue/jobs/image";
import { EMAIL_QUEUE, type SendEmailJob } from "@/src/queue/jobs/email";
import { ZIP_QUEUE, type BuildZipJob } from "@/src/queue/jobs/zip";

// Factory keeps the variable's type exactly equal to the constructor's return
// type, avoiding BullMQ's generic-default inference mismatch.
function createImageQueue() {
  return new Queue<ProcessImageJob>(IMAGE_QUEUE, {
    connection: getBullConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });
}

// Lazily constructed so importing this module (e.g. during build) does not open
// a Redis connection.
let imageQueue: ReturnType<typeof createImageQueue> | undefined;

export function getImageQueue() {
  imageQueue ??= createImageQueue();
  return imageQueue;
}

function createEmailQueue() {
  return new Queue<SendEmailJob>(EMAIL_QUEUE, {
    connection: getBullConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });
}

let emailQueue: ReturnType<typeof createEmailQueue> | undefined;

export function getEmailQueue() {
  emailQueue ??= createEmailQueue();
  return emailQueue;
}

function createZipQueue() {
  return new Queue<BuildZipJob>(ZIP_QUEUE, {
    connection: getBullConnection(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 500,
      removeOnFail: 1000,
    },
  });
}

let zipQueue: ReturnType<typeof createZipQueue> | undefined;

export function getZipQueue() {
  zipQueue ??= createZipQueue();
  return zipQueue;
}
