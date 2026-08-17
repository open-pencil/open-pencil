import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path'

import { parse as parseCloudflareRedirects } from 'cloudflare-redirect-parser'
import { franc } from 'franc'
import type { Definition, Link, Root } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { visit } from 'unist-util-visit'

export interface DocsIntegrityOptions {
  docsRoot: string
  localePrefixes: readonly string[]
  redirectsPath: string
  sidebarLinks: readonly string[]
}

export interface DocsIntegrityResult {
  canonicalPageCount: number
  errors: string[]
  localeMissingPages: Record<string, string[]>
  localePlaceholderPages: Record<string, string[]>
  localeSuspectPages: Record<string, string[]>
  markdownFiles: string[]
}

const EXTERNAL_SCHEMES = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i
const MEDIA_EXTENSIONS = new Set([
  '.avif',
  '.fig',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.json',
  '.pen',
  '.png',
  '.svg',
  '.txt',
  '.webp'
])
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const LOCALE_LANGUAGE_CODES: Record<string, string> = {
  de: 'deu',
  es: 'spa',
  fr: 'fra',
  it: 'ita',
  pl: 'pol',
  ru: 'rus'
}

function walkMarkdown(directory: string): string[] {
  if (!existsSync(directory)) return []

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.name === 'node_modules' || entry.name === '.vitepress') return []
    if (entry.isDirectory()) return walkMarkdown(path)
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : []
  })
}

function routeCandidates(docsRoot: string, route: string): string[] {
  const routePath = route.replace(/^\//, '').replace(/\/$/, '')
  const base = resolve(docsRoot, routePath)
  if (extname(base)) return [base]
  return [base, `${base}.md`, join(base, 'index.md')]
}

function fileCandidates(path: string): string[] {
  if (extname(path)) return [path]
  return [path, `${path}.md`, join(path, 'index.md')]
}

function routeExists(docsRoot: string, route: string): boolean {
  return routeCandidates(docsRoot, route).some(existsSync)
}

function markdownLinks(source: string): Array<Link | Definition> {
  const links: Array<Link | Definition> = []
  const tree = fromMarkdown(source) as Root
  visit(tree, 'link', (node) => links.push(node))
  visit(tree, 'definition', (node) => links.push(node))
  return links
}

function validateMarkdownLinks(docsRoot: string, markdownFiles: string[]): string[] {
  const errors: string[] = []

  for (const file of markdownFiles) {
    for (const link of markdownLinks(readFileSync(file, 'utf8'))) {
      const target = link.url.split(/[?#]/, 1)[0]?.trim() ?? ''
      if (!target || target.startsWith('#') || EXTERNAL_SCHEMES.test(target)) continue

      const path = target.startsWith('/')
        ? resolve(docsRoot, target.replace(/^\//, ''))
        : resolve(dirname(file), target)
      if (MEDIA_EXTENSIONS.has(extname(path)) || fileCandidates(path).some(existsSync)) continue

      errors.push(`${relative(docsRoot, file)} links to missing target '${target}'.`)
    }
  }

  return errors
}

function validateRedirects(docsRoot: string, redirectsPath: string): string[] {
  if (!existsSync(redirectsPath)) return [`Missing redirects file '${redirectsPath}'.`]

  const errors: string[] = []
  const source = readFileSync(redirectsPath, 'utf8')
  const redirects = parseCloudflareRedirects(source)
  const seenSources = new Set<string>()

  for (const redirect of redirects) {
    const status = redirect.status ?? 302
    if (seenSources.has(redirect.from)) {
      errors.push(`Redirect '${redirect.from}' is duplicated.`)
    }
    seenSources.add(redirect.from)

    if (!REDIRECT_STATUSES.has(status)) {
      errors.push(`Redirect '${redirect.from}' has unsupported status '${status}'.`)
    }
    if (!redirect.from.startsWith('/') || !redirect.to.startsWith('/')) {
      errors.push(`Redirect '${redirect.from}' must use root-relative paths.`)
      continue
    }
    if (routeExists(docsRoot, redirect.from)) {
      errors.push(`Redirect source '${redirect.from}' still has a page and would shadow it.`)
    }
    if (!routeExists(docsRoot, redirect.to)) {
      errors.push(`Redirect '${redirect.from}' targets missing page '${redirect.to}'.`)
    }
  }

  return errors
}

function canonicalMarkdownPaths(
  docsRoot: string,
  localePrefixes: readonly string[],
  markdownFiles: string[]
): string[] {
  const localeDirectories = new Set(localePrefixes)
  return markdownFiles
    .map((file) => relative(docsRoot, file))
    .filter((path) => !localeDirectories.has(path.split(sep)[0] ?? ''))
    .sort()
}

function localeMissingPages(
  docsRoot: string,
  localePrefixes: readonly string[],
  canonicalPaths: string[]
): Record<string, string[]> {
  return Object.fromEntries(
    localePrefixes.map((locale) => [
      locale,
      canonicalPaths.filter((path) => !existsSync(join(docsRoot, locale, path)))
    ])
  )
}

function localePlaceholderPages(
  docsRoot: string,
  localePrefixes: readonly string[],
  canonicalPaths: string[]
): Record<string, string[]> {
  if (localePrefixes.length < 2) {
    return Object.fromEntries(localePrefixes.map((locale) => [locale, []]))
  }
  const pathsByContent = new Map<string, Map<string, string[]>>()

  for (const locale of localePrefixes) {
    for (const path of canonicalPaths) {
      const localizedPath = join(docsRoot, locale, path)
      if (!existsSync(localizedPath)) continue
      const content = readFileSync(localizedPath, 'utf8')
      const localePaths = pathsByContent.get(content) ?? new Map<string, string[]>()
      const locales = localePaths.get(path) ?? []
      locales.push(locale)
      localePaths.set(path, locales)
      pathsByContent.set(content, localePaths)
    }
  }

  const placeholders = Object.fromEntries(localePrefixes.map((locale) => [locale, [] as string[]]))
  for (const localePaths of pathsByContent.values()) {
    for (const [path, locales] of localePaths) {
      if (locales.length !== localePrefixes.length) continue
      for (const locale of locales) placeholders[locale]?.push(path)
    }
  }
  for (const paths of Object.values(placeholders)) paths.sort()
  return placeholders
}

function markdownProse(source: string): string {
  const text: string[] = []
  const tree = fromMarkdown(source) as Root
  visit(tree, 'text', (node) => text.push(node.value))
  return text.join(' ')
}

function localeSuspectPages(
  docsRoot: string,
  localePrefixes: readonly string[],
  markdownFiles: string[]
): Record<string, string[]> {
  return Object.fromEntries(
    localePrefixes.map((locale) => {
      const expectedLanguage = LOCALE_LANGUAGE_CODES[locale]
      if (!expectedLanguage) return [locale, []]
      const localeRoot = join(docsRoot, locale)
      const suspects = markdownFiles
        .filter((file) => file.startsWith(`${localeRoot}${sep}`))
        .filter((file) => {
          const prose = markdownProse(readFileSync(file, 'utf8'))
          if (prose.split(/\s+/).length < 80) return false
          const detected = franc(prose, { minLength: 80, only: [expectedLanguage, 'eng'] })
          return detected === 'eng'
        })
        .map((file) => relative(localeRoot, file))
        .sort()
      return [locale, suspects]
    })
  )
}

function validateSidebarLinks(docsRoot: string, sidebarLinks: readonly string[]): string[] {
  const errors: string[] = []
  for (const link of new Set(sidebarLinks)) {
    if (!link.startsWith('/') || EXTERNAL_SCHEMES.test(link) || routeExists(docsRoot, link))
      continue
    errors.push(`Sidebar links to missing page '${link}'.`)
  }
  return errors
}

export function checkDocsIntegrity(options: DocsIntegrityOptions): DocsIntegrityResult {
  const docsRoot = normalize(options.docsRoot)
  const markdownFiles = walkMarkdown(docsRoot)
  const canonicalPaths = canonicalMarkdownPaths(docsRoot, options.localePrefixes, markdownFiles)
  const placeholders = localePlaceholderPages(docsRoot, options.localePrefixes, canonicalPaths)
  const placeholderErrors = Object.entries(placeholders).flatMap(([locale, paths]) =>
    paths.map(
      (path) =>
        `${locale}/${path} is identical across every locale and must use the canonical English page instead.`
    )
  )
  const suspects = localeSuspectPages(docsRoot, options.localePrefixes, markdownFiles)
  const suspectErrors = Object.entries(suspects).flatMap(([locale, paths]) =>
    paths.map(
      (path) =>
        `${locale}/${path} is detected as English and must be translated or use the canonical English page.`
    )
  )
  const errors = [
    ...validateMarkdownLinks(docsRoot, markdownFiles),
    ...validateSidebarLinks(docsRoot, options.sidebarLinks),
    ...validateRedirects(docsRoot, options.redirectsPath),
    ...placeholderErrors,
    ...suspectErrors
  ].sort()

  return {
    canonicalPageCount: canonicalPaths.length,
    errors,
    localeMissingPages: localeMissingPages(docsRoot, options.localePrefixes, canonicalPaths),
    localePlaceholderPages: placeholders,
    localeSuspectPages: suspects,
    markdownFiles
  }
}
