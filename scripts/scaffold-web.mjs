#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = join(import.meta.dirname, '..');

function write(filePath, content) {
  const full = join(root, filePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
}

function pageStub(name, props = []) {
  const propDecl = props.length ? props.map((p) => `  export let ${p}: string;`).join('\n') : '';
  const propDisplay = props.length
    ? `\n  <dl class="meta">\n${props.map((p) => `    <div><dt>${p}</dt><dd>{${p}}</dd></div>`).join('\n')}\n  </dl>`
    : '';
  return `<script lang="ts">
  export let title = '${name}';
${propDecl}
</script>

<main class="page" data-page="${name.toLowerCase().replace(/\s+/g, '-')}">
  <h1>{title}</h1>
  <p class="stub">Page composition stub — replace with full @oss-tips/ui implementation.</p>${propDisplay}
</main>

<style>
  .page {
    padding: 2rem;
    max-width: 60rem;
    margin: 0 auto;
  }
  .stub {
    color: var(--pl-ink-muted, #667065);
  }
  .meta {
    margin-top: 1.5rem;
    display: grid;
    gap: 0.5rem;
  }
  .meta dt {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--pl-ink-faint, #8b9289);
  }
  .meta dd {
    margin: 0;
    font-family: ui-monospace, monospace;
  }
</style>
`;
}

function routePage(importPath, componentName, propsPass = '') {
  return `<script lang="ts">
  import { page } from '$app/state';
  import ${componentName} from '${importPath}';
</script>

<${componentName}${propsPass ? ` ${propsPass}` : ''} />
`;
}

const uiPages = [
  ['src/pages/public/HomePage.svelte', 'Home', []],
  ['src/pages/public/ExplorePage.svelte', 'Explore projects', []],
  ['src/pages/public/AboutPage.svelte', 'About oss.tips', []],
  ['src/pages/public/PricingPage.svelte', 'How fees work', []],
  ['src/pages/public/DocsPage.svelte', 'Documentation', []],
  ['src/pages/public/SecurityPage.svelte', 'Security', []],
  ['src/pages/public/TransparencyPage.svelte', 'Transparency', []],
  ['src/pages/public/TermsPage.svelte', 'Terms', []],
  ['src/pages/public/TermsDocPage.svelte', 'Terms document', ['doc']],
  ['src/pages/public/SignInPage.svelte', 'Sign in', []],
  ['src/pages/public/ProjectPage.svelte', 'Project', ['project']],
  ['src/pages/public/ProjectPostPage.svelte', 'Post', ['project', 'slug']],
  ['src/pages/public/ProjectGoalPage.svelte', 'Goal', ['project', 'slug']],
  ['src/pages/public/ProjectSupportPage.svelte', 'Support', ['project']],
  ['src/pages/public/CheckoutSuccessPage.svelte', 'Checkout success', []],
  ['src/pages/public/ClaimPage.svelte', 'Claim support', ['token']],
  ['src/pages/public/ReplyPage.svelte', 'Reply', ['token']],
  ['src/pages/supporter/MePage.svelte', 'Your account', []],
  ['src/pages/supporter/MembershipsPage.svelte', 'Memberships', []],
  ['src/pages/supporter/EntitlementsPage.svelte', 'Entitlements', []],
  ['src/pages/supporter/InboxPage.svelte', 'Inbox', []],
  ['src/pages/supporter/SettingsPage.svelte', 'Account settings', []],
  ['src/pages/dashboard/OverviewPage.svelte', 'Overview', ['project']],
  ['src/pages/dashboard/InboxPage.svelte', 'Inbox', ['project']],
  ['src/pages/dashboard/SupportersPage.svelte', 'Supporters', ['project']],
  ['src/pages/dashboard/PaymentsPage.svelte', 'Payments', ['project']],
  ['src/pages/dashboard/MembershipsPage.svelte', 'Memberships', ['project']],
  ['src/pages/dashboard/PostsPage.svelte', 'Posts', ['project']],
  ['src/pages/dashboard/NewPostPage.svelte', 'New post', ['project']],
  ['src/pages/dashboard/EditPostPage.svelte', 'Edit post', ['project', 'id']],
  ['src/pages/dashboard/GoalsPage.svelte', 'Goals', ['project']],
  ['src/pages/dashboard/DiscordPage.svelte', 'Discord', ['project']],
  ['src/pages/dashboard/AnalyticsPage.svelte', 'Analytics', ['project']],
  ['src/pages/dashboard/ExportsPage.svelte', 'Exports', ['project']],
  ['src/pages/dashboard/WebhooksPage.svelte', 'Webhooks', ['project']],
  ['src/pages/dashboard/ApiKeysPage.svelte', 'API keys', ['project']],
  ['src/pages/dashboard/DomainsPage.svelte', 'Domains', ['project']],
  ['src/pages/dashboard/TeamPage.svelte', 'Team', ['project']],
  ['src/pages/dashboard/StripePage.svelte', 'Stripe', ['project']],
  ['src/pages/dashboard/SettingsPage.svelte', 'Project settings', ['project']],
  ['src/pages/dashboard/OnboardingPage.svelte', 'Onboarding', ['project']],
  ['src/pages/admin/AdminHomePage.svelte', 'Platform admin', []],
  ['src/pages/admin/ReviewPage.svelte', 'Project review', []],
  ['src/pages/admin/DirectoryPage.svelte', 'Directory', []],
  ['src/pages/admin/ReconciliationPage.svelte', 'Reconciliation', []],
  ['src/pages/admin/CasesPage.svelte', 'Cases', []],
  ['src/pages/admin/AuditPage.svelte', 'Audit log', []],
];

for (const [path, title, props] of uiPages) {
  write(`packages/ui/${path}`, pageStub(title, props));
}

write(
  'packages/ui/package.json',
  JSON.stringify(
    {
      name: '@oss-tips/ui',
      version: '0.1.0',
      private: true,
      type: 'module',
      svelte: './src/index.ts',
      exports: {
        '.': {
          types: './src/index.ts',
          svelte: './src/index.ts',
          default: './src/index.ts',
        },
        './pages/*': './src/pages/*',
      },
      files: ['src'],
      scripts: {
        build: 'echo "ui source consumed directly by apps/web"',
        typecheck: 'svelte-check --tsconfig ./tsconfig.json',
        lint: 'echo ok',
        test: 'vitest run --passWithNoTests',
        storybook: 'storybook dev -p 6006',
        'build-storybook': 'storybook build',
      },
      peerDependencies: {
        svelte: '^5.0.0',
      },
      dependencies: {
        '@oss-tips/design-tokens': 'workspace:*',
      },
      devDependencies: {
        '@sveltejs/vite-plugin-svelte': '^5.0.3',
        svelte: '^5.20.2',
        'svelte-check': '^4.1.5',
        typescript: '^5.8.2',
      },
    },
    null,
    2,
  ) + '\n',
);

write(
  'packages/ui/tsconfig.json',
  JSON.stringify(
    {
      extends: '../../tsconfig.base.json',
      compilerOptions: {
        moduleResolution: 'Bundler',
        lib: ['ES2022', 'DOM'],
        types: ['svelte'],
      },
      include: ['src/**/*.ts', 'src/**/*.svelte'],
    },
    null,
    2,
  ) + '\n',
);

write(
  'packages/ui/src/index.ts',
  `/** Page compositions for oss.tips — imported by @oss-tips/web routes. */\nexport const UI_PACKAGE = '@oss-tips/ui';\n`,
);

const routes = [
  ['apps/web/src/routes/+page.svelte', '@oss-tips/ui/pages/public/HomePage.svelte', 'HomePage'],
  [
    'apps/web/src/routes/explore/+page.svelte',
    '@oss-tips/ui/pages/public/ExplorePage.svelte',
    'ExplorePage',
  ],
  [
    'apps/web/src/routes/about/+page.svelte',
    '@oss-tips/ui/pages/public/AboutPage.svelte',
    'AboutPage',
  ],
  [
    'apps/web/src/routes/pricing/+page.svelte',
    '@oss-tips/ui/pages/public/PricingPage.svelte',
    'PricingPage',
  ],
  [
    'apps/web/src/routes/docs/+page.svelte',
    '@oss-tips/ui/pages/public/DocsPage.svelte',
    'DocsPage',
  ],
  [
    'apps/web/src/routes/security/+page.svelte',
    '@oss-tips/ui/pages/public/SecurityPage.svelte',
    'SecurityPage',
  ],
  [
    'apps/web/src/routes/transparency/+page.svelte',
    '@oss-tips/ui/pages/public/TransparencyPage.svelte',
    'TransparencyPage',
  ],
  [
    'apps/web/src/routes/terms/+page.svelte',
    '@oss-tips/ui/pages/public/TermsPage.svelte',
    'TermsPage',
  ],
  [
    'apps/web/src/routes/terms/[doc]/+page.svelte',
    '@oss-tips/ui/pages/public/TermsDocPage.svelte',
    'TermsDocPage',
    'doc={page.params.doc}',
  ],
  [
    'apps/web/src/routes/sign-in/+page.svelte',
    '@oss-tips/ui/pages/public/SignInPage.svelte',
    'SignInPage',
  ],
  [
    'apps/web/src/routes/[project]/+page.svelte',
    '@oss-tips/ui/pages/public/ProjectPage.svelte',
    'ProjectPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/[project]/posts/[slug]/+page.svelte',
    '@oss-tips/ui/pages/public/ProjectPostPage.svelte',
    'ProjectPostPage',
    'project={page.params.project} slug={page.params.slug}',
  ],
  [
    'apps/web/src/routes/[project]/goals/[slug]/+page.svelte',
    '@oss-tips/ui/pages/public/ProjectGoalPage.svelte',
    'ProjectGoalPage',
    'project={page.params.project} slug={page.params.slug}',
  ],
  [
    'apps/web/src/routes/[project]/support/+page.svelte',
    '@oss-tips/ui/pages/public/ProjectSupportPage.svelte',
    'ProjectSupportPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/checkout/success/+page.svelte',
    '@oss-tips/ui/pages/public/CheckoutSuccessPage.svelte',
    'CheckoutSuccessPage',
  ],
  [
    'apps/web/src/routes/claim/[token]/+page.svelte',
    '@oss-tips/ui/pages/public/ClaimPage.svelte',
    'ClaimPage',
    'token={page.params.token}',
  ],
  [
    'apps/web/src/routes/reply/[token]/+page.svelte',
    '@oss-tips/ui/pages/public/ReplyPage.svelte',
    'ReplyPage',
    'token={page.params.token}',
  ],
  ['apps/web/src/routes/me/+page.svelte', '@oss-tips/ui/pages/supporter/MePage.svelte', 'MePage'],
  [
    'apps/web/src/routes/me/memberships/+page.svelte',
    '@oss-tips/ui/pages/supporter/MembershipsPage.svelte',
    'MembershipsPage',
  ],
  [
    'apps/web/src/routes/me/entitlements/+page.svelte',
    '@oss-tips/ui/pages/supporter/EntitlementsPage.svelte',
    'EntitlementsPage',
  ],
  [
    'apps/web/src/routes/me/inbox/+page.svelte',
    '@oss-tips/ui/pages/supporter/InboxPage.svelte',
    'InboxPage',
  ],
  [
    'apps/web/src/routes/me/settings/+page.svelte',
    '@oss-tips/ui/pages/supporter/SettingsPage.svelte',
    'SettingsPage',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/+page.svelte',
    '@oss-tips/ui/pages/dashboard/OverviewPage.svelte',
    'OverviewPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/inbox/+page.svelte',
    '@oss-tips/ui/pages/dashboard/InboxPage.svelte',
    'InboxPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/supporters/+page.svelte',
    '@oss-tips/ui/pages/dashboard/SupportersPage.svelte',
    'SupportersPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/payments/+page.svelte',
    '@oss-tips/ui/pages/dashboard/PaymentsPage.svelte',
    'PaymentsPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/memberships/+page.svelte',
    '@oss-tips/ui/pages/dashboard/MembershipsPage.svelte',
    'MembershipsPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/posts/+page.svelte',
    '@oss-tips/ui/pages/dashboard/PostsPage.svelte',
    'PostsPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/posts/new/+page.svelte',
    '@oss-tips/ui/pages/dashboard/NewPostPage.svelte',
    'NewPostPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/posts/[id]/+page.svelte',
    '@oss-tips/ui/pages/dashboard/EditPostPage.svelte',
    'EditPostPage',
    'project={page.params.project} id={page.params.id}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/goals/+page.svelte',
    '@oss-tips/ui/pages/dashboard/GoalsPage.svelte',
    'GoalsPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/discord/+page.svelte',
    '@oss-tips/ui/pages/dashboard/DiscordPage.svelte',
    'DiscordPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/analytics/+page.svelte',
    '@oss-tips/ui/pages/dashboard/AnalyticsPage.svelte',
    'AnalyticsPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/exports/+page.svelte',
    '@oss-tips/ui/pages/dashboard/ExportsPage.svelte',
    'ExportsPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/webhooks/+page.svelte',
    '@oss-tips/ui/pages/dashboard/WebhooksPage.svelte',
    'WebhooksPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/api-keys/+page.svelte',
    '@oss-tips/ui/pages/dashboard/ApiKeysPage.svelte',
    'ApiKeysPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/domains/+page.svelte',
    '@oss-tips/ui/pages/dashboard/DomainsPage.svelte',
    'DomainsPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/team/+page.svelte',
    '@oss-tips/ui/pages/dashboard/TeamPage.svelte',
    'TeamPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/stripe/+page.svelte',
    '@oss-tips/ui/pages/dashboard/StripePage.svelte',
    'StripePage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/settings/+page.svelte',
    '@oss-tips/ui/pages/dashboard/SettingsPage.svelte',
    'SettingsPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/dashboard/[project]/onboarding/+page.svelte',
    '@oss-tips/ui/pages/dashboard/OnboardingPage.svelte',
    'OnboardingPage',
    'project={page.params.project}',
  ],
  [
    'apps/web/src/routes/admin/+page.svelte',
    '@oss-tips/ui/pages/admin/AdminHomePage.svelte',
    'AdminHomePage',
  ],
  [
    'apps/web/src/routes/admin/review/+page.svelte',
    '@oss-tips/ui/pages/admin/ReviewPage.svelte',
    'ReviewPage',
  ],
  [
    'apps/web/src/routes/admin/directory/+page.svelte',
    '@oss-tips/ui/pages/admin/DirectoryPage.svelte',
    'DirectoryPage',
  ],
  [
    'apps/web/src/routes/admin/reconciliation/+page.svelte',
    '@oss-tips/ui/pages/admin/ReconciliationPage.svelte',
    'ReconciliationPage',
  ],
  [
    'apps/web/src/routes/admin/cases/+page.svelte',
    '@oss-tips/ui/pages/admin/CasesPage.svelte',
    'CasesPage',
  ],
  [
    'apps/web/src/routes/admin/audit/+page.svelte',
    '@oss-tips/ui/pages/admin/AuditPage.svelte',
    'AuditPage',
  ],
];

for (const [path, importPath, component, propsPass] of routes) {
  write(path, routePage(importPath, component, propsPass ?? ''));
}

console.log(`Scaffolded ${uiPages.length} UI pages and ${routes.length} web routes.`);
