// @ts-check
import { defineConfig } from 'astro/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import sitemap from '@astrojs/sitemap';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
  build: {
    inlineStylesheets: 'always'
  },
  vite: {
    plugins: [tailwindcss()],
  },
  site: 'https://beinghumantester.com',
  // Old URLs from the previous site (beinghumantester.github.io) whose content
  // still exists here. Old URLs without matching content return a 404 on purpose.
  redirects: {
    '/blog/2025/cicd-pytest-jenkins': '/posts/ci_cd_pipeline/',
    '/testing-musings/ci_cd_pipeline_setup_in_pytest': '/posts/ci_cd_pipeline/',
    '/blog/2024/diwali-production-bug-pairwise-testing': '/posts/diwali-production-bug/',
    '/blog/2024/single-alphabet-demo-bug': '/posts/single-alphabet-bug/',
    '/testing-musings/importance-of-single-alphabet': '/posts/single-alphabet-bug/',
    '/testing-musings/unconditional-update': '/posts/unconditional-update-server-down/',
    '/portfolio/breaking-the-autopilot': '/publications/breaking-the-autopilot/',
    '/portfolio/empathy-driving-factor-in-testing': '/publications/empathy-in-fintech-testing/',
    '/portfolio/taqelah_2026': '/talks/taqelah-lightning-talk-2026/',
  },
  integrations: [sitemap()],
});