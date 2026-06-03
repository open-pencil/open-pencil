import { defineConfig } from 'vitepress'
import llmstxt from 'vitepress-plugin-llms'

import { docsLocales } from './locales'
import { rootThemeConfig } from './root-theme'
import { BASE, LOCALE_PREFIXES, applyPageSeo, siteHead, withAlternateSitemapLinks } from './seo'

export default defineConfig({
  title: 'Inkly',
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

  vite: {
    plugins: [
      llmstxt({
        domain: BASE,
        ignoreFiles: LOCALE_PREFIXES.map((locale) => `${locale}/**`),
        generateLLMFriendlyDocsForEachPage: true,
        injectLLMHint: false,
        customTemplateVariables: {
          title: 'Inkly',
          description:
            'Open-source, AI-native design editor and toolkit. Opens Figma .fig files, provides a programmable scene graph, CLI, MCP server, and Vue SDK for custom editor shells.',
          details:
            'Use this file as the compact map for agents. For complete Markdown content, fetch https://inkly.dev/llms-full.txt.'
        }
      })
    ]
  },

  locales: docsLocales,

  themeConfig: rootThemeConfig(),
})
