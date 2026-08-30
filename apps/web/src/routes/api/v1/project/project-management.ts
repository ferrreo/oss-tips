import type { Db, Project, ProjectClaim, ProjectRepository } from '@oss-tips/db';
import { ProjectPublishEligibilitySchema, ProjectSettingsSchema } from '@oss-tips/api-contracts';

export async function readProjectManagement(db: Db, projectId: string) {
  const [project, feature, stripe, repository, claim] = await Promise.all([
    db.selectFrom('project').selectAll().where('id', '=', projectId).executeTakeFirst(),
    db
      .selectFrom('project_feature_mode')
      .select(['mode', 'effective_at'])
      .where('project_id', '=', projectId)
      .orderBy('effective_at', 'desc')
      .executeTakeFirst(),
    db
      .selectFrom('stripe_connected_account')
      .select(['stripe_account_id'])
      .where('project_id', '=', projectId)
      .executeTakeFirst(),
    db
      .selectFrom('project_repository')
      .selectAll()
      .where('project_id', '=', projectId)
      .orderBy('created_at', 'asc')
      .executeTakeFirst(),
    db
      .selectFrom('project_claim')
      .selectAll()
      .where('project_id', '=', projectId)
      .orderBy('created_at', 'desc')
      .executeTakeFirst(),
  ]);
  return { project, feature, stripe, repository, claim };
}

export type PublishEligibility = {
  eligible: boolean;
  missing: Array<
    | 'website'
    | 'support_email'
    | 'verified_support_email'
    | 'repository'
    | 'open_source_declaration'
    | 'ownership_verification'
  >;
};

export function publishEligibility(
  project: Project,
  repository: ProjectRepository | undefined,
  claim: ProjectClaim | undefined,
): PublishEligibility {
  const missing: PublishEligibility['missing'] = [];
  if (!project.website_url) missing.push('website');
  if (!project.support_email) missing.push('support_email');
  else if (!project.support_email_verified_at) missing.push('verified_support_email');
  if (!repository) missing.push('repository');
  if (!project.open_source_declared) missing.push('open_source_declaration');
  if (claim?.status !== 'verified') missing.push('ownership_verification');
  return { eligible: missing.length === 0, missing };
}

export function projectOwnership(claim: ProjectClaim | undefined) {
  const status =
    claim?.status === 'verified' ||
    claim?.status === 'rejected' ||
    claim?.status === 'manual_review'
      ? claim.status
      : 'pending';
  const method =
    claim?.method === 'repository_oauth' ||
    claim?.method === 'repository_file' ||
    claim?.method === 'website_dns'
      ? claim.method
      : 'manual_email';
  return {
    status,
    method,
    proof_reference: claim?.proof_reference ?? null,
    failure_reason: claim?.failure_reason ?? null,
    next_action:
      status === 'verified'
        ? 'none'
        : status === 'manual_review' || claim?.failure_reason
          ? 'manual_review'
          : method === 'manual_email'
            ? 'manual_review'
            : 'awaiting_proof',
    updated_at: claim?.updated_at?.toISOString() ?? null,
  } as const;
}

export async function projectSettings(db: Db, projectId: string) {
  const { project, feature, stripe, repository, claim } = await readProjectManagement(
    db,
    projectId,
  );
  if (!project) return undefined;
  const payload = {
    id: project.id,
    slug: project.slug,
    name: project.name,
    description: project.description,
    default_currency: project.default_currency.toLowerCase(),
    feature_mode:
      feature?.mode === 'contributes_5_percent'
        ? ('contributes_5_percent' as const)
        : ('standard' as const),
    stripe_account_id: stripe?.stripe_account_id ?? null,
    website_url: project.website_url,
    support_email: project.support_email,
    support_email_verified: project.support_email_verified_at !== null,
    repository: repository
      ? {
          id: repository.id,
          provider: repository.provider,
          external_id: repository.external_id,
          url: repository.url,
          verification_status:
            repository.verification_status === 'verified'
              ? ('verified' as const)
              : repository.verification_status === 'failed'
                ? ('failed' as const)
                : ('pending' as const),
          verified_at: repository.verified_at?.toISOString() ?? null,
        }
      : null,
    open_source_declared: project.open_source_declared,
    open_source_license: project.open_source_license,
    min_support:
      project.min_support_minor === null || project.min_support_minor === undefined
        ? null
        : {
            amount: String(project.min_support_minor),
            currency: project.default_currency.toLowerCase(),
          },
    max_support:
      project.max_support_minor === null || project.max_support_minor === undefined
        ? null
        : {
            amount: String(project.max_support_minor),
            currency: project.default_currency.toLowerCase(),
          },
    public_display: {
      show_supporters: project.public_show_supporters,
      show_goal: project.public_show_goal,
      show_stats: project.public_show_stats,
      show_gated_post_metadata: project.public_show_gated_post_metadata ?? false,
    },
    assets: {
      logo_asset_id: project.logo_asset_id,
      banner_asset_id: project.banner_asset_id,
    },
    discovery: {
      ecosystems: project.discovery_ecosystems,
      languages: project.discovery_languages,
      tags: project.discovery_tags,
    },
    ownership: projectOwnership(claim),
    publish_eligibility: publishEligibility(project, repository, claim),
  };
  return ProjectSettingsSchema.parse(payload);
}

export function validatePublishEligibility(value: PublishEligibility) {
  return ProjectPublishEligibilitySchema.parse(value);
}

export function normalizedList(values: string[] | undefined): string[] | undefined {
  if (!values) return undefined;
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}
