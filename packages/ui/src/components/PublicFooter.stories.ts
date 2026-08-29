import type { Meta, StoryObj } from '@storybook/svelte';
import PublicFooter from './PublicFooter.svelte';

const meta: Meta<PublicFooter> = {
  title: 'Components/PublicFooter',
  component: PublicFooter,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { theme: 'light' } };
export const Dark: Story = { args: { theme: 'dark' }, globals: { theme: 'dark' } };
