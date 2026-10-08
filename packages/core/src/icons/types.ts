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
  /** Nested SVG clip regions, ordered from outermost to innermost. */
  clipPaths?: SVGClipPathRegion[]
  /** Raw transform attribute from the source SVG element. */
  transform?: string | null
}

export type SVGClipPathInfo = Pick<IconPathInfo, 'd' | 'fillRule' | 'transform'>

export interface SVGClipPathRegion {
  paths: SVGClipPathInfo[]
  units: 'userSpaceOnUse' | 'objectBoundingBox'
}
