import type { VectorNetwork, WindingRule } from '@open-pencil/scene-graph'
import type { IconOptions } from '@open-pencil/scene-graph/icons'

export interface IconPath {
  vectorNetwork: VectorNetwork
  fill: string | null
  /** How opaque the fill is, as for a symbol's secondary layers; opaque when left out. */
  fillOpacity?: number
  stroke: string | null
  strokeWidth: number
  strokeCap: string
  strokeJoin: string
}

export interface IconData {
  prefix: string
  name: string
  width: number
  height: number
  paths: IconPath[]
  /** How a set we draw ourselves drew it, every option filled in; none for Iconify icons. */
  options?: IconOptions
}

/** A control for how a set's icons are drawn: a range, such as a font axis, or a choice. */
export type IconOption =
  | { key: string; name: string; min: number; max: number; default: number; step: number }
  | { key: string; name: string; values: readonly string[]; default: string }

export interface IconifyIconEntry {
  body: string
  width?: number
  height?: number
}

export interface IconifyResponse {
  prefix: string
  width?: number
  height?: number
  icons: { [key: string]: IconifyIconEntry | undefined }
  aliases?: { [key: string]: { parent: string } | undefined }
}

export interface IconSearchResult {
  icons: string[]
  total: number
  collections: Record<string, { name: string; total: number; category?: string }>
}

/** An icon set: what a picker shows to choose one. */
export interface IconCollection {
  /** The set's part of an icon name, such as `lucide`. */
  prefix: string
  name: string
  total: number
  category: string | null
  /** The license's title, such as `MIT`. */
  license: string | null
  /** Drawn in the set's own colors, which an icon color does not change. */
  multicolor: boolean
  /** How the set's icons can be drawn, for a set we draw ourselves. */
  options?: readonly IconOption[]
}

export interface IconPathInfo {
  d: string
  fill: string | null
  stroke: string | null
  strokeWidth: number
  strokeCap: string
  strokeJoin: string
  fillRule: WindingRule
  fillOpacity: number
  strokeOpacity: number
  /** Nested SVG clip regions, ordered from outermost to innermost. */
  clipPaths?: SVGClipPathRegion[]
  /** Raw transform attribute from the source SVG element. */
  transform?: string | null
  /** The `<g>` elements around the shape, outermost first, then the shape itself. */
  elements: SVGElementLayer[]
}

/** An element an import turns into a layer: a group or the shape. */
export interface SVGElementLayer {
  /** Shared by every path drawn inside the same element. */
  key: number
  kind: 'group' | 'shape'
  /** The element's `id`, when it is drawn directly rather than through `<use>`. */
  name: string | null
  opacity: number
  /** False when `visibility` or `display` hides it; Figma imports it as a hidden layer. */
  visible: boolean
  /** The clip region this element adds to `clipPaths`, by index. */
  clip: number | null
}

/** A stretch of SVG text in one style, such as a `<tspan>` on the same line. */
export interface SVGTextRun {
  text: string
  fill: string | null
  fillOpacity: number
  /** The first family the SVG names that is not a generic one such as `sans-serif`. */
  fontFamily: string | null
  fontSize: number
  fontWeight: number
  italic: boolean
  letterSpacing: number
  textDecoration: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH'
}

/** Text that starts at one position: a `<text>`, or a `<tspan>` that moves to a new one. */
export interface SVGTextPiece {
  /** The baseline origin, in the text element's own coordinates. */
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
  runs: SVGTextRun[]
}

export interface SVGTextInfo {
  pieces: SVGTextPiece[]
  transform: string | null
  clipPaths?: SVGClipPathRegion[]
  /** As for a path; the last entry is the `<text>` element. */
  elements: SVGElementLayer[]
  /** How many paths come before the text in drawing order. */
  pathIndex: number
}

export type SVGClipPathInfo = Pick<IconPathInfo, 'd' | 'fillRule' | 'transform'> & {
  /** False when `visibility` or `display` hides the shape, which Figma keeps as a hidden layer. */
  visible: boolean
}

export interface SVGClipPathRegion {
  /** The `<clipPath>` element's `id`. */
  id: string
  paths: SVGClipPathInfo[]
  units: 'userSpaceOnUse' | 'objectBoundingBox'
  /** False when the `<clipPath>` itself is hidden: Figma's mask is then hidden and clips nothing. */
  visible: boolean
}
