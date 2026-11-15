import { DEFAULT_VIEWPORT_CHROME, type ViewportInsets } from '#core/editor/viewport'

type ViewportSize = { width: number; height: number }

/**
 * The canvas the editor draws into as the host reports it: its size in screen pixels and the
 * floating UI over its edges, which zooming to fit and centring keep clear of. A host may read
 * the size itself through `getViewportSize`; until the canvas reports one, `windowSize`, the
 * browser window's, stands in, or 800 × 600 without a window.
 */
export function createViewportSize(
  getViewportSize: (() => ViewportSize) | undefined,
  windowSize: () => ViewportSize | null
) {
  // The canvas reports its size through `setViewportSize`; until it does, the window stands in.
  const viewportSize = { width: 0, height: 0 }
  // Floating UI over the canvas edges, which fits keep clear of; the host reports where it sits.
  let viewportChrome: ViewportInsets = { ...DEFAULT_VIEWPORT_CHROME }

  return {
    /** The size of the canvas the editor draws into, in screen pixels. */
    getViewportSize:
      getViewportSize ??
      ((): ViewportSize => {
        if (viewportSize.width > 0 && viewportSize.height > 0) return { ...viewportSize }
        return windowSize() ?? { width: 800, height: 600 }
      }),
    /** Records the canvas's size in screen pixels, which zooming to fit and centring use. */
    setViewportSize(width: number, height: number) {
      viewportSize.width = width
      viewportSize.height = height
    },
    /** The floating UI over each canvas edge, as the context reads it, without copying. */
    currentViewportChrome: () => viewportChrome,
    /** Floating UI over each canvas edge, in screen pixels, that zooming to fit keeps clear of. */
    getViewportChrome: () => ({ ...viewportChrome }),
    /**
     * Records the floating UI over each canvas edge, such as a toolbar docked there, which zooming
     * to fit and a page's first view keep clear of; Figma's bottom toolbar until a host reports.
     */
    setViewportChrome(chrome: ViewportInsets) {
      viewportChrome = { ...chrome }
    }
  }
}
