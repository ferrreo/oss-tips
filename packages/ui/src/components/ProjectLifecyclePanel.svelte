<script lang="ts">
  import { stylex } from '../styles/stylex-runtime.js';
  import { controls } from '../styles/controls.stylex';
  import { projectStyles } from '../styles/project.stylex';
  import Button from './Button.svelte';
  import { locale, t, type MessageKey } from '../lib/i18n.js';

  export type LifecycleMember = {
    name: string;
    email: string;
    role: string;
  };

  export interface Props {
    projectName: string;
    projectStatus?: string;
    projectCapabilities?: readonly string[];
    teamMembers?: LifecycleMember[];
    onTransferOwnership?: ((email: string) => void | Promise<void>) | undefined;
    onCloseProject?: (() => void | Promise<void>) | undefined;
    initialError?: string;
  }

  let {
    projectName,
    projectStatus = 'published',
    projectCapabilities = [],
    teamMembers = [],
    onTransferOwnership,
    onCloseProject,
    initialError = '',
  }: Props = $props();

  let selectedEmail = $state('');
  let confirmClose = $state(false);
  let action = $state<'idle' | 'transfer' | 'close'>('idle');
  let actionError = $state('');

  $effect(() => {
    actionError = initialError;
  });

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);
  const canTransfer = $derived(
    projectCapabilities.includes('project.transfer_ownership') && Boolean(onTransferOwnership),
  );
  const canClose = $derived(
    projectCapabilities.includes('project.delete') && Boolean(onCloseProject),
  );
  const transferTargets = $derived(
    teamMembers.filter((member) => member.role.trim().toLowerCase() !== 'owner'),
  );
  const componentId = $props.id();
  const transferHeadingId = `${componentId}-transfer-heading`;
  const closeHeadingId = `${componentId}-close-heading`;
  const selectId = `${componentId}-transfer-target`;

  async function transfer() {
    if (!onTransferOwnership || !selectedEmail || action !== 'idle') return;
    action = 'transfer';
    actionError = '';
    try {
      await onTransferOwnership(selectedEmail);
    } catch (error) {
      actionError = error instanceof Error ? error.message : tx('project.lifecycle.actionError');
    } finally {
      action = 'idle';
    }
  }

  async function closeProject() {
    if (!onCloseProject || !confirmClose || action !== 'idle') return;
    action = 'close';
    actionError = '';
    try {
      await onCloseProject();
    } catch (error) {
      actionError = error instanceof Error ? error.message : tx('project.lifecycle.actionError');
    } finally {
      action = 'idle';
    }
  }
</script>

{#if canTransfer || canClose || projectStatus === 'closed'}
  <section
    class={stylex.attrs(projectStyles.surface, projectStyles.stack, projectStyles.section).class}
    aria-labelledby={canTransfer ? transferHeadingId : closeHeadingId}
  >
    {#if projectStatus === 'closed'}
      <h2 id={closeHeadingId} class={stylex.attrs(projectStyles.cardHeading).class}>
        {tx('project.lifecycle.closedHeading')}
      </h2>
      <p class={stylex.attrs(projectStyles.body).class}>
        {tx('project.lifecycle.closedBody', { project: projectName })}
      </p>
    {/if}
    {#if canTransfer}
      <div class={stylex.attrs(projectStyles.stack).class}>
        <h2 id={transferHeadingId} class={stylex.attrs(projectStyles.cardHeading).class}>
          {tx('project.lifecycle.transferHeading')}
        </h2>
        <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>
          {tx('project.lifecycle.transferBody')}
        </p>
        {#if transferTargets.length > 0}
          <label for={selectId} class={stylex.attrs(controls.fieldLabel).class}>
            {tx('project.lifecycle.transferTarget')}
          </label>
          <select
            id={selectId}
            class={stylex.attrs(controls.input, controls.focusRing).class}
            bind:value={selectedEmail}
            disabled={action !== 'idle'}
          >
            <option value="">{tx('project.lifecycle.transferChoose')}</option>
            {#each transferTargets as member (member.email)}
              <option value={member.email}>{member.name} · {member.email}</option>
            {/each}
          </select>
          <Button
            variant="secondary"
            label={tx('project.lifecycle.transferButton')}
            loading={action === 'transfer'}
            disabled={!selectedEmail || action !== 'idle'}
            onclick={() => void transfer()}
          />
        {:else}
          <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>
            {tx('project.lifecycle.transferNoTargets')}
          </p>
        {/if}
      </div>
    {/if}
    {#if projectStatus !== 'closed' && canClose}
      <div class={stylex.attrs(projectStyles.stack, projectStyles.lifecycleDanger).class}>
        <h2 id={closeHeadingId} class={stylex.attrs(projectStyles.cardHeading).class}>
          {tx('project.lifecycle.closeHeading')}
        </h2>
        <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>
          {tx('project.lifecycle.closeBody', { project: projectName })}
        </p>
        <label class={stylex.attrs(projectStyles.publicDisplayCheck).class}>
          <input
            class={stylex.attrs(projectStyles.publicDisplayCheckbox, controls.focusRing).class}
            type="checkbox"
            bind:checked={confirmClose}
            disabled={action !== 'idle'}
          />
          <span>{tx('project.lifecycle.closeConfirm')}</span>
        </label>
        <Button
          variant="destructive"
          label={tx('project.lifecycle.closeButton')}
          loading={action === 'close'}
          disabled={!confirmClose || action !== 'idle'}
          onclick={() => void closeProject()}
        />
      </div>
    {/if}
    {#if actionError}
      <p class={stylex.attrs(projectStyles.error, projectStyles.body, projectStyles.small).class} role="alert">
        {actionError}
      </p>
    {/if}
  </section>
{/if}
