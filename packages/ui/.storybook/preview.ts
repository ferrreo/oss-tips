import type { Preview } from '@storybook/svelte-vite';
import * as stylex from '@stylexjs/stylex';
import { paperlightDark } from '@oss-tips/design-tokens/paperlight.stylex';
import { isLocale, setLocale } from '../src/lib/i18n.js';
import '@oss-tips/design-tokens/css';
import '../src/styles.css';

if (import.meta.env.DEV) {
  // @ts-expect-error virtual module supplied by @stylexjs/unplugin in development
  void import('virtual:stylex:runtime');
}

const darkThemeClasses = stylex.attrs(paperlightDark).class?.split(/\s+/).filter(Boolean) ?? [];
const storybookThemeStorageKey = 'oss-tips-theme';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
  globalTypes: {
    theme: {
      description: 'Colour theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: 'Interface language',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        items: [
          { value: 'en-GB', title: 'English' },
          { value: 'de', title: 'Deutsch' },
          { value: 'fr', title: 'Français' },
          { value: 'es', title: 'Español' },
          { value: 'pt-BR', title: 'Português (Brasil)' },
        ],
        dynamicTitle: true,
      },
    },
    direction: {
      description: 'Layout direction smoke test',
      toolbar: {
        title: 'Direction',
        icon: 'transfer',
        items: [
          { value: 'ltr', title: 'LTR' },
          { value: 'rtl', title: 'RTL' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
    locale: 'en-GB',
    direction: 'ltr',
  },
  decorators: [
    (story, context) => {
      const theme = context.globals.theme ?? 'light';
      const currentLocale = context.globals.locale;
      const direction = context.globals.direction === 'rtl' ? 'rtl' : 'ltr';
      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        try {
          window.localStorage.setItem(storybookThemeStorageKey, theme);
        } catch {
          // Storybook can run with storage disabled.
        }
        root.setAttribute('data-theme', theme);
        for (const className of darkThemeClasses) {
          root.classList.toggle(className, theme === 'dark');
        }
      }
      if (isLocale(currentLocale)) setLocale(currentLocale, { persist: false });
      if (typeof document !== 'undefined') document.documentElement.dir = direction;
      return story();
    },
  ],
};

export default preview;
