import type { TypefaceFontProvider } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'
import type { Size } from '@open-pencil/scene-graph/primitives'

import { ResourceCache } from '#core/cache/resource'
import type { missingGlyphOccurrences } from '#core/text/resolver'

// Bound both the number of native paragraphs and the text retained by them. Source UTF-16 units
// are a workload bound, not an estimate of native bytes. A page of a few thousand texts must fit,
// or every record shapes them all again: the Preline CMS page holds 2,448.
const MAX_PREPARED_PARAGRAPHS = 8192
const MAX_PREPARED_TEXT_UNITS = 1_048_576
// Layout measures a text at a few widths; more than this means the widths are not repeating.
const MAX_MEASURED_WIDTHS = 16
// Bound the shapings layers share by their key length, which holds the text.
const MAX_SHARED_SHAPINGS = 8192
const MAX_SHARED_SHAPING_UNITS = 1_048_576

import type { TextDecorationRect } from '#core/canvas/text/decorations'
import type { TextLayout } from '#core/canvas/text/layout'
import { PARAGRAPH_INPUT_KEYS, shapingInputs } from '#core/canvas/text/paragraph/inputs'

type PreparationInput = SceneNode[(typeof PARAGRAPH_INPUT_KEYS)[number]]

export interface PreparedText {
  paragraph: TextLayout
  missingGlyphs?: ReturnType<typeof missingGlyphOccurrences>
  /** The underlines and strikethroughs drawn `y` below the text's top, found once per layout. */
  decorations?: { y: number; rects: TextDecorationRect[] }
}

/** What shaping a text showed: whether its faces cover it, and its size at each layout width. */
interface ShapingResult {
  covered: boolean
  sizes: Map<number, Size>
}

/**
 * A node's view of the shaping its text shows, valid while its `shapingInputs` stay the same. The
 * result is shared by every layer whose text shapes the same, such as an instance's copies.
 */
interface Shaping {
  inputs: PreparationInput[]
  key: string
  result: ShapingResult
}

interface Entry extends PreparedText {
  nodeId: string
  inputs: PreparationInput[]
  units: number
}

export class TextPreparationCache {
  private readonly entries: ResourceCache<string, Entry>
  private readonly nodeKeys = new Map<string, Set<string>>()
  // Coverage and measured sizes contain no native resources. Keep them independently of
  // paragraph LRU eviction: each node's view weakly owned by the node, the results it shares with
  // identical text bounded by their keys.
  private shaping = new WeakMap<SceneNode, Shaping>()
  private readonly results = new ResourceCache<string, ShapingResult>({
    maxEntries: MAX_SHARED_SHAPINGS,
    maxWeight: MAX_SHARED_SHAPING_UNITS,
    weight: (_result, key) => key.length
  })
  private readonly invalidatedShaping = new Set<string>()
  private generation = -1
  private provider: TypefaceFontProvider | null = null

  constructor(
    private readonly maxEntries = MAX_PREPARED_PARAGRAPHS,
    private readonly maxTextUnits = MAX_PREPARED_TEXT_UNITS
  ) {
    this.entries = new ResourceCache({
      maxEntries,
      maxWeight: maxTextUnits,
      weight: (entry) => entry.units,
      dispose: (entry, key) => {
        const keys = this.nodeKeys.get(entry.nodeId)
        keys?.delete(key)
        if (keys?.size === 0) this.nodeKeys.delete(entry.nodeId)
        entry.paragraph.delete()
      }
    })
  }

  /** Borrowed paragraphs must not be retained, deleted or relaid out by drawing callers. */
  use<T>(
    node: SceneNode,
    variant: string,
    generation: number,
    provider: TypefaceFontProvider,
    build: () => TextLayout,
    consume: (prepared: PreparedText) => T
  ): T {
    this.useScope(generation, provider)
    if (node.text.length > this.maxTextUnits || this.maxEntries <= 0) {
      const paragraph = build()
      try {
        return consume({ paragraph })
      } finally {
        paragraph.delete()
      }
    }
    const key = `${node.id}\0${variant}`
    let entry = this.entries.get(key)
    if (
      entry &&
      !PARAGRAPH_INPUT_KEYS.every((prop, index) => entry?.inputs[index] === node[prop])
    ) {
      // Shaping compares its own inputs, so a change it doesn't see, such as a resize, keeps it.
      this.deleteNode(node.id, { keepShaping: true })
      entry = undefined
    }
    if (!entry) {
      entry = {
        nodeId: node.id,
        inputs: PARAGRAPH_INPUT_KEYS.map((prop) => node[prop]),
        paragraph: build(),
        units: node.text.length
      }
      this.entries.set(key, entry)
      const keys = this.nodeKeys.get(node.id) ?? new Set<string>()
      keys.add(key)
      this.nodeKeys.set(node.id, keys)
    }
    return consume(entry)
  }

  hasGlyphCoverage(node: SceneNode, generation: number, provider: TypefaceFontProvider): boolean {
    if (this.generation !== generation || this.provider !== provider) return false
    // A copy that has not shaped yet still finds what its source's identical text showed.
    return this.shapingFor(node).result.covered
  }

  /** Call only after observing complete coverage with this cache's current font scope. */
  recordGlyphCoverage(node: SceneNode): void {
    this.shapingFor(node).result.covered = true
  }

  /** The size of `node`'s text laid out at `layoutWidth`, measured once per shaping. */
  measure(
    node: SceneNode,
    layoutWidth: number,
    generation: number,
    provider: TypefaceFontProvider,
    compute: () => Size
  ): Size {
    this.useScope(generation, provider)
    const sizes = this.shapingFor(node).result.sizes
    const cached = sizes.get(layoutWidth)
    if (cached) return cached
    const size = compute()
    if (sizes.size >= MAX_MEASURED_WIDTHS) sizes.clear()
    sizes.set(layoutWidth, size)
    return size
  }

  /**
   * Drops `id`'s paragraphs and, unless `keepShaping`, its coverage and measured sizes. Keep
   * them only for changes `shapingInputs` compares, such as layout resizing the box.
   */
  deleteNode(id: string, { keepShaping = false } = {}): void {
    // Invalidation arrives by ID; don't add strong node ownership just to find
    // weak observations. Bound pending IDs and conservatively reset on overflow.
    if (!keepShaping) this.invalidatedShaping.add(id)
    if (this.invalidatedShaping.size > this.maxEntries) {
      this.shaping = new WeakMap()
      this.invalidatedShaping.clear()
      this.results.clear()
    }
    const keys = this.nodeKeys.get(id)
    if (keys) for (const key of keys) this.entries.delete(key)
  }

  private useScope(generation: number, provider: TypefaceFontProvider): void {
    if (this.generation === generation && this.provider === provider) return
    this.clear()
    this.generation = generation
    this.provider = provider
  }

  private currentShaping(node: SceneNode): Shaping | null {
    if (this.invalidatedShaping.delete(node.id)) {
      // An explicit invalidation covers what the inputs cannot show, so the shared result goes too.
      const invalidated = this.shaping.get(node)
      if (invalidated) this.results.delete(invalidated.key)
      this.shaping.delete(node)
      return null
    }
    const shaping = this.shaping.get(node)
    if (!shaping) return null
    const current = shapingInputs(node)
    if (
      current.length === shaping.inputs.length &&
      current.every((input, index) => input === shaping.inputs[index])
    )
      return shaping
    this.shaping.delete(node)
    return null
  }

  private shapingFor(node: SceneNode): Shaping {
    const existing = this.currentShaping(node)
    if (existing) return existing
    const inputs = shapingInputs(node)
    const key = JSON.stringify(inputs)
    let result = this.results.get(key)
    if (!result) {
      result = { covered: false, sizes: new Map() }
      this.results.set(key, result)
    }
    const created: Shaping = { inputs, key, result }
    this.shaping.set(node, created)
    return created
  }

  clear(): void {
    this.nodeKeys.clear()
    this.shaping = new WeakMap()
    this.invalidatedShaping.clear()
    this.results.clear()
    this.entries.clear()
  }
}
