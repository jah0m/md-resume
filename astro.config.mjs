import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://md-resume.pages.dev',
  integrations: [sitemap()],
  output: 'static',
});
