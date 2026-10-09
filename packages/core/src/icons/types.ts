import type { VectorNetwork, WindingRule } from '@open-pencil/scene-graph'

export interface IconPath {
  vectorNetwork: VectorNetwork
  fill: string | null
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
}

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
  /** The clip region this element adds to `clipPaths`, by index. */
  clip: number | null
}

export type SVGClipPathInfo = Pick<IconPathInfo, 'd' | 'fillRule' | 'transform'>

export interface SVGClipPathRegion {
  /** The `<clipPath>` element's `id`. */
  id: string
  paths: SVGClipPathInfo[]
  units: 'userSpaceOnUse' | 'objectBoundingBox'
}
