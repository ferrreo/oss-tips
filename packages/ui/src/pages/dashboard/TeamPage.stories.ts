import type { Meta, StoryObj } from '@storybook/svelte';
import TeamPage from './TeamPage.svelte';

const meta: Meta<TeamPage> = {
  title: 'Pages/Dashboard/Team',
  component: TeamPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
