const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';

export type CloudflareValidationRecord = {
  txtName: string | null;
  txtRecord: string | null;
  cname: string | null;
  cnameTarget: string | null;
};

export type CloudflareCustomHostname = {
  id: string;
  hostname: string;
  status: string;
  sslStatus: string;
  validationRecords: CloudflareValidationRecord[];
};

export interface CloudflareForSaaSClient {
  create(hostname: string): Promise<CloudflareCustomHostname>;
  /** Find an existing hostname so retries after a provider success stay idempotent. */
  findByHostname?(hostname: string): Promise<CloudflareCustomHostname | undefined>;
  get(providerId: string): Promise<CloudflareCustomHostname>;
  remove(providerId: string): Promise<void>;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseHostname(value: unknown): CloudflareCustomHostname {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Cloudflare returned an invalid custom hostname');
  }
  const result = value as Record<string, unknown>;
  const ssl = typeof result.ssl === 'object' && result.ssl !== null ? result.ssl : {};
  const records = Array.isArray(result.validation_records) ? result.validation_records : [];
  const validationRecords = records.flatMap((record): CloudflareValidationRecord[] => {
    if (typeof record !== 'object' || record === null || Array.isArray(record)) return [];
    const item = record as Record<string, unknown>;
    return [
      {
        txtName: text(item.txt_name),
        txtRecord: text(item.txt_record),
        cname: text(item.cname),
        cnameTarget: text(item.cname_target),
      },
    ];
  });
  const id = text(result.id);
  const hostname = text(result.hostname);
  if (!id || !hostname) throw new Error('Cloudflare returned an incomplete custom hostname');
  return {
    id,
    hostname,
    status: text(result.status) ?? 'initializing',
    sslStatus:
      typeof ssl === 'object' && ssl !== null
        ? (text((ssl as Record<string, unknown>).status) ?? 'initializing')
        : 'initializing',
    validationRecords,
  };
}

export class CloudflareApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CloudflareApiError';
  }
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class CloudflareClient implements CloudflareForSaaSClient {
  constructor(private readonly config: { apiToken: string; zoneId: string; fetcher?: Fetcher }) {}

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const fetcher = this.config.fetcher ?? fetch;
    const response = await fetcher(
      `${CLOUDFLARE_API}/zones/${encodeURIComponent(this.config.zoneId)}/custom_hostnames${path}`,
      {
        ...init,
        headers: {
          authorization: `Bearer ${this.config.apiToken}`,
          'content-type': 'application/json',
          ...init.headers,
        },
      },
    );
    if (response.status === 204) return undefined;
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new CloudflareApiError('Cloudflare returned invalid JSON', response.status);
    }
    if (
      !response.ok ||
      typeof payload !== 'object' ||
      payload === null ||
      (payload as { success?: unknown }).success !== true
    ) {
      const errors =
        typeof payload === 'object' &&
        payload !== null &&
        Array.isArray((payload as { errors?: unknown }).errors)
          ? (payload as { errors: Array<{ message?: unknown }> }).errors
          : [];
      const detail = errors
        .map((error) => text(error.message))
        .filter(Boolean)
        .join('; ');
      throw new CloudflareApiError(
        detail || 'Cloudflare custom hostname request failed',
        response.status,
      );
    }
    return (payload as { result?: unknown }).result;
  }

  async create(hostname: string): Promise<CloudflareCustomHostname> {
    const result = await this.request('', {
      method: 'POST',
      body: JSON.stringify({
        hostname,
        ssl: {
          method: 'txt',
          type: 'dv',
          settings: { min_tls_version: '1.2', http2: 'on' },
        },
        custom_metadata: { managed_by: 'oss-tips' },
      }),
    });
    return parseHostname(result);
  }

  async findByHostname(hostname: string): Promise<CloudflareCustomHostname | undefined> {
    const result = await this.request(`?hostname=${encodeURIComponent(hostname)}`);
    if (!Array.isArray(result)) {
      throw new Error('Cloudflare returned an invalid custom hostname list');
    }
    for (const item of result) {
      const parsed = parseHostname(item);
      if (parsed.hostname === hostname) return parsed;
    }
    return undefined;
  }

  async get(providerId: string): Promise<CloudflareCustomHostname> {
    return parseHostname(await this.request(`/${encodeURIComponent(providerId)}`));
  }

  async remove(providerId: string): Promise<void> {
    await this.request(`/${encodeURIComponent(providerId)}`, { method: 'DELETE' });
  }
}

export class MockCloudflareClient implements CloudflareForSaaSClient {
  private readonly hosts = new Map<string, CloudflareCustomHostname>();

  constructor(
    private readonly cnameTarget = process.env.CLOUDFLARE_SAAS_TARGET ?? 'domains.oss.tips',
  ) {}

  async create(hostname: string): Promise<CloudflareCustomHostname> {
    const id = `mock-${hostname.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    const result: CloudflareCustomHostname = {
      id,
      hostname,
      status: 'pending_validation',
      sslStatus: 'pending_validation',
      validationRecords: [
        {
          txtName: `_oss-tips.${hostname}`,
          txtRecord: `oss-tips-verify=${id}`,
          cname: hostname,
          cnameTarget: this.cnameTarget,
        },
      ],
    };
    this.hosts.set(id, result);
    return result;
  }

  async findByHostname(hostname: string): Promise<CloudflareCustomHostname | undefined> {
    return [...this.hosts.values()].find((host) => host.hostname === hostname);
  }

  async get(providerId: string): Promise<CloudflareCustomHostname> {
    const result = this.hosts.get(providerId);
    if (!result) throw new CloudflareApiError('Cloudflare custom hostname not found', 404);
    return result;
  }

  async remove(providerId: string): Promise<void> {
    this.hosts.delete(providerId);
  }
}

export function createCloudflareClient(
  env: NodeJS.ProcessEnv = process.env,
): CloudflareForSaaSClient {
  const mode = env.CLOUDFLARE_MODE ?? 'live';
  if (mode === 'mock') {
    if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
      throw new Error('Cloudflare mock mode is only allowed in local development or tests');
    }
    return new MockCloudflareClient(env.CLOUDFLARE_SAAS_TARGET);
  }
  if (mode !== 'live') throw new Error('CLOUDFLARE_MODE must be live or mock');
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ZONE_ID) {
    throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID are required');
  }
  return new CloudflareClient({
    apiToken: env.CLOUDFLARE_API_TOKEN,
    zoneId: env.CLOUDFLARE_ZONE_ID,
  });
}

export function domainStatusFromProvider(
  hostnameStatus: string,
  sslStatus: string,
): 'awaiting_dns' | 'validating' | 'active' | 'failed' | 'removed' {
  if (hostnameStatus === 'deleted' || sslStatus === 'deleted') return 'removed';
  if (hostnameStatus === 'active' && sslStatus === 'active') return 'active';
  if (
    hostnameStatus.includes('timed_out') ||
    sslStatus.includes('timed_out') ||
    hostnameStatus === 'expired' ||
    sslStatus === 'expired' ||
    hostnameStatus === 'inactive' ||
    sslStatus === 'inactive'
  ) {
    return 'failed';
  }
  if (hostnameStatus === 'pending_validation' || sslStatus === 'pending_validation') {
    return 'awaiting_dns';
  }
  return 'validating';
}

export function providerFields(result: CloudflareCustomHostname, now = new Date()) {
  const status = domainStatusFromProvider(result.status, result.sslStatus);
  const txtRecord = result.validationRecords.find((item) => item.txtName && item.txtRecord);
  const cnameRecord = result.validationRecords.find((item) => item.cnameTarget || item.cname);
  return {
    provider_id: status === 'removed' ? null : result.id,
    status,
    ssl_status: result.sslStatus,
    validation_name: txtRecord?.txtName ?? null,
    validation_value: txtRecord?.txtRecord ?? null,
    cname_target: cnameRecord?.cnameTarget ?? null,
    canonical_enabled: status === 'active',
    last_error: status === 'failed' ? 'Cloudflare certificate or DNS validation failed' : null,
    retry_at:
      status === 'active' || status === 'removed' ? null : new Date(now.getTime() + 5 * 60_000),
  };
}

export function providerFailure(error: unknown): { status: 'removed' | 'failed'; message: string } {
  if (error instanceof CloudflareApiError && error.status === 404) {
    return { status: 'removed', message: 'Cloudflare no longer has this hostname' };
  }
  return { status: 'failed', message: 'Cloudflare custom hostname request failed' };
}
