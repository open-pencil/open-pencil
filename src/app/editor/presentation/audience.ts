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
 * Upper bound on the raster, as a multiple of the slide's own size.
 *
 * The scale is chosen from the audience window's width rather than fixed: rendering a
 * 1920-wide slide at 2x is an 8-megapixel PNG encoded on the main thread, which stalls both
 * windows for seconds on every advance. A 1x raster on a 1080p projector is already
 * pixel-for-pixel.
 */
const AUDIENCE_MAX_SCALE = 2
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
 * Enough to cover the prerender window either side of the current slide, and no more: a
 * full-size PNG per slide adds up fast, and eviction driven only by the idle callback
 * never ran when the presenter clicked quickly, because each advance cancelled the
 * previous callback before it fired.
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

/**
 * Scale needed for this window, capped.
 *
 * Uses the audience display's own pixel ratio, so a Retina projector still gets a sharp
 * slide while a 1080p one is not asked to decode four times the pixels it can show.
 */
function rasterScaleFor(win: Window): number {
  const cssWidth = win.innerWidth || SLIDE_REFERENCE_WIDTH
  const pixelWidth = cssWidth * (win.devicePixelRatio || 1)
  return Math.min(AUDIENCE_MAX_SCALE, Math.max(1, pixelWidth / SLIDE_REFERENCE_WIDTH))
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
    const poll = window.setInterval(() => {
      if (win.closed) {
        window.clearInterval(poll)
        resolve()
        return
      }
      if (!win.document.getElementById(SLIDE_ELEMENT_ID)) return
      window.clearInterval(poll)
      settle()
    }, 30)
  })

  let closed = false

  const poll = window.setInterval(() => {
    if (win.closed) teardown()
  }, CLOSE_POLL_MS)

  function teardown() {
    if (closed) return
    closed = true
    window.clearInterval(poll)
    if (idleHandle !== null) window.cancelIdleCallback?.(idleHandle)
    cache.clear()
    shownPageId = null
    onAudienceClosed()
  }

  /**
   * Rasters already made, keyed by slide.
   *
   * A slide costs real time to raster — the export path supersamples internally, so a
   * 1920-wide slide is drawn at 3840 and downsampled before it is even encoded. Paying
   * that while the presenter waits is what made advancing feel frozen, so slides are
   * rendered ahead of being asked for and kept.
   */
  const cache = new Map<string, ImageData>()
  let shownPageId: string | null = null
  let inFlight: Promise<void> | null = null
  let idleHandle: number | null = null

  function slideIds(): string[] {
    return store.graph.getPages().map((page) => page.id)
  }

  /**
   * Drop rasters outside the window, never the one on screen.
   *
   * Revoking the URL the audience `<img>` is currently pointing at blanks that window to
   * black with no way back — so the displayed raster is retained regardless of where the
   * window has moved to.
   */
  function evictBeyond(keep: Set<string>) {
    for (const pageId of cache.keys()) {
      if (keep.has(pageId) || pageId === shownPageId) continue
      cache.delete(pageId)
    }
  }

  /**
   * Drop a slide's raster because its content actually changed.
   *
   * Deliberately not keyed on `sceneVersion`: `switchPage` calls `requestRender`, which
   * bumps that counter, so every prerendered slide was being thrown away at the moment it
   * was navigated to — the cache never hit. Graph mutation events are the real signal.
   */
  function invalidate(pageId: string | null) {
    if (!pageId) {
      cache.clear()
      shownPageId = null
      return
    }
    cache.delete(pageId)
    if (pageId === shownPageId) shownPageId = null
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

  async function rasterFor(pageId: string): Promise<ImageData | null> {
    const cached = cache.get(pageId)
    if (cached) {
      if (profilingRaster()) console.info('[raster] audience slide served from cache')
      return cached
    }
    const startedAt = performance.now()
    const rendered = await store.renderExportPixels(rasterScaleFor(win), pageId)
    if (!rendered || closed || win.closed) return null
    const image = new ImageData(
      new Uint8ClampedArray(rendered.pixels),
      rendered.width,
      rendered.height
    )
    cache.set(pageId, image)
    pruneCache()
    if (profilingRaster()) {
      console.info(
        `[raster] audience slide ready — ${(performance.now() - startedAt).toFixed(1)}ms, ` +
          `${rendered.width}x${rendered.height}`
      )
    }
    return image
  }

  /**
   * Blit the pixels into the audience window's canvas.
   *
   * No encode, no blob, no object URL and no decode — the bytes go straight from the Skia
   * surface into the other window's canvas. Cross-realm `putImageData` is fine: both
   * windows are same-origin and share a process.
   */
  function show(pageId: string, image: ImageData) {
    const shownAt = performance.now()
    const slide = win.document.getElementById(SLIDE_ELEMENT_ID)
    const placeholder = win.document.getElementById(PLACEHOLDER_ELEMENT_ID)
    if (!slide) return
    const canvas = slide as unknown as HTMLCanvasElement
    if (canvas.width !== image.width || canvas.height !== image.height) {
      canvas.width = image.width
      canvas.height = image.height
    }
    const context = canvas.getContext('2d')
    if (!context) return
    context.putImageData(image, 0, 0)
    slide.removeAttribute('hidden')
    placeholder?.setAttribute('hidden', '')
    shownPageId = pageId
    if (profilingRaster()) {
      console.info(`[raster] audience blit — ${(performance.now() - shownAt).toFixed(1)}ms`)
    }
  }

  /** Render the slides either side of the current one while nothing else is happening. */
  function scheduleNeighbours() {
    if (idleHandle !== null) window.cancelIdleCallback?.(idleHandle)
    const run = async () => {
      idleHandle = null
      if (closed || win.closed) return
      const ids = slideIds()
      // Re-read the slide now rather than using the one this was scheduled for: clicking
      // through quickly leaves that stale, and warming — or worse, evicting — around a
      // slide the presenter has already left is how the shown raster got discarded.
      const pageId = store.state.currentPageId
      const index = ids.indexOf(pageId)
      if (index < 0) return
      // Two ahead, one back: presenting runs forwards, and a quick double-tap should not
      // out-run the cache.
      const neighbours = [ids[index + 1], ids[index - 1], ids[index + 2]].filter(
        (id): id is string => !!id
      )
      for (const id of neighbours) {
        if (closed || win.closed) return
        await rasterFor(id)
      }
      evictBeyond(new Set([pageId, ...neighbours]))
    }
    idleHandle =
      window.requestIdleCallback?.(() => void run(), { timeout: 400 }) ??
      window.setTimeout(() => void run(), 100)
  }

  /**
   * Show the current slide, then get the next one ready.
   *
   * Requests that arrive mid-render are dropped rather than queued: each is expensive and
   * only the newest slide is wanted, so the chain re-reads `currentPageId` when it settles.
   */
  async function render(): Promise<void> {
    if (closed || win.closed) return
    if (inFlight) return inFlight
    const run = async () => {
      await ready
      let pageId = store.state.currentPageId
      for (;;) {
        const image = await rasterFor(pageId)
        if (closed || win.closed) return
        const latest = store.state.currentPageId
        if (latest !== pageId) {
          pageId = latest
          continue
        }
        if (image && pageId !== shownPageId) show(pageId, image)
        break
      }
      scheduleNeighbours()
    }
    inFlight = run().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  function close() {
    if (!win.closed) win.close()
    teardown()
  }

  return { render, close, invalidate }
}
