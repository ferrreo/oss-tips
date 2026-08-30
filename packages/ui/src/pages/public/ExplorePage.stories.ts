import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ExplorePage from './ExplorePage.svelte';
import { featuredProjects } from '../../fixtures/demo.js';

const realisticData = {
  projects: featuredProjects,
  filters: [
    { id: 'goals', label: 'Active goals' },
    { id: 'recurring', label: 'Recurring support' },
    { id: 'updated', label: 'Recently updated' },
  ],
  initialSearch: '',
  initialFilter: null,
  viewState: 'ready' as const,
};
const meta = {
  title: 'Pages/Public/Explore',
  component: ExplorePage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ExplorePage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const SearchResults: Story = { args: { ...realisticData, initialSearch: 'grove' } };
export const Empty: Story = { args: { ...realisticData, projects: [], viewState: 'empty' } };
export const Error: Story = { args: { ...realisticData, viewState: 'error' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const Dark: Story = { globals: { theme: 'dark' } };
export const French: Story = {
  globals: { locale: 'fr' },
};
export const LongCopy: Story = {
  args: {
    ...realisticData,
    projects: featuredProjects.map((project) => ({
      ...project,
      description: `${project.description} This longer description tests wrapping around project metadata, tags, and localised supporter totals.`,
    })),
  },
};
export const RtlLongCopy: Story = { globals: { locale: 'es', direction: 'rtl' } };
