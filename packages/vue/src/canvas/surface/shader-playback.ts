import { useRafFn, watchThrottled } from '@vueuse/core'
import type { createRendererFromJSON } from 'shaders/core'
import { onScopeDispose, watch } from 'vue'

import type { SkiaRenderer } from '@open-pencil/core/canvas'
import type { Editor } from '@open-pencil/core/editor'
import { readShaderPaints, shaderOfPaint, type ShaderPreset } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { canDrawShaders } from '#vue/canvas/surface/shader-rasterizer'

/** The longest side a playing shader is drawn at, however large it is on screen. */
const MAX_PLAY_EDGE = 1024
/** How often what is on screen is checked while the view moves. */
const VIEW_CHECK_MS = 200
/** How much a shader's size on screen may change before it is drawn at the new size. */
const RESIZE_FACTOR = 1.5

/** A shader playing on its own WebGPU canvas, shown wherever its image is painted. */
interface Player {
  preset: string
  nodeIds: Set<string>
  canvas: HTMLCanvasElement
  renderer: ReturnType<typeof createRendererFromJSON> | null
  /** Whether it is on screen, the only time it draws. */
  visible: boolean
  /** The frame last handed to the canvas, closed once the next one replaces it. */
  shown: ImageBitmap | null
  disposed: boolean
}

interface PageShader {
  preset: ShaderPreset
  nodeIds: Set<string>
  /** Where the layers that paint it are, on the page. */
  bounds: Rect[]
}

/** Each image a shader paint on `pageId` shows, with its preset and the layers painting it. */
function shadersOnPage(editor: Editor, pageId: string) {
  const found = new Map<string, PageShader>()
  for (const node of editor.graph.getAllNodes()) {
    if (readShaderPaints(node).length === 0 || !editor.graph.isDescendant(node.id, pageId)) continue
    for (const paint of [...node.fills, ...node.strokes]) {
      const shader = shaderOfPaint(node, paint)
      if (!shader || !paint.visible) continue
      const entry = found.get(shader.image) ?? {
        preset: shader.preset,
        nodeIds: new Set<string>(),
        bounds: []
      }
      entry.nodeIds.add(node.id)
      entry.bounds.push(editor.graph.getAbsoluteBounds(node.id))
      found.set(shader.image, entry)
    }
  }
  return found
}

/**
 * Plays the shader paints on screen while the editor previews a page: each runs on a WebGPU
 * canvas at about its size on screen, and its frames replace the still frame wherever the canvas
 * paints that image, so the layers above, masks, and clipping draw as usual. A shader scrolled
 * out of view pauses; leaving preview shows the still frames again. Without WebGPU the still
 * frames stay.
 */
export function useShaderPlayback(options: {
  editor: Editor
  getRenderer: () => SkiaRenderer | null
  getViewport: () => { width: number; height: number }
  markDirty: () => void
}) {
  const { editor, getRenderer, getViewport, markDirty } = options
  const players = new Map<string, Player>()
  /** Renderers to let go of once the frame being drawn is done with them. */
  const retired: Player[] = []
  let last = 0
  let stepping = false

  function release() {
    for (const player of retired.splice(0)) {
      player.renderer?.dispose()
      player.shown?.close()
    }
  }

  function stop(hash: string) {
    const player = players.get(hash)
    if (!player) return
    player.disposed = true
    players.delete(hash)
    getRenderer()?.setLiveImage(hash, null, player.nodeIds)
    retired.push(player)
    if (!stepping) release()
  }

  /** How many pixels a shader painted over `bounds` covers on screen, at most. */
  function screenSize(bounds: Rect[]): { width: number; height: number } {
    const scale = editor.state.zoom * (window.devicePixelRatio || 1)
    const width = Math.max(...bounds.map((rect) => rect.width)) * scale
    const height = Math.max(...bounds.map((rect) => rect.height)) * scale
    const fit = Math.min(1, MAX_PLAY_EDGE / Math.max(width, height, 1))
    return {
      width: Math.max(1, Math.round(width * fit)),
      height: Math.max(1, Math.round(height * fit))
    }
  }

  function onScreen(bounds: Rect[]): boolean {
    const { panX, panY, zoom } = editor.state
    const view = getViewport()
    return bounds.some(
      (rect) =>
        rect.x * zoom + panX < view.width &&
        (rect.x + rect.width) * zoom + panX > 0 &&
        rect.y * zoom + panY < view.height &&
        (rect.y + rect.height) * zoom + panY > 0
    )
  }

  async function start(
    hash: string,
    preset: ShaderPreset,
    size: { width: number; height: number }
  ) {
    const canvas = document.createElement('canvas')
    // The renderer sizes its buffer at the device pixel ratio itself.
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(size.width / ratio))
    canvas.height = Math.max(1, Math.round(size.height / ratio))
    const player: Player = {
      preset: JSON.stringify(preset),
      nodeIds: new Set(),
      canvas,
      renderer: null,
      visible: true,
      shown: null,
      disposed: false
    }
    players.set(hash, player)
    const shaders = await import('shaders/core')
    if (player.disposed) return
    const renderer = shaders.createRendererFromJSON(structuredClone(preset))
    await renderer.initialize(canvas)
    if (player.disposed) renderer.dispose()
    else player.renderer = renderer
  }

  /** Whether a player drawing at `canvas`'s size should be redrawn at `size` instead. */
  function resized(canvas: HTMLCanvasElement, size: { width: number; height: number }) {
    const ratio = window.devicePixelRatio || 1
    const factor = size.width / Math.max(1, canvas.width * ratio)
    return factor > RESIZE_FACTOR || factor < 1 / RESIZE_FACTOR
  }

  function sync() {
    const playing = editor.state.play !== null && canDrawShaders()
    const wanted = playing ? shadersOnPage(editor, editor.state.currentPageId) : new Map()
    for (const [hash, player] of players) {
      const shader = wanted.get(hash)
      if (!shader || JSON.stringify(shader.preset) !== player.preset) stop(hash)
    }
    for (const [hash, shader] of wanted) {
      const visible = onScreen(shader.bounds)
      const size = screenSize(shader.bounds)
      const existing = players.get(hash)
      if (existing && visible && resized(existing.canvas, size)) stop(hash)
      if (!players.has(hash) && visible) void start(hash, shader.preset, size)
      const player = players.get(hash)
      if (!player) continue
      player.nodeIds = shader.nodeIds
      player.visible = visible
    }
    if (players.size > 0) resume()
    else {
      pause()
      last = 0
    }
  }

  const { pause, resume } = useRafFn(
    ({ timestamp }) => {
      const delta = last === 0 ? 0 : (timestamp - last) / 1000
      if (stepping) return
      last = timestamp
      stepping = true
      void step(delta).finally(() => {
        stepping = false
        release()
      })
    },
    { immediate: false }
  )

  /**
   * Draws every visible shader and copies its canvas right after drawing, since a WebGPU canvas
   * keeps its frame only until the task that drew it ends; the copies finish together.
   */
  async function step(delta: number) {
    const renderer = getRenderer()
    if (!renderer) return
    const copies: Promise<{ hash: string; player: Player; frame: ImageBitmap }>[] = []
    for (const [hash, player] of players) {
      if (!player.visible || !player.renderer) continue
      await player.renderer.renderFrame({ deltaSeconds: delta, waitForGpu: false })
      if (player.disposed) continue
      copies.push(createImageBitmap(player.canvas).then((frame) => ({ hash, player, frame })))
    }
    const frames = await Promise.all(copies)
    for (const { hash, player, frame } of frames) {
      if (player.disposed) {
        frame.close()
        continue
      }
      renderer.setLiveImage(hash, frame, player.nodeIds)
      player.shown?.close()
      player.shown = frame
    }
    if (frames.length > 0) markDirty()
  }

  watch(
    () => [editor.state.play !== null, editor.state.currentPageId, editor.state.sceneVersion],
    sync,
    { immediate: true }
  )
  watchThrottled(() => [editor.state.panX, editor.state.panY, editor.state.zoom], sync, {
    throttle: VIEW_CHECK_MS
  })

  onScopeDispose(() => {
    pause()
    for (const hash of Array.from(players.keys())) stop(hash)
    release()
  })
}
