import { fileURLToPath, URL } from 'node:url'

import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import { createFileSystemTypesCache } from '@shikijs/vitepress-twoslash/cache-fs'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitepress'
import llmstxt from 'vitepress-plugin-llms'

import { docsLocales } from './locales'
import { rootThemeConfig } from './root-theme'
import { BASE, LOCALE_PREFIXES, applyPageSeo, siteHead, withAlternateSitemapLinks } from './seo'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))

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

  markdown: {
    codeTransformers: [
      transformerTwoslash({
        twoslashOptions: {
          compilerOptions: {
            baseUrl: repoRoot,
            paths: {
              '@open-pencil/vue': ['packages/vue/src/index.ts'],
              '#vue/*': ['packages/vue/src/*']
            }
          },
          typesCache: createFileSystemTypesCache({
            dir: fileURLToPath(new URL('./cache/twoslash', import.meta.url))
          })
        }
      })
    ]
  },

  vite: {
    resolve: {
      alias: {
        '#vue': fileURLToPath(new URL('../../vue/src', import.meta.url))
      }
    },
    plugins: [
      tailwindcss(),
      llmstxt({
        domain: BASE,
        ignoreFiles: LOCALE_PREFIXES.map((locale) => `${locale}/**`),
        generateLLMFriendlyDocsForEachPage: true,
        injectLLMHint: false,
        customTemplateVariables: {
          title: 'OpenPencil',
          description:
            'Open-source, AI-native design editor and toolkit. Opens Figma .fig files, provides a programmable scene graph, CLI, MCP server, and Vue SDK for custom editor shells.',
          details:
            'Use this file as the compact map for agents. For complete Markdown content, fetch https://openpencil.dev/llms-full.txt.'
        }
      })
    ]
  },

  locales: docsLocales,

  themeConfig: rootThemeConfig(),
})
