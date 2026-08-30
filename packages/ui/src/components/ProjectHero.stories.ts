import type { Meta, StoryObj } from '@storybook/svelte-vite';
import { demoProject } from '../fixtures/demo.js';
import ProjectHero from './ProjectHero.svelte';

const meta = {
  title: 'Components/ProjectHero',
  component: ProjectHero,
} satisfies Meta<typeof ProjectHero>;

const projectWithLogo = {
  ...demoProject,
  logoUrl: 'https://avatars.githubusercontent.com/u/9919?s=128&v=4',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { project: demoProject } };
export const Dark: Story = { args: { project: demoProject }, globals: { theme: 'dark' } };
export const WithProjectLogo: Story = {
  args: { project: projectWithLogo },
};
export const LongLinks: Story = {
  args: {
    project: {
      ...demoProject,
      name: 'A project with a deliberately long name',
      repository: 'github.com/oss-tips/dependency-health-checks-and-release-notes-for-maintainers',
      website: 'https://grove.dev/projects/dependency-health-checks-and-release-notes',
    },
  },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
