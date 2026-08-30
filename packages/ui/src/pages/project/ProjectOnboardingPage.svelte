<script lang="ts">
  import { untrack } from 'svelte';
  import { stylex } from '../../styles/stylex-runtime.js';
  import Badge from '../../components/Badge.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import Button from '../../components/Button.svelte';
  import SupportEmailVerification, {
    type SupportEmailVerificationResult,
  } from '../../components/SupportEmailVerification.svelte';
  import TextField from '../../components/TextField.svelte';
  import Table from '../../components/Table.svelte';
  import type { NavGroup, Project } from '../../fixtures/demo.js';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { onboardingSteps } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { locale, t, type MessageKey } from '../../lib/i18n.js';

  const stageKeys = [
    'project.onboarding.identity',
    'project.onboarding.ownership',
    'project.onboarding.stripe',
    'project.onboarding.pageTiers',
    'project.onboarding.publish',
  ];

  export type OnboardingStep = {
    step: string;
    label: string;
    detail: string;
    status: string;
    detailKey?: 'identity' | 'ownership' | 'stripe' | 'tiers' | 'publish';
    detailValue?: number | string;
  };

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    steps?: OnboardingStep[];
    initialStep?: number;
    pageState?: 'ready' | 'error' | 'permission';
    onVerifyOwnership?: () => void | Promise<void>;
    onStartStripe?: () => void | Promise<void>;
    onPublish?: () => void | Promise<void>;
    onSendSupportEmailVerification?: (
      email: string,
    ) => SupportEmailVerificationResult | Promise<SupportEmailVerificationResult>;
    onConfirmSupportEmailVerification?: (
      code: string,
    ) => SupportEmailVerificationResult | Promise<SupportEmailVerificationResult>;
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    steps = onboardingSteps,
    initialStep = project.supportEmailVerified ? 2 : 1,
    pageState = 'ready',
    onVerifyOwnership,
    onStartStripe,
    onPublish,
    onSendSupportEmailVerification,
    onConfirmSupportEmailVerification,
  }: Props = $props();
  let step = $state(untrack(() => initialStep));
  let actionState = $state<'idle' | 'verifying' | 'stripe' | 'publishing'>('idle');
  let actionError = $state('');
  let previousInitialStep = untrack(() => initialStep);

  $effect(() => {
    const nextStep = Number(initialStep);
    if (!Number.isFinite(nextStep) || nextStep === previousInitialStep) return;
    previousInitialStep = nextStep;
    step = nextStep;
  });

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);
  const stageLabels = $derived(stageKeys.map((key) => tx(key)));
  function localizedDetail(item: OnboardingStep): string {
    if (!item.detailKey) return item.detail;
    if (item.detailKey === 'identity') {
      return tx('project.onboarding.identityValue', { name: String(item.detailValue ?? '') });
    }
    if (item.detailKey === 'ownership') {
      return item.detail || tx('project.onboarding.repositoryMissing');
    }
    if (item.detailKey === 'stripe') {
      return item.detailValue === 'connected'
        ? tx('project.onboarding.stripeConnected')
        : tx('project.onboarding.stripeNotConnectedValue');
    }
    if (item.detailKey === 'tiers') {
      return tx('project.onboarding.tiersValue', { count: Number(item.detailValue ?? 0) });
    }
    return item.detailValue === 'published'
      ? tx('project.onboarding.published')
      : tx('project.onboarding.draft');
  }
  const localizedSteps = $derived(
    steps.map((item) => ({
      ...item,
      label: stageLabels[Number(item.step) - 1] ?? item.label,
      detail: localizedDetail(item),
      status:
        item.status === 'Complete'
          ? tx('project.onboarding.complete')
          : item.status === 'In progress'
            ? tx('project.onboarding.inProgress')
            : tx('project.onboarding.waiting'),
    })),
  );

  async function runAction(kind: 'verifying' | 'stripe' | 'publishing') {
    if (actionState !== 'idle') return;
    const action = kind === 'verifying' ? onVerifyOwnership : kind === 'stripe' ? onStartStripe : onPublish;
    if (!action) return;
    actionState = kind;
    actionError = '';
    try {
      await action();
    } catch (error) {
      actionError = error instanceof Error ? error.message : tx('project.onboarding.loadError');
    } finally {
      actionState = 'idle';
    }
  }

  async function confirmSupportEmailVerification(code: string): Promise<SupportEmailVerificationResult> {
    if (!onConfirmSupportEmailVerification) {
      throw new Error(tx('project.supportEmailVerification.actionError'));
    }
    const result = await onConfirmSupportEmailVerification(code);
    if (result.status === 'verified' && step === 1) step = 2;
    return result;
  }
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={tx('project.onboarding.title')}
  lede={tx('project.onboarding.lede')}
>
  {#if pageState === 'error'}
    <div class={stylex.attrs(projectStyles.error).class} role="alert">
      <strong>{tx('project.onboarding.loadError')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.onboarding.loadErrorBody')}</p>
    </div>
  {:else if pageState === 'permission'}
    <div class={stylex.attrs(projectStyles.permission).class} role="status">
      <strong>{tx('project.onboarding.permission')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.onboarding.permissionBody')}</p>
    </div>
  {:else}
    <ol class={stylex.attrs(projectStyles.onboardingSteps).class} aria-label={tx('project.onboarding.progress')}>
      {#each stageLabels as label, i (label)}
        <li>
          {#if i + 1 <= step}
            <Badge variant="forest">{i + 1}. {label}</Badge>
          {:else}
            <Badge>{i + 1}. {label}</Badge>
          {/if}
        </li>
      {/each}
    </ol>
    {#if step === 1}
      <SupportEmailVerification
        email={project.supportEmail}
        verified={project.supportEmailVerified ?? false}
        onSend={onSendSupportEmailVerification}
        onConfirm={confirmSupportEmailVerification}
      />
    {:else if step === 2}
      <StatusBanner
        variant="info"
        title={tx('project.onboarding.verifyHeading')}
        message={tx('project.onboarding.verifyBody', { repository: project.repository })}
      />
      <div class={stylex.attrs(projectStyles.stack, projectStyles.formSurface, projectStyles.section).class}>
        <TextField label={tx('project.onboarding.projectName')} value={project.name} />
        <TextField label={tx('project.onboarding.repositoryUrl')} value={project.repository} />
        <TextField label={tx('project.onboarding.challengeFile')} value=".oss-tips-challenge" help={tx('project.onboarding.challengeHelp')} />
        <Button variant="primary" label={tx('project.onboarding.verifyButton')} loading={actionState === 'verifying'} disabled={!onVerifyOwnership || actionState !== 'idle'} onclick={() => void runAction('verifying')} />
      </div>
    {:else if step === 3}
      <StatusBanner
        variant="warning"
        title={tx('project.onboarding.stripeNotConnected')}
        message={tx('project.onboarding.stripeNotConnectedBody', { project: project.name })}
      />
      <div class={stylex.attrs(projectStyles.stack, projectStyles.formSurface, projectStyles.section).class}>
        <Button variant="primary" label={tx('project.onboarding.startStripe')} loading={actionState === 'stripe'} disabled={!onStartStripe || actionState !== 'idle'} onclick={() => void runAction('stripe')} />
      </div>
    {:else}
      <p class={stylex.attrs(projectStyles.body, projectStyles.section).class}>{tx('project.onboarding.completeSteps', { project: project.name })}</p>
      {#if actionError}
        <p class={stylex.attrs(projectStyles.error, projectStyles.body, projectStyles.small).class} role="alert">{actionError}</p>
      {/if}
      {#if step >= 4}
        <Button variant="primary" label={tx('project.onboarding.publish')} loading={actionState === 'publishing'} disabled={!onPublish || actionState !== 'idle'} onclick={() => void runAction('publishing')} />
      {/if}
    {/if}
    <Table
      caption={tx('project.onboarding.checklist')}
      columns={[
        { key: 'step', label: tx('project.onboarding.step') },
        { key: 'label', label: tx('project.onboarding.stage') },
        { key: 'detail', label: tx('project.onboarding.currentValue') },
        { key: 'status', label: tx('project.onboarding.status') },
      ]}
      rows={localizedSteps}
    />
  {/if}
</ProjectDashShell>
