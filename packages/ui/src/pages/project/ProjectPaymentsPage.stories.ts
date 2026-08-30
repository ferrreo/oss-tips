import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectPaymentsPage from './ProjectPaymentsPage.svelte';
import { demoPayments } from '../../fixtures/demo.js';
import { extraPayments } from './project-demo.js';

const meta = {
  title: 'Pages/ProjectDashboard/Payments',
  component: ProjectPaymentsPage,
  parameters: { layout: 'fullscreen' },
  args: { payments: [...demoPayments, ...extraPayments], onExport: async () => {} },
} satisfies Meta<typeof ProjectPaymentsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Empty: Story = { args: { payments: [] } };
export const Error: Story = { args: { pageState: 'error' } };
export const Permission: Story = { args: { pageState: 'permission' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
