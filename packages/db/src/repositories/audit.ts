import type { Db } from '../client.js';
import type { AuditEvent, NewAuditEvent } from '../types.js';

export function createAuditRepository(db: Db) {
  return {
    async record(event: NewAuditEvent): Promise<AuditEvent> {
      return db
        .insertInto('audit_event')
        .values(event)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async listByProject(projectId: string, limit = 100): Promise<AuditEvent[]> {
      return db
        .selectFrom('audit_event')
        .selectAll()
        .where('project_id', '=', projectId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .execute();
    },

    async listByResource(
      resourceType: string,
      resourceId: string,
      limit = 50,
    ): Promise<AuditEvent[]> {
      return db
        .selectFrom('audit_event')
        .selectAll()
        .where('resource_type', '=', resourceType)
        .where('resource_id', '=', resourceId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .execute();
    },
  };
}

export type AuditRepository = ReturnType<typeof createAuditRepository>;
