import type { Meta, StoryObj } from '@storybook/svelte';
import PublicNav from './PublicNav.svelte';

const meta: Meta<PublicNav> = {
  title: 'Components/PublicNav',
  component: PublicNav,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { theme: 'light' } };
export const Dark: Story = { args: { theme: 'dark' }, globals: { theme: 'dark' } };
