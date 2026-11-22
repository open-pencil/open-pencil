import { mkdir, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

import { FEATURE_KINDS } from '#docs-config/theme/landing/content/features'
import {
  POSTER_CAPTURE_PARAM,
  posterParts,
  posterPath,
  type PosterLayout,
  type PosterTarget
} from '#docs-config/theme/landing/posters'
import { chromium, type Browser, type BrowserContext } from '@playwright/test'
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
const STAGE_TIMEOUT_MS = 120_000
/** Pages captured at once; each holds a WebGL context per stage. */
const CONCURRENCY = 3
/** Software WebGL, so headless Chromium renders the canvases on CI machines without a GPU. */
const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']

/** Serves the built site with its clean URLs, as the docs host does. */
function serveSite(dist: string) {
  const root = resolve(dist)
  return Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const path = decodeURIComponent(new URL(request.url).pathname)
      for (const candidate of [path, `${path}.html`, join(path, 'index.html')]) {
        const file = resolve(root, `.${candidate}`)
        // An encoded `..` must not reach files outside the build.
        if (relative(root, file).startsWith('..')) continue
        const info = await stat(file).catch(() => null)
        if (info?.isFile()) return new Response(Bun.file(file))
      }
      return new Response('Not found', { status: 404 })
    }
  })
}

/**
 * Lets the page read what other sites serve only to the docs site's own origin, as it reads them
 * on openpencil.dev: the stages download the tour from OpenPencil Cloud's storage, which allows
 * that origin and not the local server the stills are taken from.
 */
async function readAsDocsSite(context: BrowserContext, origin: string) {
  await context.route(
    (url) => url.origin !== origin,
    async (route) => {
      if (route.request().resourceType() !== 'fetch') return route.continue()
      const response = await route.fetch()
      const headers = response.headers()
      if (headers['access-control-allow-origin']) return route.fulfill({ response })
      await route.fulfill({
        response,
        headers: { ...headers, 'access-control-allow-origin': origin }
      })
    }
  )
}

async function capturePage(browser: Browser, origin: string, target: PosterTarget, out: string) {
  const viewport = VIEWPORTS[target.layout]
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: PIXEL_RATIO,
    isMobile: viewport.touch,
    hasTouch: viewport.touch,
    colorScheme: target.theme,
    // Stills of a page at rest: shaders in preview show their saved frame instead of playing,
    // which in the headless browser's software WebGPU kept the page busy and drew nothing.
    reducedMotion: 'reduce',
    // VitePress reads the visitor's appearance choice from storage before it paints.
    storageState: {
      cookies: [],
      origins: [
        { origin, localStorage: [{ name: 'vitepress-theme-appearance', value: target.theme }] }
      ]
    }
  })
  try {
    await readAsDocsSite(context, origin)
    const page = await context.newPage()
    const prefix = target.locale === 'root' ? '' : `${target.locale}/`
    await page.goto(`${origin}/${prefix}?${POSTER_CAPTURE_PARAM}`)
    for (const kind of FEATURE_KINDS) {
      const frame = page.locator(`.stage-frame[data-kind="${kind}"]`)
      await frame.scrollIntoViewIfNeeded()
      await page
        .locator(`.stage-frame[data-kind="${kind}"][data-ready]`)
        .waitFor({ timeout: STAGE_TIMEOUT_MS })
      // A stage reports ready once its scene's first frame is on screen, with its panel, toolbar,
      // and pill already loaded. What may still arrive: the page's web fonts and the images its
      // panel shows. Then the next frame paints them.
      await frame.evaluate(async (stage) => {
        await document.fonts.ready
        // One that fails to load is in the still as the page shows it; waiting is all this is for.
        await Promise.allSettled([...stage.querySelectorAll('img')].map((image) => image.decode()))
        // Transitions still running, such as a colour easing to the theme's, end first; endless
        // animations, such as a spinner, are drawn as they are.
        await Promise.allSettled(
          stage
            .getAnimations({ subtree: true })
            .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
            .map((animation) => animation.finished)
        )
        await new Promise((painted) => requestAnimationFrame(() => requestAnimationFrame(painted)))
      })
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
 * Captures every stage of the `targets` landing pages from the built site in `dist`, writing
 * WebP stills under `out` at their poster paths.
 */
export async function capturePosters({
  dist,
  out,
  targets
}: {
  dist: string
  out: string
  targets: PosterTarget[]
}): Promise<number> {
  const server = serveSite(dist)
  let browser: Browser | null = null
  try {
    browser = await chromium.launch({ args: CHROMIUM_ARGS })
    const launched = browser
    const queue = [...targets]
    const worker = async () => {
      for (let target = queue.shift(); target; target = queue.shift()) {
        await capturePage(launched, server.url.origin, target, out)
        console.log(`landing posters: ${target.locale} ${target.theme} ${target.layout}`)
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  } finally {
    await browser?.close()
    await server.stop(true)
  }
  return targets.length
}
