import { isIP } from 'node:net';

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

export type WebhookDestinationCheck = { ok: true; url: URL } | { ok: false; reason: string };

/** URL-only checks. Callers must resolve DNS and run isBlockedIp for each address. */
export function checkWebhookDestination(value: string): WebhookDestinationCheck {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: 'Webhook URL is invalid' };
  }

  const hostname = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'Webhook URL must use HTTPS' };
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'Webhook URL cannot contain credentials' };
  }
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { ok: false, reason: 'Webhook URL points to an internal hostname' };
  }
  if (isIP(hostname) && isBlockedIp(hostname)) {
    return { ok: false, reason: 'Webhook URL points to a private address' };
  }

  return { ok: true, url };
}

/** Reject loopback, link-local, RFC1918, metadata, multicast and reserved IPs. */
export function isBlockedIp(address: string): boolean {
  if (isIP(address) === 4) return isBlockedIpv4(address);
  if (isIP(address) === 6) return isBlockedIpv6(address);
  return true;
}

function isBlockedIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }
  const a = octets[0] ?? -1;
  const b = octets[1] ?? -1;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split('%', 1)[0] ?? '';
  const ipv4Text = normalized.includes('.')
    ? normalized.slice(normalized.lastIndexOf(':') + 1)
    : null;
  const withoutIpv4 = ipv4Text ? normalized.slice(0, normalized.lastIndexOf(':')) : normalized;
  const ipv4Groups = ipv4Text
    ? (() => {
        const octets = ipv4Text.split('.').map(Number);
        if (
          octets.length !== 4 ||
          octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
        )
          return null;
        return [
          ((octets[0] ?? 0) << 8) | (octets[1] ?? 0),
          ((octets[2] ?? 0) << 8) | (octets[3] ?? 0),
        ];
      })()
    : [];
  if (ipv4Text && !ipv4Groups) return true;

  const halves = withoutIpv4.split('::');
  if (halves.length > 2) return true;
  const left = halves[0] ? halves[0].split(':').filter(Boolean) : [];
  const right = halves[1] ? halves[1].split(':').filter(Boolean) : [];
  const required = 8 - (ipv4Groups?.length ?? 0);
  if (
    left.length + right.length > required ||
    (halves.length === 1 && left.length + right.length !== required)
  )
    return true;
  const groups = [
    ...left,
    ...(halves.length === 2 ? Array(required - left.length - right.length).fill('0') : []),
    ...right,
    ...(ipv4Groups ?? []).map((group) => group.toString(16)),
  ];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return true;
  const values = groups.map((group) => Number.parseInt(group, 16));
  const first = values[0] ?? 0;
  const embeddedIpv4 =
    // 6to4 embeds its IPv4 address in the second and third hextets.
    first === 0x2002
      ? ipv4FromWords(values[1] ?? 0, values[2] ?? 0)
      : // The well-known NAT64 prefix embeds IPv4 in the final 32 bits.
        values[0] === 0x0064 && values[1] === 0xff9b
        ? ipv4FromWords(values[6] ?? 0, values[7] ?? 0)
        : // Teredo stores the bitwise inverse of its client IPv4 address.
          values[0] === 0x2001 && values[1] === 0
          ? ipv4FromWords(~(values[6] ?? 0) & 0xffff, ~(values[7] ?? 0) & 0xffff)
          : null;

  // ::, ::1, fc00::/7, fe80::/10, ff00::/8, translated private IPv4 ranges,
  // and IPv4-mapped/compatible ranges.
  return (
    values.every((value) => value === 0) ||
    (values.slice(0, 7).every((value) => value === 0) && (values[7] ?? 0) <= 1) ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00 ||
    (values.slice(0, 6).every((value) => value === 0) &&
      (values[6] === 0 || values[6] === 0xffff)) ||
    (values.slice(0, 5).every((value) => value === 0) && values[5] === 0xffff) ||
    (embeddedIpv4 !== null && isBlockedIpv4(embeddedIpv4))
  );
}

function ipv4FromWords(high: number, low: number): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}
