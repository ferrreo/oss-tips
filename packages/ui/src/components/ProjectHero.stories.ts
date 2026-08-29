import { demoProject } from "../fixtures/demo.js";
import type { Meta, StoryObj } from '@storybook/svelte';
import ProjectHero from './ProjectHero.svelte';

const meta: Meta<ProjectHero> = {
  title: 'Components/ProjectHero',
  component: ProjectHero,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { project: demoProject } };
export const Dark: Story = { args: { project: demoProject }, globals: { theme: 'dark' } };
