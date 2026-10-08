import type { Paragraph, TypefaceFontProvider } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'
import type { Size } from '@open-pencil/scene-graph/primitives'

import { ResourceCache } from '#core/cache/resource'
import type { missingGlyphOccurrences } from '#core/text/resolver'

// Bound both the number of native paragraphs and the text retained by them.
// Source UTF-16 units are a workload bound, not an estimate of native bytes.
const MAX_PREPARED_PARAGRAPHS = 1024
const MAX_PREPARED_TEXT_UNITS = 262_144
// Layout measures a text at a few widths; more than this means the widths are not repeating.
const MAX_MEASURED_WIDTHS = 16

import { PARAGRAPH_INPUT_KEYS, shapingInputs } from './paragraph-inputs'

type PreparationInput = SceneNode[(typeof PARAGRAPH_INPUT_KEYS)[number]]

export interface PreparedText {
  paragraph: Paragraph
  missingGlyphs?: ReturnType<typeof missingGlyphOccurrences>
}

/** What shaping a node's text showed, valid while its `shapingInputs` stay the same. */
interface Shaping {
  inputs: PreparationInput[]
  covered: boolean
  sizes: Map<number, Size>
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
  // paragraph LRU eviction, weakly owned by the source node.
  private shaping = new WeakMap<SceneNode, Shaping>()
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
    build: () => Paragraph,
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
    return this.currentShaping(node)?.covered === true
  }

  /** Call only after observing complete coverage with this cache's current font scope. */
  recordGlyphCoverage(node: SceneNode): void {
    this.shapingFor(node).covered = true
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
    const sizes = this.shapingFor(node).sizes
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
    const created: Shaping = { inputs: shapingInputs(node), covered: false, sizes: new Map() }
    this.shaping.set(node, created)
    return created
  }

  clear(): void {
    this.nodeKeys.clear()
    this.shaping = new WeakMap()
    this.invalidatedShaping.clear()
    this.entries.clear()
  }
}
