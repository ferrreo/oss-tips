import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupporterHomePage from './SupporterHomePage.svelte';

const meta: Meta<SupporterHomePage> = {
  title: 'Pages/Supporter/Home',
  component: SupporterHomePage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
