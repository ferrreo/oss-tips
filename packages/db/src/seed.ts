import { uuidv7 } from '@oss-tips/domain';
import { createDb, destroyDb } from './client.js';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const db = createDb(connectionString);
  const now = new Date();

  const orgId = uuidv7();
  const userId = uuidv7();
  const projectId = uuidv7();
  const featureModeId = uuidv7();
  const supporterTierId = uuidv7();
  const memberTierId = uuidv7();
  const supporterPriceId = uuidv7();
  const memberPriceId = uuidv7();
  const goalId = uuidv7();
  const welcomePostId = uuidv7();
  const updatePostId = uuidv7();
  const welcomeRevisionId = uuidv7();
  const updateRevisionId = uuidv7();

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('user')
      .values({
        id: userId,
        name: 'Paperlight Demo',
        email: 'demo@paperlight.dev',
        email_verified: true,
        image: null,
      })
      .execute();

    await trx
      .insertInto('organisation')
      .values({
        id: orgId,
        name: 'Paperlight',
        slug: 'paperlight',
      })
      .execute();

    await trx
      .insertInto('organisation_member')
      .values({
        id: uuidv7(),
        organisation_id: orgId,
        user_id: userId,
        role: 'owner',
      })
      .execute();

    await trx
      .insertInto('project')
      .values({
        id: projectId,
        organisation_id: orgId,
        name: 'Paperlight',
        slug: 'demo',
        status: 'published',
        description: 'Demo open-source project for local development.',
        default_currency: 'gbp',
      })
      .execute();

    await trx
      .insertInto('project_member')
      .values({
        id: uuidv7(),
        project_id: projectId,
        user_id: userId,
        role: 'owner',
      })
      .execute();

    await trx
      .insertInto('project_feature_mode')
      .values({
        id: featureModeId,
        project_id: projectId,
        mode: 'standard',
        effective_at: now,
      })
      .execute();

    await trx
      .insertInto('tier')
      .values([
        {
          id: supporterTierId,
          project_id: projectId,
          name: 'Supporter',
          slug: 'supporter',
          description: 'One-off thank-you with 30-day access.',
          rank: 1,
          is_active: true,
          one_off_duration: 'days_30',
        },
        {
          id: memberTierId,
          project_id: projectId,
          name: 'Member',
          slug: 'member',
          description: 'Monthly membership tier.',
          rank: 2,
          is_active: true,
          one_off_duration: null,
        },
      ])
      .execute();

    await trx
      .insertInto('tier_price')
      .values([
        {
          id: supporterPriceId,
          tier_id: supporterTierId,
          currency: 'gbp',
          amount_minor: '500',
          cadence: 'one_off',
          stripe_price_binding_id: null,
          is_active: true,
        },
        {
          id: memberPriceId,
          tier_id: memberTierId,
          currency: 'gbp',
          amount_minor: '1000',
          cadence: 'monthly',
          stripe_price_binding_id: null,
          is_active: true,
        },
      ])
      .execute();

    await trx
      .insertInto('stripe_connected_account')
      .values({
        id: uuidv7(),
        project_id: projectId,
        stripe_account_id: 'acct_demo_paperlight',
        charges_enabled: true,
        payouts_enabled: true,
        capabilities: {
          card_payments: 'active',
          transfers: 'active',
        },
      })
      .execute();

    await trx
      .insertInto('project_goal')
      .values({
        id: goalId,
        project_id: projectId,
        goal_type: 'one_time_money',
        target_minor: '500000',
        target_count: null,
        currency: 'gbp',
        title: 'Reach £5,000 in community support',
        is_active: true,
      })
      .execute();

    await trx
      .insertInto('post')
      .values([
        {
          id: welcomePostId,
          project_id: projectId,
          author_id: userId,
          title: 'Welcome to Paperlight',
          slug: 'welcome',
          status: 'published',
          published_at: now,
        },
        {
          id: updatePostId,
          project_id: projectId,
          author_id: userId,
          title: 'Roadmap update',
          slug: 'roadmap-update',
          status: 'published',
          published_at: now,
        },
      ])
      .execute();

    await trx
      .insertInto('post_revision')
      .values([
        {
          id: welcomeRevisionId,
          post_id: welcomePostId,
          revision_number: 1,
          body_markdown:
            '# Welcome\n\nThanks for exploring the **Paperlight** demo project on oss.tips.',
          editor_json: null,
          created_by: userId,
        },
        {
          id: updateRevisionId,
          post_id: updatePostId,
          revision_number: 1,
          body_markdown:
            '## Roadmap\n\n- Stripe Connect onboarding\n- Membership tiers\n- Discord role sync',
          editor_json: null,
          created_by: userId,
        },
      ])
      .execute();

    await trx
      .insertInto('post_visibility_rule')
      .values([
        {
          id: uuidv7(),
          post_id: welcomePostId,
          rule_kind: 'public',
          minimum_tier_rank: null,
          selected_tier_ids: null,
        },
        {
          id: uuidv7(),
          post_id: updatePostId,
          rule_kind: 'minimum_tier_rank',
          minimum_tier_rank: 1,
          selected_tier_ids: null,
        },
      ])
      .execute();
  });

  console.log('Seeded demo project "paperlight" at slug "demo"');
  await destroyDb(db);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
