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
  vite: { plugins: [tailwindcss()] },
});
