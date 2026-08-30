import type { Actor } from '@oss-tips/auth';
import type { AuthSession } from './lib/server/session';

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      session: AuthSession | null;
      actor: Actor | null;
      customDomain?: {
        projectId: string;
        projectSlug: string;
        hostname: string;
        graceUntil: Date | null;
      };
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
