export type RepositoryIdentity = {
  url: string;
  provider: 'github' | 'gitlab' | 'codeberg' | 'generic';
  externalId: string;
};

export type RepositoryOAuthResult =
  | { status: 'verified' }
  | { status: 'rejected'; reason: string }
  | { status: 'pending'; reason: string };

const KNOWN_HOSTS: Readonly<Record<string, RepositoryIdentity['provider']>> = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
  'codeberg.org': 'codeberg',
};

function decodedPath(value: string): string[] | null {
  const parts = value.split('/').filter(Boolean);
  try {
    const decoded = parts.map((part) => decodeURIComponent(part));
    if (decoded.some((part) => !part || part === '.' || part === '..' || part.includes('\0'))) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/** Parse repository URLs without preserving credentials, queries, or fragments. */
export function normalizeRepositoryUrl(value: string): RepositoryIdentity | null {
  try {
    const parsed = new URL(value.trim());
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      return null;
    }
    if (parsed.search || parsed.hash || parsed.port) return null;
    if (KNOWN_HOSTS[parsed.hostname.toLowerCase()] && parsed.protocol !== 'https:') return null;
    const parts = decodedPath(parsed.pathname);
    if (!parts || parts.length < 2) return null;
    const repository = parts.at(-1)?.replace(/\.git$/i, '');
    if (!repository) return null;
    parts[parts.length - 1] = repository;
    const host = parsed.hostname.toLowerCase();
    const provider = KNOWN_HOSTS[host] ?? 'generic';
    if (provider !== 'generic' && parts.length !== 2) return null;
    if (parts.join('/').length > 300) return null;
    return {
      url: `${parsed.protocol}//${host}/${parts.map((part) => encodeURIComponent(part)).join('/')}`,
      provider,
      externalId: parts.join('/'),
    };
  } catch {
    return null;
  }
}

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

function apiUrl(identity: RepositoryIdentity): string | null {
  const parts = identity.externalId.split('/');
  if (identity.provider === 'github' || identity.provider === 'codeberg') {
    if (parts.length !== 2) return null;
    const base =
      identity.provider === 'github'
        ? 'https://api.github.com/repos'
        : 'https://codeberg.org/api/v1/repos';
    return `${base}/${parts.map((part) => encodeURIComponent(part)).join('/')}`;
  }
  if (identity.provider === 'gitlab') {
    return `https://gitlab.com/api/v4/projects/${encodeURIComponent(identity.externalId)}`;
  }
  return null;
}

function hasAdminPermission(provider: RepositoryIdentity['provider'], body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const value = body as {
    permissions?: { admin?: unknown; project_access?: { access_level?: unknown } };
  };
  if (provider === 'gitlab') {
    const level = value.permissions?.project_access?.access_level;
    return typeof level === 'number' && Number.isInteger(level) && level >= 40;
  }
  return value.permissions?.admin === true;
}

/** Verify ownership with a linked provider token; no token means pending, never success. */
export async function verifyRepositoryOAuth(
  input: {
    provider: string;
    url: string;
    externalId: string;
    accessToken: string;
  },
  fetcher: Fetcher = globalThis.fetch,
): Promise<RepositoryOAuthResult> {
  const identity = normalizeRepositoryUrl(input.url);
  if (
    !identity ||
    identity.provider !== input.provider.trim().toLowerCase() ||
    identity.externalId !== input.externalId
  ) {
    return { status: 'rejected', reason: 'Repository identity does not match its URL' };
  }
  const endpoint = apiUrl(identity);
  if (!endpoint)
    return { status: 'pending', reason: 'This provider requires manual ownership review' };
  try {
    const response = await fetcher(endpoint, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${input.accessToken}`,
        'user-agent': 'oss.tips ownership verification',
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (response.status === 404) {
      return {
        status: 'rejected',
        reason: 'Repository was not found or is not accessible to this account',
      };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        status: 'pending',
        reason: 'Provider account needs a fresh ownership authorization',
      };
    }
    if (response.status >= 500) {
      return { status: 'pending', reason: 'Provider is temporarily unavailable' };
    }
    if (!response.ok)
      return { status: 'pending', reason: 'Provider ownership check could not complete' };
    const body = await response.json().catch(() => null);
    return hasAdminPermission(identity.provider, body)
      ? { status: 'verified' }
      : {
          status: 'rejected',
          reason: 'Provider account does not have repository owner permissions',
        };
  } catch {
    return { status: 'pending', reason: 'Provider ownership check could not complete' };
  }
}
