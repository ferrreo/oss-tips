<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Table from '../../components/Table.svelte';
  import type { NavGroup, Project } from '../../fixtures/demo.js';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { domainRows } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { locale, t, type MessageKey } from '../../lib/i18n.js';

  export type DomainVerificationState = 'idle' | 'loading' | 'success' | 'error';

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    records?: typeof domainRows;
    pageState?: 'ready' | 'error' | 'permission';
    verificationState?: DomainVerificationState;
    verificationMessage?: string;
    verificationError?: string;
    onVerify?: (hostname: string) => void | Promise<void>;
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    records = domainRows,
    pageState = 'ready',
    verificationState = 'idle',
    verificationMessage = '',
    verificationError = '',
    onVerify,
  }: Props = $props();

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);

  let hostname = $state('');
  let hostnameInitialized = $state(false);
  $effect(() => {
    if (!hostnameInitialized) {
      hostname = records[0]?.host ?? '';
      hostnameInitialized = true;
    }
  });
  const verificationRecord = $derived(records.find((record) => record.type.toUpperCase() === 'TXT'));
  const verificationName = $derived(
    verificationRecord?.host ?? (hostname ? `_oss-tips.${hostname}` : '—'),
  );
  const verificationValue = $derived(verificationRecord?.target ?? tx('project.domains.pendingValue'));
  const active = $derived(records.some((record) => record.status.toLowerCase() === 'active'));
  const domainsEnabled = $derived(project.feeMode === 'project_5pct');
  const projectDomain = $derived(project.website.replace(/^https?:\/\//, '').replace(/\/$/, ''));


  function handleVerify() {
    void onVerify?.(hostname.trim());
  }
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={tx('project.domains.title')}
  lede={tx('project.domains.lede', { project: project.name, domain: projectDomain })}
>
  {#if pageState === 'error'}
    <div class={stylex.attrs(projectStyles.error).class} role="alert">
      <strong>{tx('project.domains.loadError')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.domains.loadErrorBody')}</p>
    </div>
  {:else if pageState === 'permission'}
    <div class={stylex.attrs(projectStyles.permission).class} role="status">
      <strong>{tx('project.domains.permission')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.domains.permissionBody')}</p>
    </div>
  {:else}
    <StatusBanner
      variant={domainsEnabled && active ? 'info' : 'warning'}
      title={
        !domainsEnabled
          ? tx('project.domains.requiresFeeMode')
          : active
            ? tx('project.domains.live', { hostname: hostname || tx('project.domains.customDomain') })
            : tx('project.domains.inProgress')
      }
      message={
        !domainsEnabled
          ? tx('project.domains.requiresFeeModeBody')
          : tx('project.domains.activeBody')
      }
    />
    {#if verificationState === 'error'}
      <div class={stylex.attrs(projectStyles.error, projectStyles.section).class} role="alert">
        <strong>{tx('project.domains.verificationFailed')}</strong>
        <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>
          {verificationError || tx('project.domains.checkDns')}
        </p>
      </div>
    {:else if verificationState === 'success'}
      <StatusBanner
        variant="info"
        title={tx('project.domains.checkQueued')}
        message={verificationMessage || tx('project.domains.checkQueuedBody')}
      />
    {/if}
    <section class={stylex.attrs(projectStyles.surface, projectStyles.formSurface, projectStyles.section).class} aria-labelledby="domain-settings-heading">
      <h2 id="domain-settings-heading" class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.domains.settingsHeading')}</h2>
      <div class={stylex.attrs(projectStyles.stack).class}>
        <TextField bind:value={hostname} label={tx('project.domains.customDomain')} help={tx('project.domains.publicOnly')} disabled={!domainsEnabled} />
        <TextField
          label={tx('project.domains.dnsVerification')}
          value={verificationName}
          help={tx('project.domains.txtValue', { value: verificationValue })}
          disabled
        />
        <Button
          variant="primary"
          label={verificationState === 'loading' ? tx('project.domains.checking') : tx('project.domains.verify')}
          loading={verificationState === 'loading'}
          disabled={!domainsEnabled || !hostname.trim()}
          onclick={handleVerify}
        />
      </div>
    </section>
    <h2 class={stylex.attrs(projectStyles.sectionHeading).class}>{tx('project.domains.recordsHeading')}</h2>
    {#if records.length > 0}
      <Table
        caption={tx('project.domains.recordsCaption')}
        columns={[
          { key: 'host', label: tx('project.domains.host') },
          { key: 'type', label: tx('project.domains.type') },
          { key: 'status', label: tx('project.domains.status') },
          { key: 'target', label: tx('project.domains.target') },
        ]}
        rows={records}
      />
    {:else}
      <EmptyState title={tx('project.domains.emptyTitle')} description={tx('project.domains.emptyBody')} />
    {/if}
  {/if}
</ProjectDashShell>
