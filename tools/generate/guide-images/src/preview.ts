import { mkdir, readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, type Browser } from '@playwright/test'
import { parse } from 'yaml'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools/workspace'

/** A running docs site: `bun run docs:dev`, or `GUIDE_PAGES_ORIGIN` for one on another port. */
const ORIGIN = process.env.GUIDE_PAGES_ORIGIN ?? 'http://localhost:5173'
const DOCS = 'packages/docs'
/** Where the screenshots go, inside the ignored `scratch/`. */
const OUT = 'scratch/guide-pages'
/** VitePress renders a page once its scripts load; pictures load as they scroll into view. */
const LOAD_MS = 3000

/** VitePress's theme setting, so a page loads in the view's theme instead of the site's dark default. */
const APPEARANCE_SETTING = 'vitepress-theme-appearance'
/** The docs' own setting for whose keyboard shortcuts and pictures show (`theme/guide/keys.ts`). */
const KEYS_SETTING = 'open-pencil-docs:keys'

/** Each view sets the keyboard, so pictures for both keyboards are checked on any system. */
const VIEWS = [
  { name: 'light', width: 1280, scheme: 'light', keys: 'mac' },
  { name: 'dark', width: 1280, scheme: 'dark', keys: 'mac' },
  { name: 'phone', width: 390, scheme: 'light', keys: 'mac' },
  { name: 'windows', width: 1280, scheme: 'light', keys: 'other' }
] as const

interface Findings {
  /** Pictures that failed to load. */
  broken: string[]
  /** How far the page scrolls sideways, which a reader on a phone feels as a wobbling page. */
  overflow: number
}

/** A page's front matter, with either line ending, as Git for Windows may check files out. */
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---/

async function isGuidePage(file: string): Promise<boolean> {
  const block = FRONT_MATTER.exec(await readFile(file, 'utf8'))?.[1]
  if (!block) return false
  const data: unknown = parse(block)
  return (
    typeof data === 'object' && data !== null && 'pageClass' in data && data.pageClass === 'guide'
  )
}

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name)
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) return []
      if (entry.isDirectory()) return markdownFiles(path)
      return entry.name.endsWith('.md') ? [path] : []
    })
  )
  return nested.flat()
}

/** Every rewritten guide page, by its address on the site. */
async function guideRoutes(docs: string): Promise<string[]> {
  const routes: string[] = []
  for (const file of await markdownFiles(docs)) {
    if (await isGuidePage(file))
      routes.push(`/${relative(docs, file).replace(/(index)?\.md$/, '')}`)
  }
  return routes.toSorted()
}

async function capture(
  browser: Browser,
  route: string,
  view: (typeof VIEWS)[number],
  path: string
): Promise<Findings> {
  const page = await browser.newPage({
    viewport: { width: view.width, height: 900 },
    colorScheme: view.scheme,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(ORIGIN).origin,
          localStorage: [
            { name: APPEARANCE_SETTING, value: view.scheme },
            { name: KEYS_SETTING, value: view.keys }
          ]
        }
      ]
    }
  })
  try {
    const response = await page.goto(`${ORIGIN}${route}`)
    if (!response?.ok()) throw new Error(`${route} answered ${response?.status() ?? 'nothing'}`)
    await page.waitForTimeout(LOAD_MS)
    // The dev server answers an unknown address with 200 and VitePress's not found page.
    if (await page.locator('.NotFound').count()) throw new Error(`${route} is not a page`)
    const broken = await page.evaluate(async () => {
      const images = [...document.images]
      for (const image of images) image.loading = 'eager'
      await Promise.all(images.map((image) => image.decode().catch(() => undefined)))
      return images
        .filter((image) => image.offsetParent !== null && image.naturalWidth === 0)
        .map((image) => image.getAttribute('src') ?? '')
    })
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    await page.screenshot({ path, fullPage: true })
    return { broken, overflow }
  } finally {
    await page.close()
  }
}

/**
 * Opens the guide pages of a running docs site in light, dark, at a phone's width, and with Windows keys, saves a
 * screenshot of each to read, and fails on a picture that doesn't load or a page that scrolls
 * sideways. Addresses on the command line, such as `/user-guide/auto-layout`, open only those.
 */
async function main(): Promise<void> {
  const root = await resolveWorkspaceRoot(fileURLToPath(import.meta.url))
  const named = process.argv.slice(2)
  const routes = named.length > 0 ? named : await guideRoutes(join(root, DOCS))
  if (routes.length === 0) throw new Error(`No guide pages in ${DOCS}`)
  const out = join(root, OUT)
  await mkdir(out, { recursive: true })

  const problems: string[] = []
  const browser = await chromium.launch()
  try {
    for (const route of routes) {
      for (const view of VIEWS) {
        const name = `${route.slice(1).replaceAll('/', '-') || 'index'}-${view.name}.png`
        const { broken, overflow } = await capture(browser, route, view, join(out, name))
        for (const src of broken) problems.push(`${route} (${view.name}): ${src} did not load`)
        if (overflow > 0) problems.push(`${route} (${view.name}): scrolls ${overflow}px sideways`)
      }
      console.log(route)
    }
  } finally {
    await browser.close()
  }

  console.log(`Screenshots in ${OUT}/`)
  if (problems.length > 0) {
    console.error(problems.join('\n'))
    process.exitCode = 1
  }
}

await main()
