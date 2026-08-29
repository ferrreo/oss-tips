import type { Meta, StoryObj } from '@storybook/svelte';
import AboutPage from './AboutPage.svelte';

const meta: Meta<AboutPage> = {
  title: 'Pages/Public/About',
  component: AboutPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
