import { describe, expect, it } from 'vitest';
import type { Db } from '../client.js';
import { hashGuestEmail } from './guestAccess.js';
import {
  MESSAGE_RATE_LIMITS,
  blockMessageThread,
  consumeMessageRateLimit,
  isMessageBlocked,
  messageActorKey,
  projectMessageKey,
  reportMessageThread,
} from './messageThreads.js';

type RateRow = {
  id: string;
  scope: 'thread' | 'user' | 'project';
  key_hash: string;
  window_started_at: Date;
  message_count: number;
  created_at: Date;
  updated_at: Date;
};

function rateLimitDb() {
  const rows: RateRow[] = [];
  const db = {
    selectFrom: () => {
      const builder = {
        selectAll: () => builder,
        where: () => builder,
        forUpdate: () => builder,
        execute: async () => rows,
      };
      return builder;
    },
    insertInto: () => {
      let value: RateRow;
      const builder = {
        values: (next: RateRow) => {
          value = next;
          return builder;
        },
        onConflict: (
          callback: (input: {
            columns: () => unknown;
            where: () => unknown;
            doNothing: () => unknown;
          }) => unknown,
        ) => {
          const conflict = {
            columns: () => conflict,
            where: () => conflict,
            doNothing: () => conflict,
          };
          callback(conflict);
          return builder;
        },
        execute: async () => {
          if (!rows.some((row) => row.scope === value.scope && row.key_hash === value.key_hash)) {
            rows.push(value);
          }
        },
      };
      return builder;
    },
    updateTable: () => {
      let values: Partial<RateRow>;
      let id = '';
      const builder = {
        set: (next: Partial<RateRow>) => {
          values = next;
          return builder;
        },
        where: (_column: string, _operator: string, next: string) => {
          id = next;
          return builder;
        },
        execute: async () => {
          const row = rows.find((candidate) => candidate.id === id);
          if (row) Object.assign(row, values);
        },
      };
      return builder;
    },
  };
  return { db: db as unknown as Db, rows };
}

describe('message thread moderation primitives', () => {
  it('keeps actor and project buckets opaque and separate', () => {
    const guestHash = hashGuestEmail('guest@example.com');
    expect(messageActorKey({ kind: 'guest', emailHash: guestHash })).toHaveLength(64);
    expect(messageActorKey({ kind: 'guest', emailHash: guestHash })).not.toContain(
      'guest@example.com',
    );
    expect(messageActorKey({ kind: 'user', userId: 'user-a' })).not.toBe(
      messageActorKey({ kind: 'user', userId: 'user-b' }),
    );
    expect(projectMessageKey('project-a')).not.toBe(projectMessageKey('project-b'));
  });

  it('applies durable thread, actor, and project buckets', async () => {
    const { db, rows } = rateLimitDb();
    const now = new Date('2026-08-29T12:00:00.000Z');
    const input = {
      threadId: 'thread-a',
      projectId: 'project-a',
      actor: { kind: 'user' as const, userId: 'user-a' },
    };
    expect(await consumeMessageRateLimit(db, { ...input, now })).toMatchObject({ allowed: true });
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.message_count === 1)).toBe(true);

    for (let count = 1; count < MESSAGE_RATE_LIMITS.thread.limit; count += 1) {
      expect(await consumeMessageRateLimit(db, { ...input, now })).toMatchObject({ allowed: true });
    }
    await expect(consumeMessageRateLimit(db, { ...input, now })).resolves.toMatchObject({
      allowed: false,
      scope: 'thread',
    });
    expect(
      await consumeMessageRateLimit(db, { ...input, now: new Date('2026-08-29T12:10:00.001Z') }),
    ).toMatchObject({
      allowed: true,
    });
  });

  it('deduplicates block and report records without accepting unsafe report text', async () => {
    const blockRows: unknown[] = [];
    const db = {
      insertInto: (table: string) => {
        let value: Record<string, unknown>;
        const builder = {
          values: (next: Record<string, unknown>) => {
            value = next;
            return builder;
          },
          onConflict: (
            callback: (input: {
              columns: () => unknown;
              where: () => unknown;
              doNothing: () => unknown;
            }) => unknown,
          ) => {
            const conflict = {
              columns: () => conflict,
              where: () => conflict,
              doNothing: () => conflict,
            };
            callback(conflict);
            return builder;
          },
          returningAll: () => builder,
          returning: () => builder,
          executeTakeFirst: async () => {
            if (table === 'message_block') {
              const duplicate = blockRows.some(
                (row) =>
                  (row as Record<string, unknown>).project_id === value.project_id &&
                  (row as Record<string, unknown>).thread_id === value.thread_id &&
                  (row as Record<string, unknown>).blocker_key_hash === value.blocker_key_hash &&
                  (row as Record<string, unknown>).blocked_key_hash === value.blocked_key_hash,
              );
              if (!duplicate) blockRows.push(value);
              return duplicate ? undefined : value;
            }
            return { id: 'report-a' };
          },
        };
        return builder;
      },
      selectFrom: () => {
        const builder = {
          select: () => builder,
          where: () => builder,
          executeTakeFirst: async () => (blockRows.length > 0 ? { id: 'block-a' } : undefined),
        };
        return builder;
      },
    };
    const typedDb = db as unknown as Db;
    const block = {
      projectId: 'project-a',
      threadId: 'thread-a',
      blockerKey: 'actor-a',
      blockedKey: 'actor-b',
    };
    expect((await blockMessageThread(typedDb, block)).blocked).toBe(true);
    expect((await blockMessageThread(typedDb, block)).blocked).toBe(true);
    await expect(
      isMessageBlocked(typedDb, {
        ...block,
        actorKey: block.blockerKey,
        targetKey: block.blockedKey,
      }),
    ).resolves.toBe(true);
    await expect(
      reportMessageThread(typedDb, {
        projectId: 'project-a',
        threadId: 'thread-a',
        reporterKey: 'actor-a',
        reason: 'Please review this conversation',
      }),
    ).resolves.toMatchObject({ created: true });
    await expect(
      reportMessageThread(typedDb, {
        projectId: 'project-a',
        threadId: 'thread-a',
        reporterKey: 'actor-a',
        reason: 'https://unsafe.example',
      }),
    ).rejects.toThrow('Report reason is invalid');
  });
});
