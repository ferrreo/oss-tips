import { describe, expect, it } from 'vitest';
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import type { Db, Database } from '../index.js';
import { createEmailDeliveriesRepository, withEmailSuppressionLock } from './emailDeliveries.js';

function recordingDb(options: {
  delivery?: Record<string, unknown>;
  events?: Record<string, unknown>[];
  eventInserted?: boolean;
  suppression?: Record<string, unknown>;
}): { db: Db; queries: string[] } {
  const queries: string[] = [];
  const connection = {
    async executeQuery(query: { sql: string }) {
      queries.push(query.sql);
      if (query.sql.includes('from "email_delivery"')) {
        return { rows: options.delivery ? [options.delivery] : [] };
      }
      if (query.sql.includes('from "email_suppression"')) {
        return { rows: options.suppression ? [options.suppression] : [] };
      }
      if (query.sql.includes('from "email_delivery_event"')) {
        return { rows: options.events ?? [] };
      }
      if (query.sql.includes('insert into "email_delivery_event"')) {
        return { rows: options.eventInserted === false ? [] : [{ id: 'event-1' }] };
      }
      return { rows: [] };
    },
    async *streamQuery() {
      yield { rows: [] };
    },
  };
  const driver = {
    async init() {},
    async acquireConnection() {
      return connection;
    },
    async beginTransaction() {},
    async commitTransaction() {},
    async rollbackTransaction() {},
    async releaseConnection() {},
    async destroy() {},
  };
  const db = new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver as never,
      createIntrospector: (database) => new PostgresIntrospector(database),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
  return { db: db as unknown as Db, queries };
}

const event = {
  providerEventId: 'evt-1',
  providerEmailId: 'email-1',
  eventType: 'email.delivered',
  status: 'delivered' as const,
  occurredAt: new Date('2026-08-30T12:00:00.000Z'),
  now: new Date('2026-08-30T12:01:00.000Z'),
};

describe('email delivery repository', () => {
  it('matches provider id, applies lifecycle status and deduplicates provider events', async () => {
    const { db, queries } = recordingDb({
      delivery: { id: 'delivery-1', status: 'sent', sent_at: null },
    });

    await expect(createEmailDeliveriesRepository(db).recordProviderEvent(event)).resolves.toEqual({
      created: true,
      deliveryId: 'delivery-1',
      statusApplied: true,
    });

    const sql = queries.join('\n');
    expect(sql).toContain('for update');
    expect(sql).toContain('insert into "email_delivery_event"');
    expect(sql).toContain('on conflict ("provider_event_id") do nothing');
    expect(sql).toContain('update "email_delivery"');
    await db.destroy();
  });

  it('returns duplicate without applying a terminal status again', async () => {
    const { db, queries } = recordingDb({
      delivery: { id: 'delivery-1', status: 'delivered', sent_at: event.occurredAt },
      eventInserted: false,
    });

    await expect(createEmailDeliveriesRepository(db).recordProviderEvent(event)).resolves.toEqual({
      created: false,
      deliveryId: 'delivery-1',
      statusApplied: false,
    });
    expect(queries.join('\n')).not.toContain('update "email_delivery"');
    await db.destroy();
  });

  it('does not replay a duplicate event or suppression side effect', async () => {
    const state = {
      delivery: { id: 'delivery-1', status: 'sent', sent_at: null },
      eventInserted: true,
    };
    const { db, queries } = recordingDb(state);

    await expect(
      createEmailDeliveriesRepository(db).recordProviderEvent({
        ...event,
        status: 'sent',
      }),
    ).resolves.toMatchObject({ created: true });

    state.eventInserted = false;
    const replayStart = queries.length;
    await expect(
      createEmailDeliveriesRepository(db).recordProviderEvent({
        ...event,
        status: 'bounced',
        suppression: { reason: 'bounce', emailAddresses: ['person@example.com'] },
      }),
    ).resolves.toEqual({
      created: false,
      deliveryId: 'delivery-1',
      statusApplied: false,
    });

    const replayQueries = queries.slice(replayStart).join('\n');
    expect(replayQueries).toContain('pg_advisory_xact_lock');
    expect(replayQueries).not.toContain('update "email_delivery"');
    expect(replayQueries).not.toContain('insert into "email_suppression"');
    await db.destroy();
  });

  it('normalizes suppression lookups', async () => {
    const { db, queries } = recordingDb({ suppression: { email_address: 'person@example.com' } });

    await expect(
      createEmailDeliveriesRepository(db).isSuppressed(' Person@Example.com '),
    ).resolves.toBe(true);
    expect(queries.join('\n')).toContain('from "email_suppression"');
    await db.destroy();
  });

  it('holds a transaction-scoped lock for the guarded delivery operation', async () => {
    const { db, queries } = recordingDb({});

    await expect(
      withEmailSuppressionLock(db, ' Person@Example.com ', async () => 'complete'),
    ).resolves.toBe('complete');

    expect(queries[0]).toContain('pg_advisory_xact_lock');
    expect(queries.join('\n')).not.toContain('pg_advisory_lock(');
    expect(queries.join('\n')).not.toContain('pg_advisory_unlock');
    await db.destroy();
  });

  it('replays events received before provider id assignment', async () => {
    const { db, queries } = recordingDb({
      delivery: { id: 'delivery-1', status: 'sent', sent_at: null },
      events: [
        { status: 'delivered', occurred_at: new Date('2026-08-30T12:00:00.000Z') },
        { status: 'complained', occurred_at: new Date('2026-08-30T12:01:00.000Z') },
      ],
    });

    await expect(
      createEmailDeliveriesRepository(db).reconcileProviderEvents({
        deliveryId: 'delivery-1',
        providerEmailId: 'email-1',
        now: new Date('2026-08-30T12:02:00.000Z'),
      }),
    ).resolves.toBe(2);
    const sql = queries.join('\n');
    expect(sql).toContain('update "email_delivery_event"');
    expect(sql).toContain('"provider_id" =');
    expect(sql.match(/update "email_delivery"/g)).toHaveLength(2);
    await db.destroy();
  });
});
