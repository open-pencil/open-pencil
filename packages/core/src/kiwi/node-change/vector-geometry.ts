import type { NodeChange } from '#core/kiwi/binary/codec'
import type { GeometryPath, VectorNetwork, WindingRule } from '#core/scene-graph'
import type { Vector } from '#core/types'
import { decodeVectorNetworkBlob } from '#core/vector'

export function resolveVectorNetwork(nc: NodeChange, blobs: Uint8Array[]): VectorNetwork | null {
  const vectorData = nc.vectorData as
    | {
        vectorNetworkBlob?: number
        normalizedSize?: Vector
        styleOverrideTable?: Array<{ styleID: number; handleMirroring?: string }>
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
}

export function resolveGeometryPaths(
  paths: KiwiPath[] | undefined,
  blobs: Uint8Array[]
): GeometryPath[] {
  if (!paths || paths.length === 0) return []
  const result: GeometryPath[] = []
  for (const p of paths) {
    if (p.commandsBlob === undefined || p.commandsBlob < 0 || p.commandsBlob >= blobs.length)
      continue
    const blob = blobs[p.commandsBlob]
    if (blob.length === 0) continue
    result.push({
      windingRule: (p.windingRule === 'EVENODD' ? 'EVENODD' : 'NONZERO') as WindingRule,
      commandsBlob: blob
    })
  }
  return result
}
