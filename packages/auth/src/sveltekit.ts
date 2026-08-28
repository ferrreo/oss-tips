/** SvelteKit session cookie helpers for Better Auth integration. */

export const SESSION_COOKIE_NAME = 'oss_tips.session_token';
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};

export type SessionCookie = {
  name: string;
  value: string;
  options: typeof SESSION_COOKIE_OPTIONS & { maxAge?: number };
};

export function buildSessionCookie(token: string, maxAgeSeconds = 60 * 60 * 24 * 7): SessionCookie {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    options: {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: maxAgeSeconds,
    },
  };
}

export function clearSessionCookie(): SessionCookie {
  return {
    name: SESSION_COOKIE_NAME,
    value: '',
    options: {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: 0,
    },
  };
}

export function readSessionTokenFromCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === SESSION_COOKIE_NAME) {
      return rest.join('=') || null;
    }
  }
  return null;
}
