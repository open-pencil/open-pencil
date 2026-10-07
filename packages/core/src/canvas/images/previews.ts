import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { ResourceCache } from '#core/cache/resource'

const PREVIEW_EDGES = [128, 256, 512, 1024, 2048] as const
const MAX_PENDING = 64
/** Previews decoding at once; the browser decodes off the main thread. */
const DECODE_CONCURRENCY = 4
const PREVIEW_CACHE_BYTES = 64 * 1024 * 1024
/** Documents with more images, or more encoded image bytes, than these draw previews. */
const PREVIEW_IMAGE_COUNT = 128
const PREVIEW_IMAGE_BYTES = 32 * 1024 * 1024

const previewDecisions = new WeakMap<SceneGraph, { count: number; needed: boolean }>()

/**
 * Whether a document has enough image data to draw previews sized to the view instead of whole
 * images. Kept per document and image count, since the renderer asks on every frame.
 */
export function needsImagePreviews(graph: SceneGraph): boolean {
  const count = graph.images.size
  const known = previewDecisions.get(graph)
  if (known?.count === count) return known.needed
  let needed = count > PREVIEW_IMAGE_COUNT
  let bytes = 0
  for (const data of graph.images.values()) {
    if (needed) break
    bytes += data.byteLength
    needed = bytes > PREVIEW_IMAGE_BYTES
  }
  previewDecisions.set(graph, { count, needed })
  return needed
}

export function previewEdge(node: Pick<SceneNode, 'width' | 'height'>, zoom: number, dpr = 1) {
  const pixels = Math.max(node.width, node.height) * zoom * dpr
  return PREVIEW_EDGES.find((edge) => edge >= pixels) ?? 2048
}

export interface ImagePreview {
  bytes: Uint8Array<ArrayBuffer>
  originalWidth: number
  originalHeight: number
}

/** Browser adapters decode outside the CanvasKit heap; Core stays platform independent. */
export interface ImagePreviewDecoder {
  decode(source: Uint8Array, edge: number): Promise<ImagePreview>
  destroy(): void
}

interface PreviewEntry {
  source: Uint8Array
  preview?: ImagePreview
}
interface PreviewJob {
  key: string
  source: Uint8Array
  edge: number
}

/** Per-renderer encoded LRU, with serialized and bounded asynchronous decoding. */
export class ImagePreviewCache {
  private readonly entries: ResourceCache<string, PreviewEntry>
  private readonly pending = new Map<string, PreviewJob>()
  private graph: SceneGraph | null = null
  private queue: PreviewJob[] = []
  private decoder: ImagePreviewDecoder | null = null
  private workers = 0
  private disposed = false
  private generation = 0

  constructor(
    private readonly ready: () => void,
    maxBytes = PREVIEW_CACHE_BYTES
  ) {
    this.entries = new ResourceCache({
      maxEntries: 256,
      maxWeight: maxBytes,
      weight: (entry) => entry.preview?.bytes.byteLength ?? 1
    })
  }

  get bytes(): number {
    return this.entries.weight
  }
  private canDecode(): boolean {
    return !this.disposed && this.decoder !== null
  }
  get enabled(): boolean {
    return this.canDecode()
  }
  get idle(): boolean {
    return this.workers === 0 && this.queue.length === 0
  }

  setDecoder(decoder: ImagePreviewDecoder) {
    this.reset()
    this.decoder?.destroy()
    this.decoder = decoder
  }

  private reset() {
    this.generation++
    this.entries.clear()
    this.pending.clear()
    this.queue = []
  }

  /** Lets go of a document's previews and image bytes, keeping the decoder for the next one. */
  release() {
    this.reset()
    this.graph = null
  }

  get(
    graph: SceneGraph,
    hash: string,
    edge: number
  ): { key: string; preview: ImagePreview } | undefined {
    if (!this.enabled) return undefined
    if (this.graph !== graph) {
      this.reset()
      this.graph = graph
    }
    const source = graph.images.get(hash)
    if (!source) return undefined
    const key = `${hash}:preview:${edge}`
    const existing = this.entries.peek(key)
    if (existing && existing.source !== source) this.entries.delete(key)
    if (!this.entries.has(key) && !this.pending.has(key) && this.pending.size < MAX_PENDING) {
      const job = { key, source, edge }
      this.pending.set(key, job)
      this.queue.push(job)
      this.drain()
    }
    // Keep an available level visible while the requested resolution is decoding.
    for (const candidate of [edge, ...[...PREVIEW_EDGES].reverse().filter((n) => n !== edge)]) {
      const candidateKey = `${hash}:preview:${candidate}`
      const entry = this.entries.get(candidateKey)
      if (entry?.preview && entry.source === source)
        return { key: candidateKey, preview: entry.preview }
    }
    return undefined
  }

  private drain() {
    while (this.workers < DECODE_CONCURRENCY && this.queue.length > 0 && this.canDecode()) {
      this.workers++
      void this.work()
    }
  }

  private async work() {
    try {
      while (this.queue.length && this.canDecode()) {
        const job = this.queue.shift()
        const decoder = this.decoder
        if (!job || !decoder) break
        const generation = this.generation
        let preview: ImagePreview | undefined
        try {
          preview = await decoder.decode(job.source, job.edge)
        } catch (error) {
          if (generation === this.generation && !this.disposed)
            console.warn('Image preview decode failed:', error)
        }
        if (this.disposed || generation !== this.generation || this.pending.get(job.key) !== job)
          continue
        this.pending.delete(job.key)
        if (!this.entries.set(job.key, { source: job.source, preview })) {
          // Remember oversized results as failures instead of decoding them on every repaint.
          this.entries.set(job.key, { source: job.source })
        }
        if (preview) this.ready()
      }
    } finally {
      this.workers--
    }
  }

  destroy() {
    this.disposed = true
    this.reset()
    this.decoder?.destroy()
    this.decoder = null
    this.graph = null
  }
}
