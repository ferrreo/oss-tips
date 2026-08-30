import type { Meta, StoryObj } from '@storybook/svelte-vite';
import StoryListContext from '../../../.storybook/StoryListContext.svelte';
import SupporterSecurityRow from './SupporterSecurityRow.svelte';

const meta = {
  title: 'Pages/Supporter/Security row',
  component: SupporterSecurityRow,
  args: {
    label: 'Ada’s MacBook',
    meta: 'Synced devices · Last used 29 Aug 2026 · Backed up',
  },
  decorators: [() => ({ Component: StoryListContext })],
} satisfies Meta<typeof SupporterSecurityRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Last: Story = {
  args: {
    label: 'Safari on macOS',
    meta: 'IP 203.0.113.18 · Last active 29 Aug 2026 · Expires 28 Sep 2026',
    last: true,
  },
};
export const Compact: Story = {
  args: {
    label: 'Chrome on work laptop',
    meta: 'Last active 29 Aug 2026 · Current session',
  },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { globals: { theme: 'dark' } };
