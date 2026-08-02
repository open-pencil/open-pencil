import { useDebounceFn, useEventListener, useIntervalFn } from '@vueuse/core'

import type { RenderedPixels } from '@open-pencil/core/io'

import type { EditorStore } from '@/app/editor/active-store'

/**
 * The audience window: a second window showing nothing but the current slide.
 *
 * It renders a raster the presenter's window produces, rather than being a second editor.
 * A second CanvasKit instance would mean loading the document twice, a second font stack
 * and two renderers to keep in agreement — for a view that shows one static slide at a
 * time. The presenter's window stays the sole authority for which slide that is.
 *
 * The presenter writes into the audience window directly through the reference it already
 * holds. Both windows are same-origin, so there is no message channel to keep alive, none
 * to tear down, and nothing that behaves differently inside a desktop webview.
 */

/**
 * Audience output is presentation output, not a UI thumbnail: it follows the target
 * display's physical pixel width so Retina/projector output stays sharp. Responsiveness
 * comes from avoiding speculative renders, not reducing the requested slide quality.
 */
const SLIDE_REFERENCE_WIDTH = 1920
/** Served from `public/`, so the window loads a real page rather than one written into it. */
const AUDIENCE_URL = '/presentation.html'
const SLIDE_ELEMENT_ID = 'slide'
const PLACEHOLDER_ELEMENT_ID = 'loading'
/** A window closed from its own chrome reports it here rather than telling us. */
const CLOSE_POLL_MS = 500
/**
 * How many slide rasters to keep.
 *
 * Recently shown slides only. Speculative neighbours are deliberately excluded: CanvasKit
 * rastering is synchronous on the presenter's main thread, so three "idle" neighbours at
 * ~900ms each froze both navigation and filmstrip scrolling.
 */
const MAX_CACHED_SLIDES = 6

/** Mirrors the core raster profiler's switch: `window.__openPencilProfileRaster = true`. */
function profilingRaster(): boolean {
  return (globalThis as { __openPencilProfileRaster?: boolean }).__openPencilProfileRaster === true
}

export interface AudienceSession {
  /** Push the current slide to the audience window. */
  render: () => Promise<void>
  /** Discard a slide's cached raster, or all of them when given null. */
  invalidate: (pageId: string | null) => void
  /** Close the audience window and tear the session down. */
  close: () => void
}

type CachedAudienceRaster = {
  raster: RenderedPixels
  scale: number
}

/**
 * Scale needed for this window at its native device-pixel resolution.
 *
 * Deliberately uncapped: a high-density or wide audience display should receive enough
 * source pixels for the resolution it can actually show.
 */
function rasterScaleFor(win: Window): number {
  const cssWidth = win.innerWidth || SLIDE_REFERENCE_WIDTH
  const pixelWidth = cssWidth * (win.devicePixelRatio || 1)
  return pixelWidth / SLIDE_REFERENCE_WIDTH
}

function isCanvasElement(element: HTMLElement | null): element is HTMLCanvasElement {
  return element?.tagName === 'CANVAS'
}

/**
 * Open the audience window and start following the presenter's current slide.
 *
 * Returns null when the window could not be opened — a blocked popup, most often. The
 * caller must not enter presenter mode in that case: a driver with nothing to drive looks
 * like the feature is broken rather than blocked.
 */
export function openAudienceWindow(
  store: EditorStore,
  onAudienceClosed: () => void
): AudienceSession | null {
  const opened = window.open(AUDIENCE_URL, 'open-pencil-audience', 'width=1280,height=720')
  if (!opened) return null
  // Re-bound so the non-null type survives into the closures below.
  const win: Window = opened

  /**
   * Resolves once the served page has parsed and its canvas exists.
   *
   * `window.open` returns before the document has loaded, so anything that touches the
   * audience DOM has to wait. Polling for our own element rather than listening for `load`
   * also covers the case where the window was reused and is already showing the page.
   */
  const ready = new Promise<void>((resolve) => {
    const settle = () => {
      win.document.title = `${store.state.documentName} — presenting`
      resolve()
    }
    if (win.document.getElementById(SLIDE_ELEMENT_ID)) {
      settle()
      return
    }
    const { pause } = useIntervalFn(() => {
      if (win.closed) {
        pause()
        resolve()
        return
      }
      if (!win.document.getElementById(SLIDE_ELEMENT_ID)) return
      pause()
      settle()
    }, 30)
  })

  let closed = false
  let stopResizeListener: (() => void) | null = null

  const { pause: stopClosePoll } = useIntervalFn(() => {
    if (win.closed) teardown()
  }, CLOSE_POLL_MS)

  function teardown() {
    if (closed) return
    closed = true
    stopClosePoll()
    stopResizeListener?.()
    stopResizeListener = null
    cache.clear()
    shownPageId = null
    shownScale = null
    onAudienceClosed()
  }

  /**
   * Rasters already made, keyed by slide.
   *
   * A slide costs real time to raster, so only slides actually requested are retained.
   * Pre-rendering neighbours on the same main thread made rapid jumps progressively slower.
   */
  const cache = new Map<string, CachedAudienceRaster>()
  let shownPageId: string | null = null
  let shownScale: number | null = null
  let inFlight: Promise<void> | null = null

  function unavailable(): boolean {
    return closed || win.closed
  }

  /**
   * Drop a slide's raster because its content actually changed.
   *
   * Deliberately not keyed on the document-wide `sceneVersion`: page initialization and
   * unrelated graph work can bump it without changing this slide. Graph mutation events
   * are the real invalidation signal.
   */
  function invalidate(pageId: string | null) {
    if (!pageId) {
      cache.clear()
      shownPageId = null
      shownScale = null
      return
    }
    cache.delete(pageId)
    if (pageId === shownPageId) {
      shownPageId = null
      shownScale = null
    }
  }

  /** Trim to the newest entries, never dropping the slide currently on screen. */
  function pruneCache() {
    if (cache.size <= MAX_CACHED_SLIDES) return
    for (const pageId of cache.keys()) {
      if (cache.size <= MAX_CACHED_SLIDES) return
      if (pageId === shownPageId || pageId === store.state.currentPageId) continue
      cache.delete(pageId)
    }
  }

  async function rasterFor(pageId: string, scale: number): Promise<RenderedPixels | null> {
    if (unavailable()) return null
    const cached = cache.get(pageId)
    if (cached?.scale === scale) {
      cache.delete(pageId)
      cache.set(pageId, cached)
      if (profilingRaster()) console.debug('[raster] audience slide served from cache')
      return cached.raster
    }
    const startedAt = performance.now()
    const rendered = await store.renderExportPixels(scale, pageId)
    if (!rendered || unavailable()) return null
    cache.set(pageId, { raster: rendered, scale })
    pruneCache()
    if (profilingRaster()) {
      console.debug(
        `[raster] audience slide ready — ${(performance.now() - startedAt).toFixed(1)}ms, ` +
          `${rendered.width}x${rendered.height}`
      )
    }
    return rendered
  }

  /**
   * Blit the pixels into the audience window's canvas.
   *
   * No encode, no blob, no object URL and no decode — the bytes go straight from the Skia
   * surface into the other window's canvas. Cross-realm `putImageData` is fine: both
   * windows are same-origin and share a process.
   */
  function show(pageId: string, scale: number, raster: RenderedPixels) {
    const shownAt = performance.now()
    const slide = win.document.getElementById(SLIDE_ELEMENT_ID)
    const placeholder = win.document.getElementById(PLACEHOLDER_ELEMENT_ID)
    if (!isCanvasElement(slide)) return
    const canvas = slide
    if (canvas.width !== raster.width || canvas.height !== raster.height) {
      canvas.width = raster.width
      canvas.height = raster.height
    }
    const context = canvas.getContext('2d')
    if (!context) return
    // Construct the ImageData through the audience canvas so both the object and its pixel
    // storage belong to that window's realm. Passing an ImageData created by the presenter
    // across windows intermittently produced a successful no-op, leaving a transparent
    // canvas while `shownPageId` incorrectly recorded the slide as displayed.
    const audienceImage = context.createImageData(raster.width, raster.height)
    audienceImage.data.set(raster.pixels)
    context.putImageData(audienceImage, 0, 0)
    canvas.removeAttribute('hidden')
    placeholder?.setAttribute('hidden', '')
    shownPageId = pageId
    shownScale = scale
    if (profilingRaster()) {
      console.debug(`[raster] audience blit — ${(performance.now() - shownAt).toFixed(1)}ms`)
    }
  }

  /**
   * Show the current slide.
   *
   * Requests that arrive mid-render are dropped rather than queued: each is expensive and
   * only the newest slide is wanted, so the chain re-reads `currentPageId` when it settles.
   */
  async function render(): Promise<void> {
    if (unavailable()) return
    if (inFlight) return inFlight
    const run = async () => {
      await ready
      let pageId = store.state.currentPageId
      let scale = rasterScaleFor(win)
      for (;;) {
        const raster = await rasterFor(pageId, scale)
        if (unavailable()) return
        const latest = store.state.currentPageId
        const latestScale = rasterScaleFor(win)
        if (latest !== pageId || latestScale !== scale) {
          pageId = latest
          scale = latestScale
          continue
        }
        if (raster && (pageId !== shownPageId || scale !== shownScale)) {
          show(pageId, scale, raster)
        }
        break
      }
    }
    inFlight = run().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  // A popup may be resized, made fullscreen or moved to a display with a different DPR.
  // Keep the existing pixels visible during that transition, then make one fresh native-
  // resolution raster after the resize burst settles.
  stopResizeListener = useEventListener(
    win,
    'resize',
    useDebounceFn(() => void render(), 150)
  )

  function close() {
    if (!win.closed) win.close()
    teardown()
  }

  return { render, close, invalidate }
}
