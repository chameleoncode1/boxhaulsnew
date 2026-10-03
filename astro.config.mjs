// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://boxhauls.com',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // React is for islands only (booking widget, pickers); pages stay static HTML.
  integrations: [mdx(), react()],
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          // Astro marks MDX modules with its own "use astro:head-inject" directive; the bundler's notice about
          // module-level directives is expected and harmless. Every other warning still surfaces.
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && String(warning.message).includes('astro:head-inject')) return;
          warn(warning);
        },
      },
    },
  },
});
