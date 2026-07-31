import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { Fill, GeometryPath, VectorNetwork, WindingRule } from '@open-pencil/scene-graph'
import { copyFills } from '@open-pencil/scene-graph/copy'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { convertFills } from './paint'
import { decodeVectorNetworkBlob, type StyleOverride } from './vector-network'

export function alignGeometryWindingRules(
  geometry: GeometryPath[],
  vectorNetwork: VectorNetwork | null
): GeometryPath[] {
  const regions = vectorNetwork?.regions ?? []
  if (geometry.length === regions.length) {
    return geometry.map((path, index) => ({
      ...path,
      windingRule: regions[index].windingRule
    }))
  }
  if (
    geometry.length === 1 &&
    regions.length > 0 &&
    regions.every((region) => region.windingRule === regions[0].windingRule)
  ) {
    return [{ ...geometry[0], windingRule: regions[0].windingRule }]
  }
  return geometry
}

export function resolveVectorNetwork(nc: NodeChange, blobs: Uint8Array[]): VectorNetwork | null {
  const vectorData = nc.vectorData as
    | {
        vectorNetworkBlob?: number
        normalizedSize?: Vector
        styleOverrideTable?: StyleOverride[]
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

export function resolveStyleOverrideFills(
  styleOverrideTable: StyleOverride[] | undefined
): ReadonlyMap<number, Fill[]> {
  const fillsByStyleId = new Map<number, Fill[]>()
  for (const override of styleOverrideTable ?? []) {
    if (override.fillPaints && override.fillPaints.length > 0) {
      fillsByStyleId.set(override.styleID, convertFills(override.fillPaints))
    }
  }
  return fillsByStyleId
}

export function resolveVectorStyleOverrideFills(
  source: Pick<NodeChange, 'vectorData'>
): ReadonlyMap<number, Fill[]> {
  const vectorData = source.vectorData as { styleOverrideTable?: StyleOverride[] } | undefined
  return resolveStyleOverrideFills(vectorData?.styleOverrideTable)
}

export function resolveGeometryPaths(
  paths: KiwiPath[] | undefined,
  blobs: Uint8Array[],
  fillsByStyleId?: ReadonlyMap<number, Fill[]>
): GeometryPath[] {
  if (!paths || paths.length === 0) return []
  const result: GeometryPath[] = []
  for (const p of paths) {
    if (p.commandsBlob === undefined || p.commandsBlob < 0 || p.commandsBlob >= blobs.length)
      continue
    const blob = blobs[p.commandsBlob]
    if (blob.length === 0) continue
    const fills = p.styleID ? fillsByStyleId?.get(p.styleID) : undefined
    result.push({
      windingRule: (p.windingRule === 'EVENODD' ? 'EVENODD' : 'NONZERO') as WindingRule,
      commandsBlob: blob,
      fills: fills && fills.length > 0 ? copyFills(fills) : undefined
    })
  }
  return result
}
