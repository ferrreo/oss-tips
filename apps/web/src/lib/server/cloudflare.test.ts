import { describe, expect, it } from 'vitest';
import {
  CloudflareClient,
  CloudflareApiError,
  createCloudflareClient,
  MockCloudflareClient,
} from './cloudflare';

describe('Cloudflare custom hostname client', () => {
  it('uses the TXT validation contract and parses provider status', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = new CloudflareClient({
      apiToken: 'test-token',
      zoneId: 'zone-test',
      fetcher: async (url, init) => {
        calls.push({ url, init });
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              id: 'cf_123',
              hostname: 'grove.dev',
              status: 'active',
              ssl: { status: 'active' },
              validation_records: [
                { txt_name: '_oss-tips.grove.dev', txt_record: 'oss-tips-verify=cf_123' },
              ],
            },
          }),
          { status: 201 },
        );
      },
    });
    const result = await client.create('grove.dev');
    expect(result.status).toBe('active');
    expect(result.sslStatus).toBe('active');
    expect(result.validationRecords[0]?.txtName).toBe('_oss-tips.grove.dev');
    expect(calls[0]?.url).toBe(
      'https://api.cloudflare.com/client/v4/zones/zone-test/custom_hostnames',
    );
    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(body.ssl.method).toBe('txt');
    expect(calls[0]?.init?.headers).toMatchObject({ authorization: 'Bearer test-token' });
  });

  it('surfaces provider failures without returning secrets', async () => {
    const client = new CloudflareClient({
      apiToken: 'test-token',
      zoneId: 'zone-test',
      fetcher: async () =>
        new Response(JSON.stringify({ success: false, errors: [{ message: 'bad hostname' }] }), {
          status: 400,
        }),
    });
    await expect(client.create('bad.example')).rejects.toMatchObject({
      name: 'CloudflareApiError',
      status: 400,
      message: 'bad hostname',
    } satisfies Partial<CloudflareApiError>);
  });

  it('looks up an existing hostname for idempotent retries', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = new CloudflareClient({
      apiToken: 'test-token',
      zoneId: 'zone-test',
      fetcher: async (url, init) => {
        calls.push({ url, init });
        return new Response(
          JSON.stringify({
            success: true,
            result: [
              {
                id: 'cf_123',
                hostname: 'grove.dev',
                status: 'pending_validation',
                ssl: { status: 'pending_validation' },
              },
            ],
          }),
          { status: 200 },
        );
      },
    });

    await expect(client.findByHostname('grove.dev')).resolves.toMatchObject({
      id: 'cf_123',
      hostname: 'grove.dev',
    });
    expect(calls[0]?.url).toBe(
      'https://api.cloudflare.com/client/v4/zones/zone-test/custom_hostnames?hostname=grove.dev',
    );
  });

  it('allows mock mode only outside production', async () => {
    expect(createCloudflareClient({ CLOUDFLARE_MODE: 'mock', NODE_ENV: 'test' })).toBeInstanceOf(
      MockCloudflareClient,
    );
    expect(() =>
      createCloudflareClient({ CLOUDFLARE_MODE: 'mock', NODE_ENV: 'production' }),
    ).toThrow('only allowed in local development or tests');
    expect(() => createCloudflareClient({ CLOUDFLARE_MODE: 'mock' })).toThrow(
      'only allowed in local development or tests',
    );
    expect(() => createCloudflareClient({ CLOUDFLARE_MODE: 'live', NODE_ENV: 'test' })).toThrow(
      'CLOUDFLARE_API_TOKEN',
    );
  });

  it('accepts an empty successful delete response', async () => {
    const client = new CloudflareClient({
      apiToken: 'test-token',
      zoneId: 'zone-test',
      fetcher: async () => new Response(null, { status: 204 }),
    });
    await expect(client.remove('cf_123')).resolves.toBeUndefined();
  });
});
