#!/usr/bin/env bun
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DE,
  DE_PROG,
  EN,
  EN_PROG,
  ES,
  ES_PROG,
  FR,
  FR_PROG,
  IT,
  IT_PROG,
  PL,
  PL_PROG,
  RU,
  RU_PROG
} from '#docs-config/labels'
import type { ProgrammableLabels, SidebarLabels } from '#docs-config/labels'
import { sdkSidebar } from '#docs-config/sdk-sidebar'
import {
  developmentSidebar,
  guideSidebar,
  programmableSidebar,
  referenceSidebar,
  userGuideSidebar
} from '#docs-config/sidebars'

import { checkDocsIntegrity } from './integrity'

interface SidebarItem {
  items?: SidebarItem[]
  link?: string
}

interface LocaleConfig {
  labels: SidebarLabels
  prefix: string
  programmable: ProgrammableLabels
}

const localeConfigs: LocaleConfig[] = [
  { labels: EN, prefix: '', programmable: EN_PROG },
  { labels: DE, prefix: '/de', programmable: DE_PROG },
  { labels: ES, prefix: '/es', programmable: ES_PROG },
  { labels: FR, prefix: '/fr', programmable: FR_PROG },
  { labels: IT, prefix: '/it', programmable: IT_PROG },
  { labels: PL, prefix: '/pl', programmable: PL_PROG },
  { labels: RU, prefix: '/ru', programmable: RU_PROG }
]

function sidebarLinks(items: SidebarItem[]): string[] {
  return items.flatMap((item) => [
    ...(item.link ? [item.link] : []),
    ...(item.items ? sidebarLinks(item.items) : [])
  ])
}

function localeSidebarLinks({ labels, prefix, programmable }: LocaleConfig): string[] {
  const developmentPrefix = prefix ? '' : prefix
  return sidebarLinks([
    ...guideSidebar(prefix, labels),
    ...userGuideSidebar(prefix, labels),
    ...programmableSidebar(prefix, programmable),
    ...sdkSidebar(prefix),
    ...referenceSidebar(prefix, 'Reference', labels),
    ...developmentSidebar(developmentPrefix, 'Development', labels)
  ])
}

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const docsRoot = resolve(repoRoot, 'packages/docs')
const result = checkDocsIntegrity({
  docsRoot,
  localePrefixes: localeConfigs.slice(1).map(({ prefix }) => prefix.slice(1)),
  redirectsPath: resolve(docsRoot, 'public/_redirects'),
  sidebarLinks: localeConfigs.flatMap(localeSidebarLinks)
})

const missingCounts = Object.values(result.localeMissingPages).map((pages) => pages.length)
const translationCounts = missingCounts.map((missing) => result.canonicalPageCount - missing)
console.log(
  `Localized page presence: ${Math.min(...translationCounts)}–${Math.max(...translationCounts)} of ${result.canonicalPageCount} canonical routes per locale; content quality is audited separately.`
)

if (result.errors.length > 0) {
  console.error('\nDocumentation integrity check failed:')
  for (const error of result.errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(
  `Documentation integrity check passed for ${result.markdownFiles.length} Markdown files.`
)
