import { useRafFn } from '@vueuse/core'
import type { createRendererFromJSON } from 'shaders/core'
import { onScopeDispose, watch } from 'vue'

import type { SkiaRenderer } from '@open-pencil/core/canvas'
import type { Editor } from '@open-pencil/core/editor'
import { readShaderPaints, shaderOfPaint, type ShaderPreset } from '@open-pencil/scene-graph'

import { canDrawShaders } from '#vue/canvas/surface/shader-rasterizer'

/** The longest side a playing shader is drawn at, so many shaders stay smooth together. */
const MAX_PLAY_EDGE = 1024

/** A shader playing on its own WebGPU canvas, shown wherever its image is painted. */
interface Player {
  preset: string
  nodeIds: Set<string>
  canvas: HTMLCanvasElement
  renderer: ReturnType<typeof createRendererFromJSON> | null
  /** The frame last handed to the canvas, closed once the next one replaces it. */
  shown: ImageBitmap | null
  disposed: boolean
}

/** Each image a shader paint on `pageId` shows, with its preset, size, and the layers painting it. */
function shadersOnPage(editor: Editor, pageId: string) {
  const found = new Map<
    string,
    { preset: ShaderPreset; width: number; height: number; nodeIds: Set<string> }
  >()
  for (const node of editor.graph.getAllNodes()) {
    if (readShaderPaints(node).length === 0 || !editor.graph.isDescendant(node.id, pageId)) continue
    for (const paint of [...node.fills, ...node.strokes]) {
      const shader = shaderOfPaint(node, paint)
      if (!shader || !paint.visible) continue
      const entry = found.get(shader.image)
      if (entry) entry.nodeIds.add(node.id)
      else
        found.set(shader.image, {
          preset: shader.preset,
          width: node.width,
          height: node.height,
          nodeIds: new Set([node.id])
        })
    }
  }
  return found
}

/**
 * Plays every shader paint on the current page while the editor previews it: each runs on its
 * own WebGPU canvas, and its frames replace the still frame wherever the canvas paints that
 * image, so the layers above, masks, and clipping draw as usual. Leaving preview shows the
 * still frames again. Without WebGPU the still frames stay.
 */
export function useShaderPlayback(options: {
  editor: Editor
  getRenderer: () => SkiaRenderer | null
  markDirty: () => void
}) {
  const { editor, getRenderer, markDirty } = options
  const players = new Map<string, Player>()
  let last = 0
  let stepping = false

  function stop(hash: string) {
    const player = players.get(hash)
    if (!player) return
    player.disposed = true
    player.renderer?.dispose()
    player.shown?.close()
    players.delete(hash)
    getRenderer()?.setLiveImage(hash, null, player.nodeIds)
  }

  async function start(
    hash: string,
    preset: ShaderPreset,
    size: { width: number; height: number }
  ) {
    const ratio = window.devicePixelRatio || 1
    const scale = Math.min(1, MAX_PLAY_EDGE / (Math.max(size.width, size.height, 1) * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(size.width * scale))
    canvas.height = Math.max(1, Math.round(size.height * scale))
    const player: Player = {
      preset: JSON.stringify(preset),
      nodeIds: new Set(),
      canvas,
      renderer: null,
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

  function sync() {
    const playing = editor.state.play !== null && canDrawShaders()
    const wanted = playing ? shadersOnPage(editor, editor.state.currentPageId) : new Map()
    for (const [hash, player] of players) {
      const shader = wanted.get(hash)
      if (!shader || JSON.stringify(shader.preset) !== player.preset) stop(hash)
    }
    for (const [hash, shader] of wanted) {
      if (!players.has(hash)) void start(hash, shader.preset, shader)
      const player = players.get(hash)
      if (player) player.nodeIds = shader.nodeIds
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
      last = timestamp
      if (stepping) return
      stepping = true
      void step(delta).finally(() => {
        stepping = false
      })
    },
    { immediate: false }
  )

  async function step(delta: number) {
    const renderer = getRenderer()
    if (!renderer) return
    for (const [hash, player] of players) {
      if (!player.renderer) continue
      await player.renderer.renderFrame({ deltaSeconds: delta, waitForGpu: false })
      // A WebGPU canvas keeps its frame only until the task that drew it ends.
      const frame = await createImageBitmap(player.canvas)
      if (player.disposed) {
        frame.close()
        continue
      }
      renderer.setLiveImage(hash, frame, player.nodeIds)
      player.shown?.close()
      player.shown = frame
    }
    markDirty()
  }

  watch(
    () => [editor.state.play !== null, editor.state.currentPageId, editor.state.sceneVersion],
    sync,
    { immediate: true }
  )

  onScopeDispose(() => {
    pause()
    for (const hash of Array.from(players.keys())) stop(hash)
  })
}
