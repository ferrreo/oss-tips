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
export const Fallback: Story = {
  args: {
    project: { ...demoProject, logoLetter: 'O' },
  },
};
export const Small: Story = { args: { project: demoProject, size: 'small' } };
export const Compact: Story = {
  args: { project: demoProject, size: 'small' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const FallbackSmall: Story = {
  args: {
    project: { ...demoProject, logoLetter: 'T' },
    size: 'small',
  },
};
export const WithLogoUrl: Story = {
  args: {
    project: {
      ...demoProject,
      logoUrl: 'https://avatars.githubusercontent.com/u/9919?s=128&v=4',
    },
  },
};
export const Dark: Story = { args: { project: demoProject }, globals: { theme: 'dark' } };
export const DarkFallback: Story = {
  args: {
    project: { ...demoProject, logoLetter: 'O' },
  },
  globals: { theme: 'dark' },
};
