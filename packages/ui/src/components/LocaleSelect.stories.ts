import type { Meta, StoryObj } from '@storybook/svelte-vite';
import LocaleSelect from './LocaleSelect.svelte';

const meta = {
  title: 'Components/LocaleSelect',
  component: LocaleSelect,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof LocaleSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const English: Story = { globals: { locale: 'en-GB' } };
export const German: Story = { globals: { locale: 'de' } };
export const French: Story = { globals: { locale: 'fr' } };
export const BrazilianPortugueseDark: Story = {
  globals: { locale: 'pt-BR', theme: 'dark' },
};

export const RTLLayoutSmoke: Story = {
  globals: { locale: 'de', direction: 'rtl' },
};
