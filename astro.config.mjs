// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';

/**
 * Facts that must never reach a browser: the driver share (BoxHauls' cut is the rest) is used only on the server
 * (Pages Functions, the cron Worker) and in server-rendered /drive/ pages. Client bundles (booking widget, account,
 * driver app) get docs/placeholders.json without these keys.
 */
const PRIVATE_FACTS = ['DRIVER_SHARE'];
const stripPrivateFacts = {
  name: 'boxhauls:strip-private-facts',
  enforce: /** @type {const} */ ('pre'),
  /** @param {string} id @param {{ ssr?: boolean } | undefined} opts */
  load(id, opts) {
    if (opts?.ssr || !id.split('?')[0].endsWith('/docs/placeholders.json')) return null;
    const data = JSON.parse(readFileSync(id.split('?')[0], 'utf8'));
    for (const k of PRIVATE_FACTS) delete data[k];
    return JSON.stringify(data);
  },
};

export default defineConfig({
  site: 'https://boxhauls.com',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // React is for islands only (booking widget, pickers); pages stay static HTML.
  integrations: [mdx(), react()],
  vite: {
    plugins: [stripPrivateFacts, tailwindcss()],
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
