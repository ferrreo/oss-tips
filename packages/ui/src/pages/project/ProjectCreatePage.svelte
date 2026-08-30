<script lang="ts">
  import { untrack } from 'svelte';
  import Button from '../../components/Button.svelte';
  import PublicPageFrame from '../public/PublicPageFrame.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import TextField from '../../components/TextField.svelte';
  import { locale, t, type MessageKey } from '../../lib/i18n.js';
  import { controls } from '../../styles/controls.stylex.js';
  import { primitives } from '../../styles/primitives.stylex.js';
  import { publicStyles } from '../../styles/public.stylex.js';
  import { stylex } from '../../styles/stylex-runtime.js';

  export type ProjectCreateInput = {
    name: string;
    slug: string;
    description: string;
    websiteUrl: string;
    supportEmail: string;
    repositoryUrl: string;
    openSourceDeclared: boolean;
    openSourceLicense?: string | null;
    defaultCurrency: string;
    organisationName?: string;
    ecosystems: string[];
    languages: string[];
    tags: string[];
  };

  export type ProjectCreateState = 'ready' | 'submitting' | 'success' | 'error';
  export type ProjectCreateFieldErrors = Partial<Record<keyof ProjectCreateInput, string>>;

  export interface ProjectCreateValues {
    name?: string;
    slug?: string;
    description?: string;
    websiteUrl?: string;
    supportEmail?: string;
    repositoryUrl?: string;
    openSourceDeclared?: boolean;
    openSourceLicense?: string | null;
    defaultCurrency?: string;
    organisationName?: string;
    ecosystems?: string;
    languages?: string;
    tags?: string;
  }

  export interface Props {
    initialValues?: ProjectCreateValues;
    initialState?: ProjectCreateState;
    initialError?: string;
    initialValidationError?: string;
    initialFieldErrors?: ProjectCreateFieldErrors;
    onCreate?: (input: ProjectCreateInput) => void | Promise<void>;
  }

  let {
    initialValues = {},
    initialState = 'ready',
    initialError = '',
    initialValidationError = '',
    initialFieldErrors,
    onCreate,
  }: Props = $props();

  const seed = untrack(() => initialValues);
  let name = $state(seed.name ?? '');
  let slug = $state(seed.slug ?? '');
  let description = $state(seed.description ?? '');
  let websiteUrl = $state(seed.websiteUrl ?? '');
  let supportEmail = $state(seed.supportEmail ?? '');
  let repositoryUrl = $state(seed.repositoryUrl ?? '');
  let openSourceDeclared = $state(seed.openSourceDeclared ?? false);
  let openSourceLicense = $state(seed.openSourceLicense ?? '');
  let defaultCurrency = $state(seed.defaultCurrency ?? 'gbp');
  let organisationName = $state(seed.organisationName ?? '');
  let ecosystems = $state(seed.ecosystems ?? '');
  let languages = $state(seed.languages ?? '');
  let tags = $state(seed.tags ?? '');
  let actionState = $state<ProjectCreateState>(untrack(() => initialState));
  let actionError = $state(untrack(() => initialError));
  let validationSummary = $state(untrack(() => initialValidationError));

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);
  const containerClass = stylex.attrs(publicStyles.container).class ?? '';
  const sectionClass = stylex.attrs(publicStyles.section).class ?? '';
  const stackClass = stylex.attrs(publicStyles.stack).class ?? '';
  const surfaceClass = stylex.attrs(publicStyles.surface).class ?? '';
  const twoColumnClass = stylex.attrs(publicStyles.twoColumn).class ?? '';
  const rowClass = stylex.attrs(publicStyles.row).class ?? '';
  const titleClass = stylex.attrs(publicStyles.pageTitle).class ?? '';
  const leadClass = stylex.attrs(publicStyles.lead).class ?? '';
  const fieldErrorClass = stylex.attrs(controls.fieldError).class ?? '';
  const componentId = $props.id();
  const openSourceInputId = `${componentId}-open-source`;
  const openSourceErrorId = `${openSourceInputId}-error`;

  const currencyOptions = [
    { value: 'gbp', label: 'GBP' },
    { value: 'eur', label: 'EUR' },
    { value: 'usd', label: 'USD' },
    { value: 'jpy', label: 'JPY' },
  ];

  function listValues(value: string): string[] {
    return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
  }

  function validHttpUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function createInput(): ProjectCreateInput {
    const input: ProjectCreateInput = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      description: description.trim(),
      websiteUrl: websiteUrl.trim(),
      supportEmail: supportEmail.trim().toLowerCase(),
      repositoryUrl: repositoryUrl.trim(),
      openSourceDeclared,
      defaultCurrency,
      ecosystems: listValues(ecosystems),
      languages: listValues(languages),
      tags: listValues(tags),
    };
    const license = openSourceLicense.trim();
    const organisation = organisationName.trim();
    if (license) input.openSourceLicense = license;
    if (organisation) input.organisationName = organisation;
    return input;
  }

  function validate(input: ProjectCreateInput): ProjectCreateFieldErrors {
    const errors: ProjectCreateFieldErrors = {};
    if (!input.name) errors.name = tx('dashboard.projectCreate.required');
    if (!input.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
      errors.slug = tx('dashboard.projectCreate.slugInvalid');
    }
    if (!input.description) errors.description = tx('dashboard.projectCreate.required');
    if (input.description.length > 5000) errors.description = tx('dashboard.projectCreate.descriptionTooLong');
    if (!validHttpUrl(input.websiteUrl)) errors.websiteUrl = tx('dashboard.projectCreate.urlInvalid');
    if (!validHttpUrl(input.repositoryUrl)) errors.repositoryUrl = tx('dashboard.projectCreate.urlInvalid');
    if (!/^\S+@\S+\.\S+$/.test(input.supportEmail)) errors.supportEmail = tx('dashboard.projectCreate.emailInvalid');
    if (!input.openSourceDeclared) errors.openSourceDeclared = tx('dashboard.projectCreate.openSourceRequired');
    if (input.openSourceLicense && input.openSourceLicense.length > 120) {
      errors.openSourceLicense = tx('dashboard.projectCreate.licenseTooLong');
    }
    if (input.organisationName && input.organisationName.length > 160) {
      errors.organisationName = tx('dashboard.projectCreate.organisationTooLong');
    }
    return errors;
  }

  let fieldErrors = $state<ProjectCreateFieldErrors>(
    untrack(() => initialFieldErrors ?? (initialValidationError ? validate(createInput()) : {})),
  );

  const hasFieldErrors = $derived(Object.keys(fieldErrors).length > 0);

  function revalidate() {
    if (!validationSummary && !hasFieldErrors) return;
    const nextErrors = validate(createInput());
    fieldErrors = nextErrors;
    if (Object.keys(nextErrors).length === 0) validationSummary = '';
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!onCreate || actionState === 'submitting' || actionState === 'success') return;
    actionError = '';
    validationSummary = '';
    const input = createInput();
    fieldErrors = validate(input);
    if (Object.keys(fieldErrors).length > 0) {
      validationSummary = tx('dashboard.projectCreate.fixErrors');
      actionState = 'ready';
      return;
    }
    actionState = 'submitting';
    try {
      await onCreate(input);
      actionState = 'success';
    } catch {
      actionState = 'error';
      actionError = tx('dashboard.projectCreate.apiError');
    }
  }
</script>

<PublicPageFrame>
  {#snippet children()}
    <section class={sectionClass}>
      <div class={containerClass}>
        <div class={stylex.attrs(publicStyles.reading).class}>
          <p class={stylex.attrs(publicStyles.muted, publicStyles.small).class}>{tx('dashboard.projectCreate.kicker')}</p>
          <h1 class={titleClass}>{tx('dashboard.projectCreate.title')}</h1>
          <p class={leadClass}>{tx('dashboard.projectCreate.lede')}</p>

          {#if actionState === 'success'}
            <StatusBanner
              variant="info"
              title={tx('dashboard.projectCreate.success')}
              message={tx('dashboard.projectCreate.successBody')}
            />
          {:else if actionState === 'error'}
            <StatusBanner
              variant="danger"
              title={tx('dashboard.projectCreate.error')}
              message={actionError || tx('dashboard.projectCreate.apiError')}
            />
          {/if}

          <form class={`${surfaceClass} ${stackClass}`.trim()} onsubmit={submit} novalidate>
            <div>
              <h2 class={stylex.attrs(publicStyles.sectionTitle).class}>{tx('dashboard.projectCreate.detailsHeading')}</h2>
              <p class={stylex.attrs(publicStyles.muted, publicStyles.small).class}>{tx('dashboard.projectCreate.detailsHelp')}</p>
            </div>
            <div class={twoColumnClass}>
              <TextField
                label={tx('dashboard.projectCreate.name')}
                bind:value={name}
                error={fieldErrors.name ?? ''}
                oninput={revalidate}
                required
                autocomplete="organization"
              />
              <TextField
                label={tx('dashboard.projectCreate.slug')}
                bind:value={slug}
                error={fieldErrors.slug ?? ''}
                help={tx('dashboard.projectCreate.slugHelp')}
                oninput={revalidate}
                required
                autocomplete="off"
              />
            </div>
            <TextField
              label={tx('dashboard.projectCreate.description')}
              bind:value={description}
              error={fieldErrors.description ?? ''}
              help={tx('dashboard.projectCreate.descriptionHelp')}
              oninput={revalidate}
              required
            />
            <div class={twoColumnClass}>
              <TextField
                label={tx('dashboard.projectCreate.website')}
                bind:value={websiteUrl}
                error={fieldErrors.websiteUrl ?? ''}
                type="text"
                inputmode="url"
                oninput={revalidate}
                required
              />
              <TextField
                label={tx('dashboard.projectCreate.repository')}
                bind:value={repositoryUrl}
                error={fieldErrors.repositoryUrl ?? ''}
                type="text"
                inputmode="url"
                oninput={revalidate}
                required
              />
            </div>
            <div class={twoColumnClass}>
              <TextField
                label={tx('dashboard.projectCreate.supportEmail')}
                bind:value={supportEmail}
                error={fieldErrors.supportEmail ?? ''}
                type="email"
                autocomplete="email"
                oninput={revalidate}
                required
              />
              <TextField
                label={tx('dashboard.projectCreate.license')}
                bind:value={openSourceLicense}
                error={fieldErrors.openSourceLicense ?? ''}
                help={tx('dashboard.projectCreate.licenseHelp')}
                oninput={revalidate}
              />
            </div>

            <div>
              <h2 class={stylex.attrs(publicStyles.sectionTitle).class}>{tx('dashboard.projectCreate.discoveryHeading')}</h2>
              <p class={stylex.attrs(publicStyles.muted, publicStyles.small).class}>{tx('dashboard.projectCreate.discoveryHelp')}</p>
            </div>
            <div class={twoColumnClass}>
              <TextField label={tx('dashboard.projectCreate.organisation')} bind:value={organisationName} error={fieldErrors.organisationName ?? ''} help={tx('dashboard.projectCreate.organisationHelp')} oninput={revalidate} />
              <SegmentedControl label={tx('dashboard.projectCreate.currency')} options={currencyOptions} bind:value={defaultCurrency} />
            </div>
            <div class={twoColumnClass}>
              <TextField label={tx('dashboard.projectCreate.ecosystems')} bind:value={ecosystems} help={tx('dashboard.projectCreate.listHelp')} oninput={revalidate} />
              <TextField label={tx('dashboard.projectCreate.languages')} bind:value={languages} help={tx('dashboard.projectCreate.listHelp')} oninput={revalidate} />
            </div>
            <TextField label={tx('dashboard.projectCreate.tags')} bind:value={tags} help={tx('dashboard.projectCreate.listHelp')} oninput={revalidate} />

            <label class={rowClass} for={openSourceInputId}>
              <input
                id={openSourceInputId}
                class={stylex.attrs(primitives.focusRing).class}
                type="checkbox"
                bind:checked={openSourceDeclared}
                aria-invalid={fieldErrors.openSourceDeclared ? 'true' : undefined}
                aria-describedby={fieldErrors.openSourceDeclared ? openSourceErrorId : undefined}
                aria-errormessage={fieldErrors.openSourceDeclared ? openSourceErrorId : undefined}
                onchange={revalidate}
              />
              <span>
                {tx('dashboard.projectCreate.openSourceDeclaration')}
                {#if fieldErrors.openSourceDeclared}
                  <span class={fieldErrorClass} id={openSourceErrorId} role="alert">{fieldErrors.openSourceDeclared}</span>
                {/if}
              </span>
            </label>

            {#if validationSummary}
              <p class={stylex.attrs(publicStyles.muted, publicStyles.small).class} role="alert">{validationSummary}</p>
            {/if}
            <Button
              type="submit"
              variant="primary"
              label={actionState === 'submitting' ? tx('dashboard.projectCreate.submitting') : tx('dashboard.projectCreate.submit')}
              loading={actionState === 'submitting'}
              disabled={!onCreate || actionState === 'submitting' || actionState === 'success' || hasFieldErrors}
            />
          </form>
        </div>
      </div>
    </section>
  {/snippet}
</PublicPageFrame>
