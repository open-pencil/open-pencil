import { mkdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { LOCALE_PREFIXES } from '#docs-config/seo'
import { FEATURE_KINDS } from '#docs-config/theme/landing/content/features'
import {
  POSTER_CAPTURE_PARAM,
  POSTER_LAYOUTS,
  POSTER_THEMES,
  posterParts,
  posterPath,
  type PosterLayout,
  type PosterTarget
} from '#docs-config/theme/landing/posters'
import { chromium, type Browser } from '@playwright/test'
import sharp from 'sharp'

/**
 * The visitor's screen for each layout. On a desktop the page caps its content width, so one
 * wide viewport stands for every large screen; the phone is a common handset with touch input.
 */
const VIEWPORTS: Record<PosterLayout, { width: number; height: number; touch: boolean }> = {
  desktop: { width: 1440, height: 900, touch: false },
  phone: { width: 390, height: 844, touch: true }
}
/** Stills for high-density screens, which look sharp downscaled on the others. */
const PIXEL_RATIO = 2
const WEBP_QUALITY = 80
/** After a stage reports ready: fonts swap in, panels finish their transitions. */
const SETTLE_MS = 1000
const STAGE_TIMEOUT_MS = 120_000
/** Pages captured at once; each holds a WebGL context per stage. */
const CONCURRENCY = 3
/** Software WebGL, so headless Chromium renders the canvases on CI machines without a GPU. */
const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']

/** Serves the built site with its clean URLs, as the docs host does. */
function serveSite(dist: string) {
  return Bun.serve({
    port: 0,
    async fetch(request) {
      const path = decodeURIComponent(new URL(request.url).pathname)
      for (const candidate of [path, `${path}.html`, join(path, 'index.html')]) {
        const file = join(dist, candidate)
        const info = await stat(file).catch(() => null)
        if (info?.isFile()) return new Response(Bun.file(file))
      }
      return new Response('Not found', { status: 404 })
    }
  })
}

async function capturePage(browser: Browser, origin: string, target: PosterTarget, out: string) {
  const viewport = VIEWPORTS[target.layout]
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: PIXEL_RATIO,
    isMobile: viewport.touch,
    hasTouch: viewport.touch,
    colorScheme: target.theme,
    // VitePress reads the visitor's appearance choice from storage before it paints.
    storageState: {
      cookies: [],
      origins: [
        { origin, localStorage: [{ name: 'vitepress-theme-appearance', value: target.theme }] }
      ]
    }
  })
  try {
    const page = await context.newPage()
    const prefix = target.locale === 'root' ? '' : `${target.locale}/`
    await page.goto(`${origin}/${prefix}?${POSTER_CAPTURE_PARAM}`)
    for (const kind of FEATURE_KINDS) {
      const frame = page.locator(`.stage-frame[data-kind="${kind}"]`)
      await frame.scrollIntoViewIfNeeded()
      await page
        .locator(`.stage-frame[data-kind="${kind}"][data-ready]`)
        .waitFor({ timeout: STAGE_TIMEOUT_MS })
      await page.waitForTimeout(SETTLE_MS)
      for (const part of posterParts(kind)) {
        const element = part === 'frame' ? frame : frame.locator(`[data-poster-part="${part}"]`)
        const png = await element.screenshot({ animations: 'disabled' })
        const file = join(out, posterPath(target, kind, part))
        await mkdir(dirname(file), { recursive: true })
        await sharp(png).webp({ quality: WEBP_QUALITY }).toFile(file)
      }
    }
  } finally {
    await context.close()
  }
}

/**
 * Captures every stage of every landing page in each theme and layout from the built site in
 * `dist`, writing WebP stills under `out` at their poster paths.
 */
export async function capturePosters({
  dist,
  out,
  fingerprint
}: {
  dist: string
  out: string
  fingerprint: string
}): Promise<number> {
  const locales = ['root', ...LOCALE_PREFIXES]
  const targets: PosterTarget[] = locales.flatMap((locale) =>
    POSTER_THEMES.flatMap((theme) =>
      POSTER_LAYOUTS.map((layout) => ({ fingerprint, locale, theme, layout }))
    )
  )
  const server = serveSite(dist)
  const browser = await chromium.launch({ args: CHROMIUM_ARGS })
  try {
    const queue = [...targets]
    const worker = async () => {
      for (let target = queue.shift(); target; target = queue.shift()) {
        await capturePage(browser, server.url.origin, target, out)
        console.log(`landing posters: ${target.locale} ${target.theme} ${target.layout}`)
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  } finally {
    await browser.close()
    await server.stop(true)
  }
  return targets.length
}
