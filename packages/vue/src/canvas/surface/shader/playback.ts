import { useRafFn, watchThrottled } from '@vueuse/core'
import type { createRendererFromJSON } from 'shaders/core'
import { onScopeDispose, watch } from 'vue'

import type { Editor, EditorState } from '@open-pencil/core'
import type { SkiaRenderer } from '@open-pencil/core/canvas'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import {
  readShaderPaints,
  shaderOfPaint,
  type ShaderPreset
} from '@open-pencil/scene-graph/shaders'

import { shaderFrames } from '#vue/canvas/surface/shader/frames'
import { canDrawShaders } from '#vue/canvas/surface/shader/rasterizer'

/** The longest side a playing shader is drawn at, however large it is on screen. */
const MAX_PLAY_EDGE = 1024
/**
 * How long a frame may spend drawing shaders and handing them to the canvas. A browser where
 * that is slow, such as Safari, which copies each WebGPU canvas into WebGL synchronously, draws
 * as many as fit and the rest on the next frames, in turn, rather than stalling every frame.
 */
const FRAME_BUDGET_MS = 8
/** The least time between frames where each frame is copied. */
const COPY_FRAME_MS = 1000 / 30
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
  disposed: boolean
  /** The copy of its last frame shown, where frames are copied, closed when the next replaces it. */
  copied: ImageBitmap | null
  /** When it last drew, so its clock advances by the time since then however often it draws. */
  drawnAt: number
  /** How far its animation has run, in seconds, so a player that replaces it goes on from there. */
  elapsed: number
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
  /** The view this canvas draws: its pan, zoom, page, and whether it previews. */
  getView: () => Pick<EditorState, 'panX' | 'panY' | 'zoom' | 'currentPageId' | 'play'>
  getViewport: () => { width: number; height: number }
  markDirty: () => void
}) {
  const { editor, getRenderer, getView, getViewport, markDirty } = options
  const frames = shaderFrames(editor)
  const players = new Map<string, Player>()
  /** Players starting at a new size beside the ones they replace, by image. */
  const replacing = new Map<string, Player>()
  /**
   * Sizes a replacement failed to start at, by image, with the preset it was for. The player it
   * would have replaced plays on, and no replacement is tried again near that size until the
   * preset changes or the view moves well away from it.
   */
  const failedSizes = new Map<string, { preset: string; size: { width: number; height: number } }>()
  /** Shaders that failed to start, by the preset that failed, which are not tried again. */
  const failed = new Map<string, string>()
  /** Renderers to let go of once the frame being drawn is done with them. */
  const retired: Player[] = []
  let last = 0
  let stepping = false
  /** Where the next frame starts drawing, when the last one ran out of time. */
  let turn = 0
  /** Whether this browser needs each frame copied before the canvas can show it. */
  let copyFrames = false

  function release() {
    for (const player of retired.splice(0)) {
      player.renderer?.dispose()
      player.copied?.close()
    }
  }

  function stop(hash: string) {
    failedSizes.delete(hash)
    const replacement = replacing.get(hash)
    if (replacement) {
      replacement.disposed = true
      replacing.delete(hash)
    }
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
    const scale = getView().zoom * (window.devicePixelRatio || 1)
    const width = Math.max(...bounds.map((rect) => rect.width)) * scale
    const height = Math.max(...bounds.map((rect) => rect.height)) * scale
    const fit = Math.min(1, MAX_PLAY_EDGE / Math.max(width, height, 1))
    return {
      width: Math.max(1, Math.round(width * fit)),
      height: Math.max(1, Math.round(height * fit))
    }
  }

  function onScreen(bounds: Rect[]): boolean {
    const { panX, panY, zoom } = getView()
    const view = getViewport()
    return bounds.some(
      (rect) =>
        rect.x * zoom + panX < view.width &&
        (rect.x + rect.width) * zoom + panX > 0 &&
        rect.y * zoom + panY < view.height &&
        (rect.y + rect.height) * zoom + panY > 0
    )
  }

  /**
   * Starts playing `hash`'s shader at `size`. A player that `replaces` one already playing, at
   * another size, starts beside it: the old one keeps drawing until the new one is ready, and the
   * new one takes over at the same point in the animation, so a zoom neither flashes the still
   * frame nor starts the animation over.
   */
  async function start(
    hash: string,
    preset: ShaderPreset,
    size: { width: number; height: number },
    replaces?: Player
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
      disposed: false,
      copied: null,
      drawnAt: 0,
      elapsed: 0
    }
    if (replaces) replacing.set(hash, player)
    else players.set(hash, player)
    // Read through a call: the player may be stopped while the library loads.
    const stopped = () => player.disposed
    let renderer: Player['renderer'] = null
    try {
      const shaders = await import('shaders/core')
      if (stopped()) return
      renderer = shaders.createRendererFromJSON(structuredClone(preset))
      await renderer.initialize(canvas)
    } catch (error) {
      // A shader that cannot play keeps its still frame until its preset changes. A newer
      // player that replaced this one while it started is left alone.
      console.warn('Could not play a shader', error)
      renderer?.dispose()
      // A replacement that fails leaves the player it would have replaced playing.
      if (replacing.get(hash) === player) {
        replacing.delete(hash)
        failedSizes.set(hash, { preset: player.preset, size })
      } else if (players.get(hash) === player) {
        stop(hash)
        failed.set(hash, player.preset)
      }
      return
    }
    if (stopped()) {
      renderer.dispose()
      return
    }
    player.renderer = renderer
    if (replacing.get(hash) !== player) return
    replacing.delete(hash)
    const previous = players.get(hash)
    // The one it replaces may have stopped meanwhile, as when preview ended; then so does this.
    if (!previous || previous !== replaces) {
      player.disposed = true
      retired.push(player)
      if (!stepping) release()
      return
    }
    player.nodeIds = previous.nodeIds
    player.visible = previous.visible
    // The old player kept drawing while this one started, so it takes over from there.
    player.elapsed = previous.elapsed
    players.set(hash, player)
    // Its frame replaces the old one's at the next draw, so the canvas never shows the still.
    previous.disposed = true
    retired.push(previous)
    if (!stepping) release()
  }

  /** Whether a player drawing at `canvas`'s size should be redrawn at `size` instead. */
  /** Whether `size` is far enough from `from`, in pixels, to draw at again. */
  function differs(from: number, size: { width: number; height: number }) {
    const factor = size.width / Math.max(1, from)
    return factor > RESIZE_FACTOR || factor < 1 / RESIZE_FACTOR
  }

  function resized(canvas: HTMLCanvasElement, size: { width: number; height: number }) {
    return differs(canvas.width * (window.devicePixelRatio || 1), size)
  }

  /** Whether a replacement for `hash` failed at about `size`, for the preset it plays now. */
  function failedNear(hash: string, preset: string, size: { width: number; height: number }) {
    const failure = failedSizes.get(hash)
    if (!failure) return false
    if (failure.preset === preset && !differs(failure.size.width, size)) return true
    failedSizes.delete(hash)
    return false
  }

  function sync() {
    const view = getView()
    const playing = view.play !== null && canDrawShaders()
    const wanted = playing ? shadersOnPage(editor, view.currentPageId) : new Map()
    for (const [hash, player] of players) {
      const shader = wanted.get(hash)
      if (!shader || JSON.stringify(shader.preset) !== player.preset) stop(hash)
    }
    for (const [hash, shader] of wanted) {
      if (failed.get(hash) !== JSON.stringify(shader.preset)) failed.delete(hash)
      const visible = onScreen(shader.bounds)
      const size = screenSize(shader.bounds)
      const existing = players.get(hash)
      if (
        existing &&
        visible &&
        !replacing.has(hash) &&
        resized(existing.canvas, size) &&
        !failedNear(hash, existing.preset, size)
      ) {
        void start(hash, shader.preset, size, existing)
      }
      if (!players.has(hash) && visible && !failed.has(hash)) void start(hash, shader.preset, size)
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
      if (stepping || (copyFrames && last !== 0 && timestamp - last < COPY_FRAME_MS)) return
      last = timestamp
      stepping = true
      void step(timestamp).finally(() => {
        stepping = false
        release()
      })
    },
    { immediate: false }
  )

  /**
   * Draws every visible shader and shows its frame. The WebGPU canvas itself is uploaded right
   * after drawing, in the same task, since it keeps its frame only until that task ends. A
   * browser that cannot upload a WebGPU canvas gets a copy of each frame instead, which costs a
   * readback, so frames then come at most every `COPY_FRAME_MS`.
   */
  async function step(now: number) {
    const renderer = getRenderer()
    if (!renderer) return
    const copies: Promise<{ hash: string; player: Player; frame: ImageBitmap }>[] = []
    let drew = false
    const drawing = [...players].filter(([, player]) => player.visible && player.renderer)
    const started = performance.now()
    for (let index = 0; index < drawing.length; index++) {
      const [hash, player] = drawing[(turn + index) % drawing.length]
      // A player's first frame jumps to where the one it replaced had got to.
      const delta = player.drawnAt === 0 ? player.elapsed : (now - player.drawnAt) / 1000
      if (player.drawnAt !== 0) player.elapsed += delta
      player.drawnAt = now
      await player.renderer?.renderFrame({ deltaSeconds: delta, waitForGpu: false })
      if (player.disposed) continue
      // Preview's islands draw their shader layers from this frame, in this same task.
      frames.publish(hash, player.canvas)
      if (!copyFrames && uploads(renderer, hash, player)) drew = true
      else {
        copyFrames = true
        copies.push(createImageBitmap(player.canvas).then((frame) => ({ hash, player, frame })))
      }
      // The next frame starts with the shaders this one had no time for.
      if (performance.now() - started > FRAME_BUDGET_MS) {
        turn = (turn + index + 1) % drawing.length
        break
      }
    }
    for (const { hash, player, frame } of await Promise.all(copies)) {
      if (player.disposed) {
        frame.close()
        continue
      }
      renderer.setLiveImage(hash, frame, player.nodeIds)
      player.copied?.close()
      player.copied = frame
      drew = true
    }
    if (drew) markDirty()
  }

  /** Whether the canvas shows `player`'s WebGPU canvas uploaded as it is. */
  function uploads(renderer: SkiaRenderer, hash: string, player: Player): boolean {
    try {
      return renderer.setLiveImage(hash, player.canvas, player.nodeIds)
    } catch {
      return false
    }
  }

  watch(() => [getView().play !== null, getView().currentPageId, editor.state.sceneVersion], sync, {
    immediate: true
  })
  // The view moving or the canvas resizing, as it does when preview hides the panels, changes
  // what is on screen.
  watchThrottled(
    () => [
      getView().panX,
      getView().panY,
      getView().zoom,
      getViewport().width,
      getViewport().height
    ],
    sync,
    { throttle: VIEW_CHECK_MS }
  )

  onScopeDispose(() => {
    pause()
    for (const hash of Array.from(players.keys())) stop(hash)
    release()
  })
}
