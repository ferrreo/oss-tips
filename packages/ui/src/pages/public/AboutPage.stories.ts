import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AboutPage from './AboutPage.svelte';

const meta = {
  title: 'Pages/Public/About',
  component: AboutPage,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AboutPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { beliefs: [] } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const Dark: Story = { globals: { theme: 'dark' } };

export const German: Story = {
  globals: { locale: 'de' },
};

export const FrenchDark: Story = {
  globals: { theme: 'dark', locale: 'fr' },
};
