import { describe, expect, it, vi } from 'vitest';
import { JOB_LEASE_TIMEOUT_MS, type Job } from '@oss-tips/db';
import { processJob } from './process-job.js';

const job = {
  id: 'job_123',
  queue: 'exports',
  kind: 'project.export',
  payload: {},
} as Job;

describe('processJob', () => {
  it('completes only after handler side effect resolves', async () => {
    const events: string[] = [];
    const jobs = {
      complete: vi.fn(async () => {
        events.push('complete');
      }),
      fail: vi.fn(),
      renewLease: vi.fn(async () => ({})),
    };
    await processJob(
      jobs as never,
      job,
      {
        'project.export': async () => {
          await Promise.resolve();
          events.push('side-effect');
        },
      },
      'worker-test',
    );
    expect(events).toEqual(['side-effect', 'complete']);
    expect(jobs.fail).not.toHaveBeenCalled();
  });

  it('does not acknowledge failed side effects', async () => {
    const jobs = {
      complete: vi.fn(),
      fail: vi.fn(async () => ({ status: 'pending' })),
      renewLease: vi.fn(async () => ({})),
    };
    await processJob(
      jobs as never,
      job,
      {
        'project.export': async () => {
          throw new Error('storage unavailable');
        },
      },
      'worker-test',
    );
    expect(jobs.complete).not.toHaveBeenCalled();
    expect(jobs.fail).toHaveBeenCalledWith(
      'job_123',
      'storage unavailable',
      undefined,
      'worker-test',
    );
  });

  it('renews a long-running lease and stops after completion', async () => {
    vi.useFakeTimers();
    try {
      let release!: () => void;
      const work = new Promise<void>((resolve) => {
        release = resolve;
      });
      const jobs = {
        complete: vi.fn(async () => ({ status: 'completed' })),
        fail: vi.fn(),
        renewLease: vi.fn(async () => ({ status: 'processing' })),
      };
      const processing = processJob(
        jobs as never,
        job,
        { 'project.export': async () => work },
        'worker-test',
      );

      await vi.advanceTimersByTimeAsync(Math.floor(JOB_LEASE_TIMEOUT_MS / 2));
      expect(jobs.renewLease).toHaveBeenCalledTimes(1);
      release();
      await processing;
      await vi.advanceTimersByTimeAsync(JOB_LEASE_TIMEOUT_MS);
      expect(jobs.renewLease).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
