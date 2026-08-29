import type { Meta, StoryObj } from '@storybook/svelte';
import PublicFooter from './PublicFooter.svelte';

const meta: Meta<PublicFooter> = {
  title: 'Components/PublicFooter',
  component: PublicFooter,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };
export const Dark: Story = { args: {}, globals: { theme: 'dark' } };
