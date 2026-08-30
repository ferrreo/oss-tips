import { describe, expect, it, vi } from 'vitest';
import {
  enqueueRetentionMaintenanceJobs,
  enqueueStorageMaintenanceJobs,
  workerQueuePlan,
} from './worker-runtime.js';

describe('worker queue plan', () => {
  it('isolates OTP processing and skips general dispatch work', () => {
    expect(workerQueuePlan('otp')).toEqual({
      queues: ['otp'],
      otpOnly: true,
      runDispatchPrework: false,
    });
  });

  it('removes OTP from general workers, including accidental mixed configuration', () => {
    expect(workerQueuePlan('default, otp, exports')).toEqual({
      queues: ['default', 'exports'],
      otpOnly: false,
      runDispatchPrework: true,
    });
  });

  it('uses the general queue set when configuration is empty', () => {
    expect(workerQueuePlan('')).toEqual({
      queues: ['default', 'exports', 'domains'],
      otpOnly: false,
      runDispatchPrework: true,
    });
  });

  it('enqueues one stable daily job for each storage maintenance task', async () => {
    const jobs = {
      enqueueIfAbsent: vi.fn(async (job: { id: string; kind: string }) => {
        void job;
        return undefined;
      }),
    };
    const now = new Date('2026-08-30T12:00:00.000Z');

    await enqueueStorageMaintenanceJobs(jobs as never, now);
    await enqueueStorageMaintenanceJobs(jobs as never, now);

    expect(jobs.enqueueIfAbsent).toHaveBeenCalledTimes(6);
    const firstRun = jobs.enqueueIfAbsent.mock.calls.slice(0, 3).map(([job]) => job);
    const secondRun = jobs.enqueueIfAbsent.mock.calls.slice(3).map(([job]) => job);
    expect(firstRun.map(({ kind }) => kind)).toEqual([
      'storage.inventory',
      'storage.cleanup_exports',
      'storage.purge_media',
    ]);
    expect(firstRun.map(({ id }) => id)).toEqual(secondRun.map(({ id }) => id));
  });

  it('enqueues one stable daily job for each retention task', async () => {
    const jobs = {
      enqueueIfAbsent: vi.fn(async (job: { id: string; kind: string }) => {
        void job;
        return undefined;
      }),
    };
    const now = new Date('2026-08-30T12:00:00.000Z');

    await enqueueRetentionMaintenanceJobs(jobs as never, now);
    await enqueueRetentionMaintenanceJobs(jobs as never, now);

    expect(jobs.enqueueIfAbsent).toHaveBeenCalledTimes(10);
    const firstRun = jobs.enqueueIfAbsent.mock.calls.slice(0, 5).map(([job]) => job);
    const secondRun = jobs.enqueueIfAbsent.mock.calls.slice(5).map(([job]) => job);
    expect(firstRun.map(({ kind }) => kind)).toEqual([
      'retention.verification',
      'retention.otp_limits',
      'retention.analytics',
      'retention.security_ip',
      'retention.api_rate_limits',
    ]);
    expect(firstRun.map(({ id }) => id)).toEqual(secondRun.map(({ id }) => id));
  });
});
