import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import { createFileSystemTypesCache } from '@shikijs/vitepress-twoslash/cache-fs'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitepress'
import llmstxt from 'vitepress-plugin-llms'

import { ensureBrandAssets } from '@lawha/brand-tools'
import { ensureDemoDocument } from '@lawha/demo-tools'
import { landingPosterFingerprint } from '@lawha/landing-posters-tools/fingerprint'
import { appSourceConfig } from '@lawha/vite-config/app-source'

import { landingPreloads } from './landing-head.ts'
import { docsLocales } from './locales.ts'
import { rootThemeConfig } from './root-theme.ts'
import { BASE, LOCALE_PREFIXES, applyPageSeo, siteHead, withAlternateSitemapLinks } from './seo.ts'

await Promise.all([ensureBrandAssets(['docs']), ensureDemoDocument()])

const configDir = dirname(fileURLToPath(import.meta.url))
const docsRoot = dirname(configDir)
const packagesRoot = dirname(docsRoot)
const repoRoot = dirname(packagesRoot)
// The landing page mounts the app's own components, compiled from source.
const appSource = appSourceConfig()
const fastBuild = process.env.LAWHA_DOCS_FAST_BUILD === '1'
// Production builds show stills of the landing's stages until they are live. The build names
// the stills by this fingerprint, and `tools/generate/landing-posters` captures them afterwards.
const posterFingerprint =
  process.env.LAWHA_LANDING_POSTERS === '1' ? await landingPosterFingerprint(repoRoot) : null

const llmsPlugin = llmstxt({
  domain: BASE,
  ignoreFiles: LOCALE_PREFIXES.map((locale) => `${locale}/**`),
  generateLLMsTxt: !fastBuild,
  generateLLMsFullTxt: !fastBuild,
  generateLLMFriendlyDocsForEachPage: !fastBuild,
  injectLLMHint: false,
  customTemplateVariables: {
    title: 'Lawha',
    description:
      'Open-source, AI-native design editor and toolkit. Opens Figma .fig files, provides a programmable scene graph, CLI, MCP server, and Vue SDK for custom editor shells.',
    details:
      'Use this file as the compact map for agents. For complete Markdown content, fetch https://github.com/aliaaldihnayn-lab/design#readme'
  }
})

export default defineConfig({
  title: 'Lawha',
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

  transformPageData(pageData) {
    applyPageSeo(pageData)
    if (posterFingerprint && pageData.frontmatter.landing === true) {
      pageData.frontmatter.posters = posterFingerprint
    }
  },
  transformHead: landingPreloads,

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
              '@lawha/vue': ['packages/vue/src/index.ts'],
              '@lawha/vue/*': ['packages/vue/src/*'],
              '#vue/*': ['packages/vue/src/*'],
              '@lawha/scene-graph': ['packages/scene-graph/src/index.ts'],
              '@lawha/scene-graph/*': ['packages/scene-graph/src/*'],
              '#scene-graph/*': ['packages/scene-graph/src/*']
            }
          }
        }
      })
    ]
  },

  vite: {
    resolve: {
      alias: [
        { find: '#docs-api', replacement: resolve(docsRoot, 'programmable/sdk/api') },
        { find: '#docs', replacement: configDir },
        ...appSource.alias
      ]
    },
    define: appSource.define,
    plugins: [...appSource.plugins, tailwindcss(), llmsPlugin]
  },

  locales: docsLocales,

  themeConfig: rootThemeConfig()
})
