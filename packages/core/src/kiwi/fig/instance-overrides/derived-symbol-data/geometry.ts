import type { DerivedSymbolOverride } from '#core/kiwi/fig/instance-overrides/types'
import { resolveGeometryPaths } from '#core/kiwi/fig/node-change/convert'
import type { GeometryPath, SceneNode } from '#core/scene-graph'

function scaleGeometryBlobs(geom: GeometryPath[], sx: number, sy: number): GeometryPath[] {
  if (sx === 1 && sy === 1) return geom
  return geom.map((g) => {
    const scaled = g.commandsBlob.slice()
    const dv = new DataView(scaled.buffer, scaled.byteOffset, scaled.byteLength)
    let o = 0
    while (o < scaled.length) {
      const cmd = scaled[o++]
      if (cmd === 0) continue
      let coords = -1
      if (cmd === 1 || cmd === 2) coords = 1
      else if (cmd === 4) coords = 3
      if (coords < 0) break
      for (let i = 0; i < coords; i++) {
        dv.setFloat32(o, dv.getFloat32(o, true) * sx, true)
        dv.setFloat32(o + 4, dv.getFloat32(o + 4, true) * sy, true)
        o += 8
      }
    }
    return { windingRule: g.windingRule, commandsBlob: scaled }
  })
}

export function resolveDsdGeometry(
  d: DerivedSymbolOverride,
  target: SceneNode,
  blobs: Uint8Array[]
): Pick<Partial<SceneNode>, 'fillGeometry' | 'strokeGeometry'> {
  const result: Pick<Partial<SceneNode>, 'fillGeometry' | 'strokeGeometry'> = {}
  const fg = resolveGeometryPaths(d.fillGeometry, blobs)
  const sg = resolveGeometryPaths(d.strokeGeometry, blobs)

  if (fg.length > 0) result.fillGeometry = fg
  else if (d.size && target.fillGeometry.length > 0 && target.width > 0 && target.height > 0) {
    result.fillGeometry = scaleGeometryBlobs(
      target.fillGeometry,
      d.size.x / target.width,
      d.size.y / target.height
    )
  }

  if (sg.length > 0) result.strokeGeometry = sg
  else if (d.size && target.strokeGeometry.length > 0 && target.width > 0 && target.height > 0) {
    result.strokeGeometry = scaleGeometryBlobs(
      target.strokeGeometry,
      d.size.x / target.width,
      d.size.y / target.height
    )
  }

  return result
}
