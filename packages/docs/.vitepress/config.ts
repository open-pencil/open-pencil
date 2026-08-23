import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import { createFileSystemTypesCache } from '@shikijs/vitepress-twoslash/cache-fs'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitepress'
import llmstxt from 'vitepress-plugin-llms'

import { docsLocales } from './locales.ts'
import { rootThemeConfig } from './root-theme.ts'
import { BASE, LOCALE_PREFIXES, applyPageSeo, siteHead, withAlternateSitemapLinks } from './seo.ts'

const configDir = dirname(fileURLToPath(import.meta.url))
const docsRoot = dirname(configDir)
const packagesRoot = dirname(docsRoot)
const repoRoot = dirname(packagesRoot)
const fastBuild = process.env.OPENPENCIL_DOCS_FAST_BUILD === '1'

const llmsPlugin = llmstxt({
  domain: BASE,
  ignoreFiles: LOCALE_PREFIXES.map((locale) => `${locale}/**`),
  generateLLMsTxt: !fastBuild,
  generateLLMsFullTxt: !fastBuild,
  generateLLMFriendlyDocsForEachPage: !fastBuild,
  injectLLMHint: false,
  customTemplateVariables: {
    title: 'OpenPencil',
    description:
      'Open-source, AI-native design editor and toolkit. Opens Figma .fig files, provides a programmable scene graph, CLI, MCP server, and Vue SDK for custom editor shells.',
    details:
      'Use this file as the compact map for agents. For complete Markdown content, fetch https://openpencil.dev/llms-full.txt.'
  }
})

export default defineConfig({
  title: 'OpenPencil',
  description:
    'Open-source, AI-native design editor. Figma alternative built from scratch with full .fig file compatibility.',
  cleanUrls: true,
  lastUpdated: true,
  appearance: 'dark',

  sitemap: {
    hostname: BASE,
    transformItems: withAlternateSitemapLinks
  },

  head: siteHead,

  transformPageData: applyPageSeo,

  markdown: {
    codeTransformers: [
      transformerTwoslash({
        typesCache: createFileSystemTypesCache({
          dir: resolve(configDir, 'cache/twoslash')
        }),
        twoslashOptions: {
          compilerOptions: {
            baseUrl: repoRoot,
            paths: {
              '@open-pencil/vue': ['packages/vue/src/index.ts'],
              '#vue/*': ['packages/vue/src/*']
            }
          }
        }
      })
    ]
  },

  vite: {
    resolve: {
      alias: {
        '#docs': configDir,
        '#docs-api': resolve(docsRoot, 'programmable/sdk/api'),
        '#vue': resolve(packagesRoot, 'vue/src')
      }
    },
    plugins: [tailwindcss(), llmsPlugin]
  },

  locales: docsLocales,

  themeConfig: rootThemeConfig()
})
