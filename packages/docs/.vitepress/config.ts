import { defineConfig } from 'vitepress'

import { docsLocales } from './locales'
import { rootThemeConfig } from './root-theme'
import { BASE, applyPageSeo, siteHead, withAlternateSitemapLinks } from './seo'

export default defineConfig({
  title: 'OpenPencil',
  description:
    'Open-source, AI-native design editor. Figma alternative built from scratch with full .fig file compatibility.',
  cleanUrls: true,
  lastUpdated: true,
  appearance: 'dark',

  sitemap: {
    hostname: BASE,
    transformItems: withAlternateSitemapLinks,
  },

  head: siteHead,

  transformPageData: applyPageSeo,

  locales: docsLocales,

  themeConfig: rootThemeConfig(),
})
