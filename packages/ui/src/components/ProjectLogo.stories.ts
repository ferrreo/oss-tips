import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectLogo from './ProjectLogo.svelte';
import { demoProject } from '../fixtures/demo.js';

const meta = {
  title: 'Components/ProjectLogo',
  component: ProjectLogo,
} satisfies Meta<typeof ProjectLogo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { project: demoProject } };
export const Small: Story = { args: { project: demoProject, size: 'small' } };
export const WithLogoUrl: Story = {
  args: {
    project: {
      ...demoProject,
      logoUrl: 'https://avatars.githubusercontent.com/u/9919?s=128&v=4',
    },
  },
};
export const Dark: Story = { args: { project: demoProject }, globals: { theme: 'dark' } };
