import type { Meta, StoryObj } from '@storybook/svelte';
import SupportComposer from './SupportComposer.svelte';

const meta: Meta<SupportComposer> = {
  title: 'Components/SupportComposer',
  component: SupportComposer,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };
export const Dark: Story = { args: {}, globals: { theme: 'dark' } };
