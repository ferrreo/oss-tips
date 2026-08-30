import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectCreatePage from './ProjectCreatePage.svelte';
import { createTranslator } from '../../lib/i18n.js';

const tx = createTranslator('en-GB');

const demoCreate = async () => undefined;
const validationErrors = {
  name: tx('dashboard.projectCreate.required'),
  description: tx('dashboard.projectCreate.required'),
  websiteUrl: tx('dashboard.projectCreate.urlInvalid'),
  repositoryUrl: tx('dashboard.projectCreate.urlInvalid'),
  supportEmail: tx('dashboard.projectCreate.emailInvalid'),
  openSourceDeclared: tx('dashboard.projectCreate.openSourceRequired'),
};

const meta = {
  title: 'Pages/Project/ProjectCreate',
  component: ProjectCreatePage,
  parameters: { layout: 'fullscreen' },
  args: { onCreate: demoCreate },
} satisfies Meta<typeof ProjectCreatePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const Submitting: Story = { args: { initialState: 'submitting' } };
export const ValidationError: Story = {
  args: {
    initialValidationError: tx('dashboard.projectCreate.fixErrors'),
    initialFieldErrors: validationErrors,
    initialValues: {
      name: '',
      slug: 'oss-tips',
      description: '',
      websiteUrl: 'oss.tips',
      repositoryUrl: '',
      supportEmail: 'not-an-email',
      openSourceDeclared: false,
    },
  },
};
export const ApiError: Story = { args: { initialState: 'error' } };
export const Success: Story = { args: { initialState: 'success' } };
export const Dark: Story = { globals: { theme: 'dark' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
