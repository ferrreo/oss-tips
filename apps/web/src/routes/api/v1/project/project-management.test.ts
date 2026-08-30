import { describe, expect, it } from 'vitest';
import type { Project, ProjectClaim, ProjectRepository } from '@oss-tips/db';
import { publishEligibility, projectOwnership } from './project-management';

function project(overrides: Partial<Project> = {}) {
  return {
    website_url: 'https://ledger.example',
    support_email: 'maintainer@example.com',
    support_email_verified_at: null,
    open_source_declared: true,
    ...overrides,
  } as Project;
}

const repository = {} as ProjectRepository;

describe('project onboarding eligibility', () => {
  it('holds a fresh draft until contact and ownership proof are verified', () => {
    expect(publishEligibility(project(), repository, undefined)).toEqual({
      eligible: false,
      missing: ['verified_support_email', 'ownership_verification'],
    });
  });

  it('allows publish only after support email and ownership verification', () => {
    const verifiedProject = project({ support_email_verified_at: new Date() });
    const verifiedClaim = { status: 'verified' } as ProjectClaim;

    expect(publishEligibility(verifiedProject, repository, verifiedClaim)).toEqual({
      eligible: true,
      missing: [],
    });
  });

  it('keeps rejected proof in an explicit manual-review state', () => {
    expect(
      projectOwnership({
        status: 'rejected',
        method: 'repository_oauth',
        failure_reason: 'Provider account does not have repository owner permissions',
      } as ProjectClaim),
    ).toMatchObject({
      status: 'rejected',
      next_action: 'manual_review',
    });
  });
});
