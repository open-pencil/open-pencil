import type { CanvasKit } from '@open-pencil/canvaskit'
import type { SceneNode } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { installTextMeasurer, type TextMeasurer } from '#core/layout'
import { TextEditor } from '#core/text/editor'
import { installTextInkMeasurer } from '#core/text/ink'

/** Measures `node` with `renderer`, the editor's current one, for layout. */
type RendererTextMeasurer = (
  renderer: SkiaRenderer,
  node: SceneNode,
  maxWidth?: number
) => ReturnType<TextMeasurer>

/**
 * The canvases drawing an editor's document: the CanvasKit they share, each canvas's renderer,
 * the one the editor measures with, and the text editor built on CanvasKit. While a renderer is
 * attached, layout measures text and text ink with the current one through `measureText`.
 * `onFirstCanvas` runs once the editor's first renderer measures text, as a page shown before
 * then needs laying out.
 */
export function createCanvasRenderers(
  measureText: RendererTextMeasurer,
  onFirstCanvas: () => void = () => undefined
) {
  let ck: CanvasKit | null = null
  let current: SkiaRenderer | null = null
  const renderers = new Set<SkiaRenderer>()
  let textEditor: TextEditor | null = null
  let uninstallTextMeasurer: (() => void) | null = null
  let uninstallTextInkMeasurer: (() => void) | null = null

  function setCanvasKit(canvasKit: CanvasKit, renderer: SkiaRenderer) {
    ck = canvasKit
    current = renderer
    const first = renderers.size === 0
    renderers.add(renderer)
    textEditor ??= new TextEditor(canvasKit)
    uninstallTextMeasurer?.()
    // Measures with the editor's current renderer, which removing this one falls back from.
    uninstallTextMeasurer =
      typeof renderer.measureTextNode === 'function'
        ? installTextMeasurer((node, maxWidth) =>
            current ? measureText(current, node, maxWidth) : null
          )
        : null
    uninstallTextInkMeasurer?.()
    uninstallTextInkMeasurer =
      typeof renderer.measureTextInk === 'function'
        ? installTextInkMeasurer((node) => current?.measureTextInk(node))
        : null
    if (first) onFirstCanvas()
  }

  function releaseTextMeasurer() {
    uninstallTextMeasurer?.()
    uninstallTextMeasurer = null
    uninstallTextInkMeasurer?.()
    uninstallTextInkMeasurer = null
  }

  function removeCanvasRenderer(renderer: SkiaRenderer) {
    renderers.delete(renderer)
    if (current === renderer) {
      current = renderers.values().next().value ?? null
    }
    if (renderers.size === 0) releaseTextMeasurer()
  }

  return {
    /** Every attached renderer, live: the set itself, not a copy. */
    renderers,
    getCk: () => ck,
    getRenderer: () => current,
    getTextEditor: () => textEditor,
    setCanvasKit,
    removeCanvasRenderer,
    releaseTextMeasurer
  }
}
