<script lang="ts">
  import { tick } from 'svelte';
  import { parseSafeEmbed, renderSafeMarkdown } from '@oss-tips/domain/content';
  import { stylex } from '../styles/stylex-runtime.js';
  import { controls } from '../styles/controls.stylex';
  import { primitives } from '../styles/primitives.stylex';
  import { postEditorStyles } from '../styles/post-editor.stylex';
  import { locale, t } from '../lib/i18n.js';

  export type EditorMode = 'source' | 'preview';
  export type UploadState = 'idle' | 'uploading' | 'ready' | 'error';

  export interface Attachment {
    id: string;
    name: string;
    sizeLabel?: string;
    url?: string;
  }

  export type AttachmentUploadAction = (
    file: File,
  ) => string | void | Promise<string | void>;

  export interface Props {
    label?: string;
    id?: string;
    value?: string;
    visibility?: string;
    help?: string;
    error?: string | undefined;
    disabled?: boolean;
    initialMode?: EditorMode;
    codeLanguage?: string;
    uploadState?: UploadState;
    uploadProgress?: number;
    uploadError?: string | undefined;
    attachments?: Attachment[];
    onUploadAttachment?: AttachmentUploadAction | undefined;
  }

  const codeLanguages = ['text', 'md', 'ts', 'js', 'json', 'bash', 'css', 'html'] as const;

  let {
    label,
    id,
    value = $bindable(''),
    visibility = 'Public',
    help,
    error,
    disabled = false,
    initialMode = 'source',
    codeLanguage = $bindable('text'),
    uploadState = 'idle',
    uploadProgress = 0,
    uploadError,
    attachments = [],
    onUploadAttachment,
  }: Props = $props();

  let editorMode = $state<EditorMode>('source');
  let embedOpen = $state(false);
  let embedUrl = $state('');
  let embedError = $state('');
  let uploadActionError = $state('');
  let textareaElement = $state<HTMLTextAreaElement | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);

  $effect(() => {
    editorMode = initialMode;
  });

  const componentId = $props.id();
  const generatedId = `${componentId}-markdown`;
  const inputId = $derived(id ?? generatedId);
  const helpId = $derived(`${inputId}-help`);
  const errorId = $derived(`${inputId}-error`);
  const previewId = $derived(`${inputId}-preview`);
  const displayLabel = $derived(label ?? t('editor.postBody', {}, $locale));
  const displayHelp = $derived(help ?? t('editor.markdownHelp', {}, $locale));
  const describedBy = $derived(
    [displayHelp ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined,
  );
  const audienceLabel = $derived(formatAudience(visibility, $locale));
  const progressValue = $derived(Math.min(100, Math.max(0, uploadProgress)));
  const uploadButtonDisabled = $derived(disabled || uploadState === 'uploading' || !onUploadAttachment);
  const statusError = $derived(uploadError || uploadActionError);

  function toolbarAttrs(active = false) {
    return stylex.attrs(
      postEditorStyles.toolbarButton,
      active ? postEditorStyles.toolbarButtonActive : null,
      controls.focusRing,
    );
  }

  function replaceSelection(before: string, after: string, fallback: string) {
    if (disabled || editorMode !== 'source') return;
    const current = value;
    const start = textareaElement?.selectionStart ?? current.length;
    const end = textareaElement?.selectionEnd ?? start;
    const selected = current.slice(start, end) || fallback;
    value = `${current.slice(0, start)}${before}${selected}${after}${current.slice(end)}`;
    const selectionStart = start + before.length;
    void tick().then(() => {
      textareaElement?.focus();
      textareaElement?.setSelectionRange(selectionStart, selectionStart + selected.length);
    });
  }

  function prefixSelection(prefix: string) {
    if (disabled || editorMode !== 'source') return;
    const current = value;
    const start = textareaElement?.selectionStart ?? current.length;
    const end = textareaElement?.selectionEnd ?? start;
    const selected = current.slice(start, end) || t('editor.quoteFallback', {}, $locale);
    const lines = selected.split('\n').map((line) => `${prefix}${line}`).join('\n');
    value = `${current.slice(0, start)}${lines}${current.slice(end)}`;
    void tick().then(() => {
      textareaElement?.focus();
      textareaElement?.setSelectionRange(start, start + lines.length);
    });
  }

  function insertCodeBlock() {
    replaceSelection(`\n\n\`\`\`${codeLanguage}\n`, '\n\n\`\`\`', t('editor.codeBlockFallback', {}, $locale));
  }

  function insertLink() {
    if (disabled || editorMode !== 'source') return;
    const current = value;
    const start = textareaElement?.selectionStart ?? current.length;
    const end = textareaElement?.selectionEnd ?? start;
    const selected = current.slice(start, end) || t('editor.link', {}, $locale);
    const snippet = `[${selected}](https://oss.tips)`;
    value = `${current.slice(0, start)}${snippet}${current.slice(end)}`;
    void tick().then(() => {
      textareaElement?.focus();
      const urlStart = start + selected.length + 3;
      textareaElement?.setSelectionRange(urlStart, urlStart + 'https://oss.tips'.length);
    });
  }

  function appendEmbed(marker: string) {
    const current = value.trimEnd();
    value = current ? `${current}\n\n${marker}\n` : `${marker}\n`;
  }

  function insertEmbed() {
    const embed = parseSafeEmbed(embedUrl);
    if (!embed) {
      embedError = t('editor.embedUrlError', {}, $locale);
      return;
    }
    appendEmbed(`@[${embed.provider}](${embed.url})`);
    embedError = '';
    embedUrl = '';
    embedOpen = false;
  }

  function openFilePicker() {
    if (!uploadButtonDisabled) fileInput?.click();
  }

  async function requestUpload(file: File) {
    if (uploadButtonDisabled) return;
    uploadActionError = '';
    try {
      const url = await onUploadAttachment?.(file);
      if (url) {
        const label = file.name.replace(/[\\[\]]/g, '\\$&');
        const current = value.trimEnd();
        value = `${current ? `${current}\n\n` : ''}[${label}](${url})\n`;
      }
    } catch (cause) {
      uploadActionError = cause instanceof Error ? cause.message : t('editor.uploadStartError', {}, $locale);
    }
  }

  function handleFileSelection(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void requestUpload(file);
  }

  function formatAudience(raw: string, currentLocale: import('../lib/i18n.js').Locale): string {
    const normalized = raw.trim().toLowerCase();
    if (!normalized || normalized === 'public') return t('editor.visibilityPublic', {}, currentLocale);
    if (normalized.includes('supporter') || normalized === 'member' || normalized === 'members') {
      return t('editor.visibilitySupporters', {}, currentLocale);
    }
    if (normalized.includes('backer')) return t('editor.visibilityBackers', {}, currentLocale);
    return raw;
  }
</script>

<div class={stylex.attrs(postEditorStyles.root, postEditorStyles.compact).class}>
  <label class={stylex.attrs(postEditorStyles.label).class} for={inputId}><bdi>{displayLabel}</bdi></label>
  {#if displayHelp}
    <p class={stylex.attrs(postEditorStyles.help).class} id={helpId}><bdi>{displayHelp}</bdi></p>
  {/if}

  <div
    class={stylex.attrs(postEditorStyles.toolbar).class}
    role="toolbar"
    aria-label={t('editor.markdownFormatting', {}, $locale)}
    aria-controls={editorMode === 'source' ? inputId : previewId}
  >
    <div class={stylex.attrs(postEditorStyles.toolbarGroup).class} aria-label={t('editor.textFormatting', {}, $locale)}>
      <button type="button" class={toolbarAttrs()} disabled={disabled || editorMode !== 'source'} onclick={() => replaceSelection('**', '**', t('editor.boldFallback', {}, $locale))}><bdi>{t('editor.bold', {}, $locale)}</bdi></button>
      <button type="button" class={toolbarAttrs()} disabled={disabled || editorMode !== 'source'} onclick={() => replaceSelection('*', '*', t('editor.italicFallback', {}, $locale))}><bdi>{t('editor.italic', {}, $locale)}</bdi></button>
      <button type="button" class={toolbarAttrs()} disabled={disabled || editorMode !== 'source'} onclick={insertLink}><bdi>{t('editor.link', {}, $locale)}</bdi></button>
      <button type="button" class={toolbarAttrs()} disabled={disabled || editorMode !== 'source'} onclick={() => replaceSelection('`', '`', t('editor.codeFallback', {}, $locale))}><bdi>{t('editor.inlineCode', {}, $locale)}</bdi></button>
      <button type="button" class={toolbarAttrs()} disabled={disabled || editorMode !== 'source'} onclick={() => prefixSelection('> ')}><bdi>{t('editor.quote', {}, $locale)}</bdi></button>
      <button type="button" class={toolbarAttrs()} disabled={disabled || editorMode !== 'source'} onclick={() => prefixSelection('- ')}><bdi>{t('editor.list', {}, $locale)}</bdi></button>
      <button type="button" class={toolbarAttrs()} disabled={disabled || editorMode !== 'source'} onclick={insertCodeBlock}><bdi>{t('editor.codeBlock', {}, $locale)}</bdi></button>
    </div>

    <label class={stylex.attrs(postEditorStyles.languageLabel).class}>
      <bdi>{t('editor.codeLanguage', {}, $locale)}</bdi>
      <select
        class={stylex.attrs(postEditorStyles.languageSelect, controls.focusRing).class}
        bind:value={codeLanguage}
        disabled={disabled || editorMode !== 'source'}
        aria-label={t('editor.codeLanguage', {}, $locale)}
      >
        {#each codeLanguages as language}
          <option value={language}>{language}</option>
        {/each}
      </select>
    </label>

    <div class={stylex.attrs(postEditorStyles.toolbarGroup).class}>
      <button
        type="button"
        class={toolbarAttrs(embedOpen)}
        disabled={disabled || editorMode !== 'source'}
        aria-pressed={embedOpen}
        onclick={() => {
          embedOpen = !embedOpen;
          embedError = '';
        }}
      ><bdi>{t('editor.addEmbed', {}, $locale)}</bdi></button>
      <button
        type="button"
        class={toolbarAttrs(editorMode === 'source')}
        disabled={disabled}
        aria-pressed={editorMode === 'source'}
        onclick={() => (editorMode = 'source')}
      ><bdi>{t('editor.source', {}, $locale)}</bdi></button>
      <button
        type="button"
        class={toolbarAttrs(editorMode === 'preview')}
        disabled={disabled}
        aria-pressed={editorMode === 'preview'}
        onclick={() => (editorMode = 'preview')}
      ><bdi>{t('editor.preview', {}, $locale)}</bdi></button>
    </div>
  </div>

  {#if embedOpen}
    <form
      class={stylex.attrs(postEditorStyles.embedPanel).class}
      onsubmit={(event) => {
        event.preventDefault();
        insertEmbed();
      }}
    >
      <label class={stylex.attrs(postEditorStyles.label).class} for={`${inputId}-embed-url`}><bdi>{t('editor.providerUrl', {}, $locale)}</bdi></label>
      <p class={stylex.attrs(postEditorStyles.help).class}><bdi>{t('editor.embedHelp', {}, $locale)}</bdi></p>
      <div class={stylex.attrs(postEditorStyles.embedRow).class}>
        <input
          id={`${inputId}-embed-url`}
          class={stylex.attrs(postEditorStyles.embedInput, controls.focusRing).class}
          type="url"
          bind:value={embedUrl}
          placeholder={t('editor.embedPlaceholder', {}, $locale)}
          dir="auto"
          autocomplete="off"
          required
          aria-invalid={embedError ? 'true' : undefined}
        />
        <button type="submit" class={toolbarAttrs()} disabled={disabled}><bdi>{t('editor.insertEmbed', {}, $locale)}</bdi></button>
        <button type="button" class={toolbarAttrs()} disabled={disabled} onclick={() => (embedOpen = false)}><bdi>{t('editor.cancel', {}, $locale)}</bdi></button>
      </div>
      {#if embedError}
        <p class={stylex.attrs(postEditorStyles.status, postEditorStyles.statusError).class} role="alert"><bdi>{embedError}</bdi></p>
      {/if}
    </form>
  {/if}

  {#if editorMode === 'source'}
    <textarea
      id={inputId}
      bind:this={textareaElement}
      class={stylex.attrs(postEditorStyles.source, controls.focusRing).class}
      bind:value={value}
      disabled={disabled}
      aria-describedby={describedBy}
      aria-invalid={error ? 'true' : undefined}
      aria-errormessage={error ? errorId : undefined}
      placeholder={t('editor.writeUpdate', {}, $locale)}
      dir="auto"
      spellcheck="true"
    ></textarea>
  {:else}
    <article
      id={previewId}
      class={stylex.attrs(postEditorStyles.preview).class}
      dir="auto"
      aria-label={t('editor.postPreview', { audience: audienceLabel }, $locale)}
    >
      <div class={stylex.attrs(postEditorStyles.previewMeta).class}>
        <span><bdi>{t('editor.preview', {}, $locale)}</bdi></span>
        <span class={stylex.attrs(postEditorStyles.previewTarget).class}><bdi>{t('editor.targetAudience', { audience: audienceLabel }, $locale)}</bdi></span>
      </div>
      {#if value.trim()}
        <div class={stylex.attrs(postEditorStyles.previewContent).class}>
          {@html renderSafeMarkdown(value, {
            labels: {
              completedTask: t('editor.completedTask', {}, $locale),
              incompleteTask: t('editor.incompleteTask', {}, $locale),
              openEmbed: (provider) => t('editor.openEmbed', { provider }, $locale),
            },
          })}
        </div>
      {:else}
        <p class={stylex.attrs(postEditorStyles.previewEmpty).class}><bdi>{t('editor.nothingYet', {}, $locale)}</bdi></p>
      {/if}
    </article>
  {/if}

  <div class={stylex.attrs(postEditorStyles.embedRow).class}>
    <button
      type="button"
      class={toolbarAttrs()}
      disabled={uploadButtonDisabled}
      aria-busy={uploadState === 'uploading'}
      onclick={openFilePicker}
    ><bdi>{uploadState === 'uploading' ? t('editor.uploadingAttachment', {}, $locale) : t('editor.uploadAttachment', {}, $locale)}</bdi></button>
    <input
      bind:this={fileInput}
      class={stylex.attrs(primitives.srOnly).class}
      type="file"
      accept="image/gif,image/jpeg,image/png,image/webp,application/pdf,text/plain"
      disabled={uploadButtonDisabled}
      aria-label={t('editor.uploadAttachment', {}, $locale)}
      onchange={handleFileSelection}
    />
    {#if uploadState === 'uploading'}
      <progress
        class={stylex.attrs(postEditorStyles.progress).class}
        value={progressValue}
        max="100"
        aria-label={t('editor.uploadProgress', { percent: progressValue }, $locale)}
      ></progress>
    {/if}
    {#if uploadState === 'ready'}
      <p class={stylex.attrs(postEditorStyles.status).class} role="status" aria-live="polite"><bdi>{t('editor.attachmentReady', {}, $locale)}</bdi></p>
    {:else if statusError}
      <p class={stylex.attrs(postEditorStyles.status, postEditorStyles.statusError).class} role="alert"><bdi>{statusError}</bdi></p>
    {:else if !onUploadAttachment}
      <p class={stylex.attrs(postEditorStyles.status).class}><bdi>{t('editor.storageDisabled', {}, $locale)}</bdi></p>
    {/if}
  </div>

  {#if attachments.length > 0}
    <ul class={stylex.attrs(postEditorStyles.attachmentList).class} aria-label={t('editor.postAttachments', {}, $locale)}>
      {#each attachments as attachment (attachment.id)}
        <li class={stylex.attrs(postEditorStyles.attachment).class}>
          {#if attachment.url}
            <a href={attachment.url} class={stylex.attrs(controls.focusRing).class}><bdi>{attachment.name}{attachment.sizeLabel ? ` · ${attachment.sizeLabel}` : ''}</bdi></a>
          {:else}
            <bdi>{attachment.name}{attachment.sizeLabel ? ` · ${attachment.sizeLabel}` : ''}</bdi>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if error}
    <p class={stylex.attrs(postEditorStyles.status, postEditorStyles.statusError).class} id={errorId} role="alert"><bdi>{error}</bdi></p>
  {/if}
</div>
