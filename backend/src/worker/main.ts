/**
 * LUMIO background worker.
 *
 * One pass of the loop:
 *
 *   enqueue_replenish_jobs   — reconciliation: every onboarded user below
 *                              three queued lessons gets a generation job
 *   claim_jobs               — atomically take due jobs (SKIP LOCKED)
 *   dispatch                 — run generate_lesson for the job's user
 *   complete_job / fail_job / dead_letter_job
 *
 * Failures retry with backoff up to max_attempts; insufficient library
 * material is terminal on the first attempt (dead-letter) so the queue does
 * not churn. Run with `npm run worker` (or `npm run worker -- --once` for a
 * single pass), with backend/.env present.
 */
import { hostname } from 'node:os';
import { pathToFileURL } from 'node:url';
import { loadBackendEnv, type BackendConfig } from '../env.ts';
import { getSupabaseAdmin } from '../supabase-admin.ts';
import { InsufficientMaterialError, generateLessonForUser } from '../lessons/generate.ts';

const CLAIM_BATCH = 2;

type JobRow = {
  id: string;
  job_type: string;
  payload: Record<string, unknown> | null;
  checkpoint: Record<string, unknown> | null;
  attempts: number;
};

function log(message: string): void {
  const stamp = new Date().toISOString().slice(11, 19);
  console.log(`[worker ${stamp}] ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function asJobRow(value: unknown): JobRow | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id),
    job_type: String(row.job_type ?? ''),
    payload: typeof row.payload === 'object' && row.payload !== null
      ? (row.payload as Record<string, unknown>)
      : null,
    checkpoint: typeof row.checkpoint === 'object' && row.checkpoint !== null
      ? (row.checkpoint as Record<string, unknown>)
      : null,
    attempts: typeof row.attempts === 'number' ? row.attempts : 0,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Run one dispatch pass. Returns how many jobs were processed. */
export async function runOnce(config: BackendConfig, workerId: string): Promise<number> {
  const admin = getSupabaseAdmin(config);

  const enqueueResult = await admin.rpc('enqueue_replenish_jobs', { p_limit: 20 });
  if (enqueueResult.error) {
    log(`enqueue_replenish_jobs failed: ${enqueueResult.error.message}`);
  } else if (typeof enqueueResult.data === 'number' && enqueueResult.data > 0) {
    log(`enqueued ${enqueueResult.data} replenishment job(s)`);
  }

  const claimResult = await admin.rpc('claim_jobs', { p_worker: workerId, p_limit: CLAIM_BATCH });
  if (claimResult.error) {
    log(`claim_jobs failed: ${claimResult.error.message}`);
    return 0;
  }
  const jobs = (Array.isArray(claimResult.data) ? claimResult.data : [])
    .map(asJobRow)
    .filter((job): job is JobRow => job !== null);

  if (jobs.length === 0) {
    return 0;
  }

  for (const job of jobs) {
    log(`claimed ${job.job_type} ${job.id} (attempt ${job.attempts})`);
    try {
      if (job.job_type !== 'generate_lesson') {
        await admin.rpc('fail_job', {
          p_job_id: job.id,
          p_error: `Unsupported job type "${job.job_type}" for this worker.`,
        });
        log(`failed ${job.id}: unsupported job type`);
        continue;
      }
      const userId = typeof job.payload?.user_id === 'string' ? job.payload.user_id : null;
      if (!userId) {
        await admin.rpc('dead_letter_job', {
          p_job_id: job.id,
          p_reason: 'generate_lesson payload is missing user_id.',
        });
        log(`dead-lettered ${job.id}: missing user_id`);
        continue;
      }

      const result = await generateLessonForUser(
        {
          admin,
          ollama: {
            baseUrl: config.ollamaBaseUrl,
            model: config.ollamaModel,
            timeoutMs: config.ollamaTimeoutMs,
          },
          workerId,
          jobId: job.id,
          checkpoint: job.checkpoint,
          log: (message: string) => log(`[job ${job.id}] ${message}`),
        },
        userId,
      );

      const completeResult = await admin.rpc('complete_job', { p_job_id: job.id });
      if (completeResult.error) {
        log(`complete_job failed for ${job.id}: ${completeResult.error.message}`);
      } else {
        log(`succeeded ${job.id} (lesson ${result.lessonId}${result.created ? '' : ', resumed'})`);
      }
    } catch (error) {
      if (error instanceof InsufficientMaterialError) {
        const reason = errorMessage(error);
        const deadResult = await admin.rpc('dead_letter_job', {
          p_job_id: job.id,
          p_reason: reason,
        });
        if (deadResult.error) {
          log(`dead_letter_job failed for ${job.id}: ${deadResult.error.message}`);
        }
        log(`dead-lettered ${job.id}: ${reason}`);
        continue;
      }
      const message = errorMessage(error);
      const failResult = await admin.rpc('fail_job', { p_job_id: job.id, p_error: message });
      if (failResult.error) {
        log(`fail_job failed for ${job.id}: ${failResult.error.message}`);
      } else {
        log(`failed ${job.id} (${String(failResult.data)}): ${message}`);
      }
    }
  }
  return jobs.length;
}

async function main(): Promise<void> {
  const once = process.argv.includes('--once');
  const config = loadBackendEnv();
  const workerId = `worker-${hostname()}-${process.pid}`;

  let stopping = false;
  const stop = (signal: string): void => {
    if (!stopping) {
      stopping = true;
      log(`received ${signal}; finishing the current pass and exiting`);
    }
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));

  log(`started as ${workerId} (model ${config.ollamaModel}, poll ${config.workerPollMs}ms)`);
  log(`supabase ${config.supabaseUrl}, ollama ${config.ollamaBaseUrl}`);

  do {
    try {
      await runOnce(config, workerId);
    } catch (error) {
      log(`pass failed: ${errorMessage(error)}`);
    }
    if (!once && !stopping) {
      await sleep(config.workerPollMs);
    }
  } while (!once && !stopping);

  log('stopped');
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch(error => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  });
}
