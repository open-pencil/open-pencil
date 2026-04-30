import type { VectorNetwork, WindingRule } from '#core/scene-graph'

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

export interface IconPathInfo {
  d: string
  fill: string | null
  stroke: string | null
  strokeWidth: number
  strokeCap: string
  strokeJoin: string
  fillRule: WindingRule
}
