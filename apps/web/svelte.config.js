import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    outDir: process.env.SVELTEKIT_OUT_DIR ?? '.svelte-kit',
    adapter: adapter(),
    csp: {
      mode: 'nonce',
      directives: {
        'default-src': ['self'],
        'base-uri': ['self'],
        'object-src': ['none'],
        'frame-ancestors': ['none'],
        'script-src': ['self', 'https://js.stripe.com'],
        'style-src': ['self', 'https://fonts.googleapis.com'],
        'style-src-attr': ['unsafe-inline'],
        'font-src': ['self', 'https://fonts.gstatic.com'],
        'img-src': ['self', 'data:', 'blob:', 'https://*.stripe.com'],
        'connect-src': [
          'self',
          'https://api.stripe.com',
          'https://*.stripe.com',
          'https://*.stripe.network',
          'https://fonts.googleapis.com',
          'https://fonts.gstatic.com',
        ],
        'frame-src': [
          'https://js.stripe.com',
          'https://hooks.stripe.com',
          'https://checkout.stripe.com',
          'https://*.stripe.com',
        ],
        'form-action': ['self', 'https://checkout.stripe.com'],
        'manifest-src': ['self'],
        'worker-src': ['self', 'blob:'],
      },
    },
    alias: {
      '@oss-tips/ui': '../../packages/ui/src',
    },
  },
};

export default config;
