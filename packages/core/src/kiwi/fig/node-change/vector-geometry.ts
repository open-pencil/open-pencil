import type { NodeChange, Paint } from '@open-pencil/kiwi/fig/codec'
import type { Fill, GeometryPath, VectorNetwork, WindingRule } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { decodeVectorNetworkBlob } from '#core/vector'

import { convertFills } from './paint'

export type VectorStyleOverride = {
  styleID: number
  handleMirroring?: string
  fillPaints?: Paint[]
}

export function resolveVectorNetwork(nc: NodeChange, blobs: Uint8Array[]): VectorNetwork | null {
  const vectorData = nc.vectorData as
    | {
        vectorNetworkBlob?: number
        normalizedSize?: Vector
        styleOverrideTable?: VectorStyleOverride[]
      }
    | undefined

  if (vectorData?.vectorNetworkBlob === undefined) return null
  const idx = vectorData.vectorNetworkBlob
  if (idx < 0 || idx >= blobs.length) return null

  try {
    const network = decodeVectorNetworkBlob(blobs[idx], vectorData.styleOverrideTable)

    const ns = vectorData.normalizedSize
    const nodeW = nc.size?.x ?? 0
    const nodeH = nc.size?.y ?? 0
    if (ns && nodeW > 0 && nodeH > 0 && (ns.x !== nodeW || ns.y !== nodeH)) {
      const sx = nodeW / ns.x
      const sy = nodeH / ns.y
      for (const v of network.vertices) {
        v.x *= sx
        v.y *= sy
      }
      for (const seg of network.segments) {
        seg.tangentStart = { x: seg.tangentStart.x * sx, y: seg.tangentStart.y * sy }
        seg.tangentEnd = { x: seg.tangentEnd.x * sx, y: seg.tangentEnd.y * sy }
      }
    }

    return network
  } catch {
    return null
  }
}

interface KiwiPath {
  windingRule?: string
  commandsBlob?: number
  styleID?: number
}

/** Map styleOverrideTable fillPaints by styleID (Figma multi-color vectors). */
export function styleOverrideFillsById(
  styleOverrideTable: VectorStyleOverride[] | undefined
): Map<number, Fill[]> {
  const map = new Map<number, Fill[]>()
  if (!styleOverrideTable) return map
  for (const entry of styleOverrideTable) {
    if (entry.styleID == null) continue
    if (!entry.fillPaints || entry.fillPaints.length === 0) continue
    map.set(entry.styleID, convertFills(entry.fillPaints))
  }
  return map
}

export function resolveGeometryPaths(
  paths: KiwiPath[] | undefined,
  blobs: Uint8Array[],
  styleFillsById?: Map<number, Fill[]>
): GeometryPath[] {
  if (!paths || paths.length === 0) return []
  const result: GeometryPath[] = []
  for (const p of paths) {
    if (p.commandsBlob === undefined || p.commandsBlob < 0 || p.commandsBlob >= blobs.length)
      continue
    const blob = blobs[p.commandsBlob]
    if (blob.length === 0) continue
    const styleID = typeof p.styleID === 'number' ? p.styleID : undefined
    const path: GeometryPath = {
      windingRule: (p.windingRule === 'EVENODD' ? 'EVENODD' : 'NONZERO') as WindingRule,
      commandsBlob: blob
    }
    if (styleID != null && styleID !== 0) {
      path.styleID = styleID
      const fills = styleFillsById?.get(styleID)
      if (fills && fills.length > 0) path.fills = fills
    }
    result.push(path)
  }
  return result
}
