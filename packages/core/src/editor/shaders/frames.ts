import { isEqual } from 'es-toolkit/predicate'

import {
  isShaderFrameCurrent,
  readShaderPaints,
  shaderOfPaint,
  withShaderPaints,
  type SceneNode,
  type ShaderPaint
} from '@open-pencil/scene-graph'

import type { EditorContext, EditorOptions } from '#core/editor/types'

import type { ShaderFrameSize, ShaderRasterizer } from './types'

/** Frames are drawn at twice the layer's size, for sharp high-density displays. */
const FRAME_SCALE = 2
/** The longest side a frame is drawn at, however large the layer. */
const MAX_FRAME_EDGE = 2048
/** How long a layer must keep its size before its frames are drawn again. */
const SETTLE_MS = 150

/** How far drawing a page's shader frames has got. */
export interface ShaderFramesProgress {
  phase: 'drawing-shaders'
  completed: number
  total: number
}

/** Fields whose change can leave a shader's frame out of date. */
const FRAME_FIELDS = ['fills', 'strokes', 'pluginData', 'width', 'height'] as const

/** The pixels a layer's frame is drawn at. */
function framePixels(size: ShaderFrameSize): ShaderFrameSize {
  const scale = Math.min(FRAME_SCALE, MAX_FRAME_EDGE / Math.max(size.width, size.height, 1))
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale))
  }
}

const frameKey = (shader: ShaderPaint, size: ShaderFrameSize) =>
  JSON.stringify([shader.preset, Math.round(size.width), Math.round(size.height)])

/** The shaders `node`'s paints show. */
function shownShaders(node: SceneNode): ShaderPaint[] {
  return [...node.fills, ...node.strokes].flatMap((paint) => {
    const shader = shaderOfPaint(node, paint)
    return shader ? [shader] : []
  })
}

/**
 * Keeps every shader paint's still frame drawn for its preset and its layer's size. A frame is
 * redrawn when its preset changes or its layer settles at a new size, and stored under the
 * image the paint already shows, so undoing any edit keeps paint and shader together. Frames
 * are drawn one at a time, since each one takes the GPU.
 */
export function createShaderFrames(
  ctx: EditorContext,
  options?: Pick<EditorOptions, 'shaderRasterizer'>
) {
  let rasterizer: ShaderRasterizer | null = options?.shaderRasterizer ?? null
  /** What this session drew under each image, which outranks a saved frame's size. */
  const drawn = new Map<string, string>()
  const pending = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let drawing: Promise<void> | null = null

  function isCurrent(shader: ShaderPaint, size: ShaderFrameSize): boolean {
    const key = drawn.get(shader.image)
    if (key !== undefined) return key === frameKey(shader, size)
    return isShaderFrameCurrent(shader, size) && ctx.graph.images.has(shader.image)
  }

  function schedule(id: string) {
    if (!rasterizer) return
    pending.add(id)
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void drain()
    }, SETTLE_MS)
  }

  /** The shaders on `pageId` whose frames are missing or out of date. */
  function staleOnPage(pageId: string): { id: string; shader: ShaderPaint }[] {
    const graph = ctx.graph
    return [...graph.getAllNodes()].flatMap((node) => {
      if (readShaderPaints(node).length === 0 || !graph.isDescendant(node.id, pageId)) return []
      const size = { width: node.width, height: node.height }
      return shownShaders(node)
        .filter((shader) => !isCurrent(shader, size))
        .map((shader) => ({ id: node.id, shader }))
    })
  }

  async function drawFrame(id: string, shader: ShaderPaint, active: ShaderRasterizer) {
    const graph = ctx.graph
    const node = graph.getNode(id)
    if (!node) return
    const size = { width: node.width, height: node.height }
    const bytes = await active.render(shader.preset, framePixels(size))
    // The preset, the layer, or the document may have changed while the frame was drawn.
    const now = graph === ctx.graph ? graph.getNode(id) : undefined
    const current = now && shownShaders(now).find((item) => item.image === shader.image)
    if (!bytes || !now || !current || !isEqual(current.preset, shader.preset)) return
    graph.images.set(shader.image, bytes)
    drawn.set(shader.image, frameKey(shader, size))
    for (const renderer of ctx.getRenderers()) renderer.forgetImage(shader.image)
    // Not an edit of its own: the frame follows the preset and size an edit set.
    graph.updateNode(id, {
      pluginData: withShaderPaints(
        now,
        [...now.fills, ...now.strokes],
        [{ ...current, frame: size }]
      )
    })
    ctx.requestRender()
  }

  async function drawPending() {
    while (pending.size > 0) {
      const active = rasterizer
      if (!active) return
      const [id] = pending
      pending.delete(id)
      const node = ctx.graph.getNode(id)
      if (!node) continue
      const size = { width: node.width, height: node.height }
      for (const shader of shownShaders(node)) {
        if (isCurrent(shader, size)) continue
        // A frame that fails to draw keeps the one it has, and the next edit tries again.
        await drawFrame(id, shader, active).catch((error: unknown) => {
          console.warn('Could not draw a shader frame', error)
        })
      }
    }
  }

  /** Runs `work` once no other drawing is under way, so frames draw one at a time. */
  async function exclusive(work: () => Promise<void>): Promise<void> {
    if (drawing) {
      await drawing
      return exclusive(work)
    }
    drawing = work().finally(() => {
      drawing = null
    })
    await drawing
  }

  /** Draws what is pending, after any drawing already under way. */
  async function drain(): Promise<void> {
    if (pending.size > 0) await exclusive(drawPending)
  }

  /**
   * Draws the frames `pageId` needs before it is shown, as its fonts are loaded first, so the
   * page never appears with a shader missing. Without a rasterizer the saved frames stay.
   */
  async function drawPageShaderFrames(
    pageId: string,
    options: { signal?: AbortSignal; onProgress?: (progress: ShaderFramesProgress) => void } = {}
  ): Promise<void> {
    const active = rasterizer
    const stale = active ? staleOnPage(pageId) : []
    if (!active || stale.length === 0) return
    const progress = (completed: number) =>
      options.onProgress?.({ phase: 'drawing-shaders', completed, total: stale.length })
    progress(0)
    await exclusive(async () => {
      for (const [index, { id, shader }] of stale.entries()) {
        options.signal?.throwIfAborted()
        await drawFrame(id, shader, active).catch((error: unknown) => {
          console.warn('Could not draw a shader frame', error)
        })
        progress(index + 1)
      }
    })
  }

  ctx.onEditorEvent('node:created', (node) => {
    if (readShaderPaints(node).length > 0) schedule(node.id)
  })
  ctx.onEditorEvent('node:updated', (id, changes) => {
    if (!FRAME_FIELDS.some((field) => field in changes)) return
    const node = ctx.graph.getNode(id)
    if (node && readShaderPaints(node).length > 0) schedule(id)
  })
  // A new document's frames are drawn page by page as each is prepared.
  ctx.onEditorEvent('graph:replaced', () => {
    drawn.clear()
    pending.clear()
  })

  /** Draws shader frames with `next`, or stops drawing them when null. */
  function setShaderRasterizer(next: ShaderRasterizer | null) {
    if (rasterizer === next) return
    rasterizer?.destroy?.()
    rasterizer = next
  }

  const hasShaderRasterizer = () => rasterizer !== null

  /** Resolves once every frame waiting to be drawn has been drawn. */
  async function settleShaderFrames(): Promise<void> {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    await drain()
  }

  return { setShaderRasterizer, hasShaderRasterizer, settleShaderFrames, drawPageShaderFrames }
}
