import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, selectors, type Browser } from '@playwright/test'
import sharp from 'sharp'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools/workspace'

import { openApp, type Keyboard, type Theme } from './app.ts'
import { composePicture } from './compose.ts'
import { SHOTS } from './shots.ts'

/** A running editor: `bun run dev`, or `GUIDE_IMAGES_ORIGIN` for one on another port. */
const ORIGIN = process.env.GUIDE_IMAGES_ORIGIN ?? 'http://localhost:1420'
const IMAGES = 'packages/docs/public/guide'
/** The size each picture shows at, which `GuideImage` reserves before it loads. */
const SIZES = 'packages/docs/.vitepress/theme/guide/sizes.json'
/** Pictures for high-density screens. */
const PIXEL_RATIO = 2
/** A laptop's window, tall enough for the Design panel's longest pictured section. */
const VIEWPORT = { width: 1280, height: 900 }
const THEMES: Theme[] = ['light', 'dark']

const USER_AGENTS: Record<Keyboard, { platform: string; userAgent: string }> = {
  mac: {
    platform: 'MacIntel',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
  },
  other: {
    platform: 'Win32',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
  }
}

async function shoot(browser: Browser, name: string, theme: Theme): Promise<Buffer> {
  const { keyboard = 'mac', take } = SHOTS[name]
  const { platform, userAgent } = USER_AGENTS[keyboard]
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: PIXEL_RATIO,
    userAgent
  })
  try {
    const page = await context.newPage()
    await page.addInitScript((value) => {
      Object.defineProperty(navigator, 'platform', { get: () => value })
    }, platform)
    await openApp(page, ORIGIN, theme)
    const picture = await take(page)
    return await composePicture(await context.newPage(), picture, theme)
  } finally {
    await context.close()
  }
}

/**
 * Shoots the guide's pictures from a running editor, in both themes, and records their sizes.
 * Names on the command line shoot only those.
 */
async function main(): Promise<void> {
  const root = await resolveWorkspaceRoot(fileURLToPath(import.meta.url))
  const names = process.argv.slice(2)
  const unknown = names.filter((name) => !(name in SHOTS))
  if (unknown.length > 0) throw new Error(`No such picture: ${unknown.join(', ')}`)

  selectors.setTestIdAttribute('data-test-id')
  const browser = await chromium.launch()
  try {
    for (const name of names.length > 0 ? names : Object.keys(SHOTS)) {
      const folder = join(root, IMAGES, name)
      await mkdir(folder, { recursive: true })
      for (const theme of THEMES) {
        const png = await shoot(browser, name, theme)
        await sharp(png)
          .webp({ lossless: true })
          .toFile(join(folder, `${theme}.webp`))
      }
      console.log(name)
    }
  } finally {
    await browser.close()
  }

  const sizes: Record<string, { width: number; height: number }> = {}
  for (const name of Object.keys(SHOTS).toSorted()) {
    const { width, height } = await sharp(join(root, IMAGES, name, 'light.webp')).metadata()
    sizes[name] = { width: width / PIXEL_RATIO, height: height / PIXEL_RATIO }
  }
  await writeFile(join(root, SIZES), `${JSON.stringify(sizes, null, 2)}\n`)
}

await main()
