import type { DesignTokenCollection } from '#design-json/tokens'

import type { Rect } from '@open-pencil/scene-graph/primitives'

export const COMPACT_DESIGN_FORMAT = 'open-pencil/design-json-compact'
export const COMPACT_DESIGN_VERSION = 2

/** What a layer is, as something that renders it would need to know. */
export type CompactKind =
  | 'frame'
  | 'section'
  | 'group'
  | 'component'
  | 'instance'
  | 'text'
  | 'image'
  | 'shape'
  | 'vector'
  | 'other'

/** How an auto layout frame places its children. */
export interface CompactLayout {
  direction: 'row' | 'column' | 'grid'
  gap: number
  /** Top, right, bottom, left. */
  padding: [number, number, number, number]
  align: string
  crossAlign: string
  wrap: boolean
}

/**
 * A color: its `value`, a hex color or the kind of gradient, and the `name` of the variable it is
 * bound to, such as `color/black`, when it is bound to one.
 */
export interface CompactColor {
  value: string
  name?: string
}

/** How a layer looks, with only what differs from a plain, unstyled layer. */
export interface CompactStyle {
  /** The visible fills. */
  fills?: CompactColor[]
  border?: { colors: CompactColor[]; width: number }
  radius?: number
  opacity?: number
  /** The visible effects by type, as `DROP_SHADOW` or `LAYER_BLUR`. */
  effects?: string[]
  clipsContent?: boolean
}

export interface CompactText {
  content: string
  font: { family: string; size: number; weight: number; italic: boolean }
  color?: CompactColor
  align: string
}

/** One path of a vector: SVG path data, and how it fills, or `none` for an open path. */
export interface CompactVectorPath {
  d: string
  fillRule: 'nonzero' | 'evenodd' | 'none'
}

/** The shape a vector draws, in its own coordinates from 0,0 to its width and height. */
export interface CompactVector {
  width: number
  height: number
  paths: CompactVectorPath[]
}

/** Why a layer sits where the design did not put it. */
export type CompactInference = 'contained' | 'overlap'

export interface CompactNode {
  id: string
  name: string
  kind: CompactKind
  /** Position relative to the compact parent, size as drawn. */
  box: Rect
  layout?: CompactLayout
  style?: CompactStyle
  text?: CompactText
  /** For a vector: the paths it draws; `vectorSVG` writes them as an SVG file. */
  vector?: CompactVector
  /** Hashes of the images its fills draw, described in {@link CompactDesign.images}. */
  images?: string[]
  /**
   * The variables its fields other than colors use, by name, keyed as the design binds them:
   * `itemSpacing`, `paddingLeft`, `cornerRadius`. A color names its variable beside its value.
   */
  variables?: Record<string, string>
  /** For an instance: the main component it shows, and the values of its properties. */
  component?: { id: string; name: string; props: Record<string, string> }
  /**
   * Set when the nesting is inferred rather than the design's: `contained` for a layer drawn
   * wholly inside the one below it, `overlap` for a group made around overlapping layers.
   */
  inferred?: CompactInference
  children?: CompactNode[]
}

export interface CompactImage {
  mimeType: string
  byteLength: number
  /** The layers that draw it. */
  usedBy: string[]
}

/** An index of the whole tree, to see what a design holds at a glance. */
export interface CompactSummary {
  layers: number
  depth: number
  byKind: Partial<Record<CompactKind, number>>
  fonts: string[]
  colors: string[]
  /** Main components the instances show, by ID, with how many instances do. */
  components: Record<string, { name: string; instances: number }>
  /** Layers whose nesting was inferred. */
  inferred: number
}

export interface CompactDesign {
  format: typeof COMPACT_DESIGN_FORMAT
  version: typeof COMPACT_DESIGN_VERSION
  roots: CompactNode[]
  images: Record<string, CompactImage>
  /** Every variable in the document as a token, by collection, with its value in each mode. */
  tokens: DesignTokenCollection[]
  summary: CompactSummary
}

export interface CompactDesignOptions {
  /**
   * Nests a layer drawn wholly inside one below it as that layer's child, and groups layers
   * that overlap, where their parent does not lay them out itself. Off by default.
   */
  inferNesting?: boolean
}
