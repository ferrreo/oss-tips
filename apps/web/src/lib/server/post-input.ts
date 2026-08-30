import { ProjectPostCreateSchema, ProjectPostPatchSchema } from '@oss-tips/api-contracts';
import { normalizeMarkdown } from '@oss-tips/domain';
import { problem } from './http';
import { readJsonText, readJsonValue } from '../../routes/api/api-utils';

const FIELD_NAMES = new Set([
  'title',
  'slug',
  'body',
  'visibility',
  'minimum_tier_rank',
  'selected_tier_ids',
  'scheduled_at',
  'notify_supporters',
]);

export type PostVisibilityInput =
  | { kind: 'public'; minimumTierRank: null; selectedTierIds: null }
  | { kind: 'signed_in_supporter'; minimumTierRank: null; selectedTierIds: null }
  | { kind: 'minimum_tier_rank'; minimumTierRank: number; selectedTierIds: null }
  | { kind: 'selected_tier_ids'; minimumTierRank: null; selectedTierIds: string[] };

export type PostCreateInput = {
  title: string;
  slug: string;
  body: string;
  visibility: PostVisibilityInput;
  scheduledAt: Date | null;
  notifySupporters: boolean;
};

export type PostPatchInput = {
  title?: string;
  slug?: string;
  body?: string | null;
  visibility?: PostVisibilityInput;
  scheduledAt?: Date | null;
  notifySupporters?: boolean;
};

export async function readPostCreateInput(request: Request): Promise<PostCreateInput | Response> {
  const raw = await readBody(request);
  if (raw instanceof Response) return raw;
  const invalid = unknownFields(raw);
  if (invalid) return invalid;
  const parsed = ProjectPostCreateSchema.safeParse({
    title: raw.title,
    slug: raw.slug,
    body: raw.body,
    minimum_tier_rank: raw.minimum_tier_rank,
  });
  if (!parsed.success) return problem(400, 'Invalid request', parsed.error.message);
  const visibility = parseVisibility(raw);
  if (visibility instanceof Response) return visibility;
  const schedule = parseSchedule(raw);
  if (schedule instanceof Response) return schedule;
  return {
    title: parsed.data.title,
    slug: parsed.data.slug,
    body: normalizeMarkdown(parsed.data.body),
    visibility,
    scheduledAt: schedule.scheduledAt ?? null,
    notifySupporters: schedule.notifySupporters ?? false,
  };
}

export async function readPostPatchInput(request: Request): Promise<PostPatchInput | Response> {
  const raw = await readBody(request);
  if (raw instanceof Response) return raw;
  const invalid = unknownFields(raw);
  if (invalid) return invalid;
  const parsed = ProjectPostPatchSchema.safeParse({ title: raw.title, body: raw.body });
  if (!parsed.success) return problem(400, 'Invalid request', parsed.error.message);
  const result: PostPatchInput = {};
  if (parsed.data.title !== undefined) result.title = parsed.data.title;
  if (parsed.data.body !== undefined)
    result.body = parsed.data.body === null ? '' : normalizeMarkdown(parsed.data.body);
  if (raw.slug !== undefined) {
    if (
      typeof raw.slug !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.slug) ||
      raw.slug.length > 160
    ) {
      return problem(
        400,
        'Invalid request',
        'slug must contain lowercase letters, numbers, and hyphens',
      );
    }
    result.slug = raw.slug;
  }
  const hasVisibility =
    raw.visibility !== undefined ||
    raw.minimum_tier_rank !== undefined ||
    raw.selected_tier_ids !== undefined;
  if (hasVisibility) {
    const visibility = parseVisibility(raw);
    if (visibility instanceof Response) return visibility;
    result.visibility = visibility;
  }
  const schedule = parseSchedule(raw, true);
  if (schedule instanceof Response) return schedule;
  if (schedule.scheduledAt !== undefined) result.scheduledAt = schedule.scheduledAt;
  if (schedule.notifySupporters !== undefined) result.notifySupporters = schedule.notifySupporters;
  if (Object.keys(result).length === 0) return problem(400, 'Empty post update');
  return result;
}

export async function readPostPublishInput(
  request: Request,
): Promise<{ scheduledAt?: Date | null; notifySupporters?: boolean } | Response> {
  const text = await readJsonText(request);
  if (text instanceof Response) return text;
  if (!text.trim()) return {};
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return problem(400, 'Invalid JSON body');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return problem(400, 'Invalid request', 'Request body must be an object');
  const raw = value as Record<string, unknown>;
  const unknown = Object.keys(raw).find(
    (key) => key !== 'scheduled_at' && key !== 'notify_supporters',
  );
  if (unknown) return problem(400, 'Invalid request', `Unknown field: ${unknown}`);
  return parseSchedule(raw, true);
}

function parseSchedule(
  raw: Record<string, unknown>,
  patch = false,
): { scheduledAt?: Date | null; notifySupporters?: boolean } | Response {
  const hasSchedule = raw.scheduled_at !== undefined;
  const hasNotify = raw.notify_supporters !== undefined;
  if (!hasSchedule && !hasNotify)
    return patch ? {} : { scheduledAt: null, notifySupporters: false };
  let scheduledAt: Date | null | undefined;
  if (hasSchedule) {
    if (raw.scheduled_at === null) scheduledAt = null;
    else if (typeof raw.scheduled_at !== 'string' || !Number.isFinite(Date.parse(raw.scheduled_at)))
      return problem(400, 'Invalid request', 'scheduled_at must be an ISO timestamp or null');
    else scheduledAt = new Date(raw.scheduled_at);
  }
  if (hasNotify && typeof raw.notify_supporters !== 'boolean')
    return problem(400, 'Invalid request', 'notify_supporters must be a boolean');
  return {
    ...(scheduledAt === undefined ? {} : { scheduledAt }),
    ...(hasNotify ? { notifySupporters: raw.notify_supporters as boolean } : {}),
  };
}

function parseVisibility(raw: Record<string, unknown>): PostVisibilityInput | Response {
  const value = raw.visibility;
  const minimum = raw.minimum_tier_rank === null ? undefined : raw.minimum_tier_rank;
  const selected = raw.selected_tier_ids;
  if (value !== undefined && typeof value !== 'string')
    return problem(400, 'Invalid request', 'visibility is invalid');

  if (value === 'public') {
    if (minimum !== undefined || selected !== undefined)
      return problem(400, 'Invalid request', 'public visibility cannot include tier filters');
    return { kind: 'public', minimumTierRank: null, selectedTierIds: null };
  }
  if (value === undefined && minimum === undefined && selected === undefined) {
    return { kind: 'public', minimumTierRank: null, selectedTierIds: null };
  }
  if (value === 'supporter' || value === 'signed_in_supporter') {
    if (minimum !== undefined || selected !== undefined)
      return problem(400, 'Invalid request', 'supporter visibility cannot include tier filters');
    return { kind: 'signed_in_supporter', minimumTierRank: null, selectedTierIds: null };
  }
  if (value === 'backer' && minimum === undefined) {
    return { kind: 'minimum_tier_rank', minimumTierRank: 2, selectedTierIds: null };
  }
  if (
    value === 'minimum_tier_rank' ||
    value === 'backer' ||
    (value === undefined && minimum !== undefined)
  ) {
    if (!Number.isSafeInteger(minimum) || (minimum as number) < 0)
      return problem(400, 'Invalid request', 'minimum_tier_rank must be a non-negative integer');
    if (selected !== undefined)
      return problem(
        400,
        'Invalid request',
        'minimum tier visibility cannot include selected tiers',
      );
    return { kind: 'minimum_tier_rank', minimumTierRank: minimum as number, selectedTierIds: null };
  }
  if (value === 'selected_tier_ids' || (value === undefined && selected !== undefined)) {
    if (
      !Array.isArray(selected) ||
      selected.length < 1 ||
      selected.length > 50 ||
      selected.some((item) => typeof item !== 'string' || item.length < 1 || item.length > 100)
    ) {
      return problem(
        400,
        'Invalid request',
        'selected_tier_ids must contain one to fifty tier IDs',
      );
    }
    if (minimum !== undefined)
      return problem(
        400,
        'Invalid request',
        'selected tier visibility cannot include minimum_tier_rank',
      );
    return {
      kind: 'selected_tier_ids',
      minimumTierRank: null,
      selectedTierIds: selected as string[],
    };
  }
  return problem(400, 'Invalid request', 'visibility is invalid');
}

function unknownFields(raw: Record<string, unknown>): Response | null {
  const unknown = Object.keys(raw).filter((key) => !FIELD_NAMES.has(key));
  return unknown.length ? problem(400, 'Invalid request', `Unknown field: ${unknown[0]}`) : null;
}

async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
  const value = await readJsonValue(request);
  if (value instanceof Response) return value;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return problem(400, 'Invalid request', 'Request body must be an object');
  }
  return value as Record<string, unknown>;
}
