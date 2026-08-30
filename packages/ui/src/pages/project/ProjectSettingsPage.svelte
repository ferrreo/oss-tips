<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import SupportEmailVerification, {
    type SupportEmailVerificationResult,
  } from '../../components/SupportEmailVerification.svelte';
  import ProjectLifecyclePanel from '../../components/ProjectLifecyclePanel.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import Table from '../../components/Table.svelte';
  import type { NavGroup, Project } from '../../fixtures/demo.js';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { settingsLinks } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { primitives } from '../../styles/primitives.stylex.js';
  import { locale, t, type MessageKey } from '../../lib/i18n.js';
  import { currencyExponent } from '@oss-tips/domain/money';

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    links?: typeof settingsLinks;
    pageState?: 'ready' | 'error' | 'permission';
    projectCapabilities?: readonly string[];
    onSave?: (input: {
      name: string;
      description: string;
      websiteUrl: string;
      repositoryUrl: string;
      supportEmail: string;
      feeMode: 'standard' | 'project_5pct';
      minSupportMinor: number | null | undefined;
      maxSupportMinor: number | null | undefined;
      showGatedPostMetadata: boolean;
    }) => void | Promise<void>;
    onSendSupportEmailVerification?: (
      email: string,
    ) => SupportEmailVerificationResult | Promise<SupportEmailVerificationResult>;
    onConfirmSupportEmailVerification?: (
      code: string,
    ) => SupportEmailVerificationResult | Promise<SupportEmailVerificationResult>;
    onCloseProject?: () => void | Promise<void>;
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    links = settingsLinks,
    pageState = 'ready',
    onSave,
    onSendSupportEmailVerification,
    onConfirmSupportEmailVerification,
    projectCapabilities = [],
    onCloseProject,
  }: Props = $props();

  let feeMode = $state('standard');
  let slug = $state('');
  let name = $state('');
  let description = $state('');
  let websiteUrl = $state('');
  let repositoryUrl = $state('');
  let supportEmail = $state('');
  let minSupport = $state('');
  let maxSupport = $state('');
  let showGatedPostMetadata = $state(false);
  let actionState = $state<'idle' | 'saving'>('idle');
  let actionError = $state('');

  $effect(() => {
    feeMode = project.feeMode;
    slug = project.slug;
    name = project.name;
    description = project.description;
    websiteUrl = project.website;
    repositoryUrl = project.repository;
    supportEmail = project.supportEmail ?? '';
    minSupport = minorInput(project.minSupportMinor);
    maxSupport = minorInput(project.maxSupportMinor);
    showGatedPostMetadata = project.showGatedPostMetadata === true;
  });

  function minorInput(value: number | undefined): string {
    if (value === undefined) return '';
    const exponent = currencyExponent(project.currency);
    return (value / 10 ** exponent)
      .toFixed(exponent)
      .replace(/\.0+$/, '')
      .replace(/(\.\d*?)0+$/, '$1');
  }

  function inputMinor(value: string): number | null | undefined {
    if (!value.trim()) return null;
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed < 0) return undefined;
    const minor = Math.round(parsed * 10 ** currencyExponent(project.currency));
    return Number.isSafeInteger(minor) ? minor : undefined;
  }

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);
  const feeModeLabel = (mode: string) =>
    mode === 'project_5pct'
      ? tx('project.settings.projectFeeMode')
      : tx('project.settings.standardFeeMode');
  const linkLabel = (value: string) =>
    ({
      'Public page': tx('project.settings.publicPage'),
      Website: tx('project.settings.website'),
      Repository: tx('project.settings.repository'),
      'Support email': tx('project.settings.supportEmail'),
      Currency: tx('project.settings.currency'),
    }[value] ?? value);

  async function saveSettings() {
    if (!onSave || actionState !== 'idle') return;
    actionState = 'saving';
    actionError = '';
    try {
      await onSave({
        name,
        description,
        websiteUrl,
        repositoryUrl,
        supportEmail,
        feeMode: feeMode as 'standard' | 'project_5pct',
        minSupportMinor: inputMinor(minSupport),
        maxSupportMinor: inputMinor(maxSupport),
        showGatedPostMetadata,
      });
    } catch (error) {
      actionError = error instanceof Error ? error.message : tx('project.settings.loadError');
    } finally {
      actionState = 'idle';
    }
  }
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={tx('project.settings.title')}
  lede={tx('project.settings.lede', { project: project.name })}
>
  {#if pageState === 'error'}
    <div class={stylex.attrs(projectStyles.error).class} role="alert">
      <strong>{tx('project.settings.loadError')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.settings.loadErrorBody')}</p>
    </div>
  {:else if pageState === 'permission'}
    <div class={stylex.attrs(projectStyles.permission).class} role="status">
      <strong>{tx('project.settings.permission')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.settings.permissionBody')}</p>
    </div>
  {:else}
    <div class={stylex.attrs(projectStyles.grid2, projectStyles.responsiveStack).class}>
      <section class={stylex.attrs(projectStyles.stack).class} aria-labelledby="project-settings-heading">
        <h2 id="project-settings-heading" class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.settings.detailsHeading')}</h2>
        <TextField label={tx('project.settings.name')} bind:value={name} />
        <TextField label={tx('project.settings.slug')} value={slug} help={`https://oss.tips/${slug}`} disabled />
        <TextField label={tx('project.settings.description')} bind:value={description} />
        <TextField label={tx('project.settings.website')} bind:value={websiteUrl} type="text" inputmode="url" />
        <TextField label={tx('project.settings.repository')} bind:value={repositoryUrl} type="text" inputmode="url" />
        <TextField label={tx('project.settings.supportEmail')} bind:value={supportEmail} type="email" />
        <SupportEmailVerification
          email={supportEmail}
          showEmailField={false}
          verified={Boolean(project.supportEmailVerified && project.supportEmail === supportEmail)}
          onSend={onSendSupportEmailVerification}
          onConfirm={onConfirmSupportEmailVerification}
        />
        <SegmentedControl
          label={tx('project.settings.feeMode')}
          options={[
            { value: 'standard', label: feeModeLabel('standard') },
            { value: 'project_5pct', label: feeModeLabel('project_5pct') },
          ]}
          bind:value={feeMode}
        />
        <h2 class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.settings.supportLimitsHeading')}</h2>
        <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>
          {tx('project.settings.supportLimitsHelp', { currency: project.currency })}
        </p>
        <TextField
          label={tx('project.settings.minimumSupport')}
          type="number"
          inputmode="decimal"
          bind:value={minSupport}
        />
        <TextField
          label={tx('project.settings.maximumSupport')}
          type="number"
          inputmode="decimal"
          bind:value={maxSupport}
        />
        <h2 class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.settings.publicDisplayHeading')}</h2>
        <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>
          {tx('project.settings.publicDisplayHelp')}
        </p>
        <label class={stylex.attrs(projectStyles.publicDisplayCheck).class}>
          <input
            class={stylex.attrs(projectStyles.publicDisplayCheckbox, primitives.focusRing).class}
            type="checkbox"
            bind:checked={showGatedPostMetadata}
          />
          <span>{tx('project.settings.showGatedPostMetadata')}</span>
        </label>
        {#if actionError}
          <p class={stylex.attrs(projectStyles.error, projectStyles.body, projectStyles.small).class} role="alert">{actionError}</p>
        {/if}
        <Button variant="primary" label={tx('project.settings.save')} loading={actionState === 'saving'} disabled={!onSave || actionState !== 'idle'} onclick={() => void saveSettings()} />
      </section>
      <section>
        <h2 class={stylex.attrs(projectStyles.sectionHeading).class}>{tx('project.settings.linksHeading')}</h2>
        <Table
          caption={tx('project.settings.linksCaption', { project: project.name })}
          columns={[
            { key: 'label', label: tx('project.settings.surface') },
            { key: 'value', label: tx('project.settings.value') },
          ]}
          rows={links.map((link) => ({ ...link, label: linkLabel(link.label) }))}
        />
      </section>
    </div>
    <ProjectLifecyclePanel
      projectName={project.name}
      projectStatus={project.status ?? 'published'}
      {projectCapabilities}
      {onCloseProject}
    />
  {/if}
</ProjectDashShell>
