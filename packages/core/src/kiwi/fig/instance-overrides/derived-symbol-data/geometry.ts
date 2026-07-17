import type { SceneNode } from '@open-pencil/scene-graph'
import { scaleGeometryPaths } from '@open-pencil/scene-graph/copy'

import type { DerivedSymbolOverride } from '#core/kiwi/fig/instance-overrides/types'
import { resolveGeometryPaths } from '#core/kiwi/fig/node-change/convert'

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
    result.fillGeometry = scaleGeometryPaths(
      target.fillGeometry,
      d.size.x / target.width,
      d.size.y / target.height
    )
  }

  if (sg.length > 0) result.strokeGeometry = sg
  else if (d.size && target.strokeGeometry.length > 0 && target.width > 0 && target.height > 0) {
    result.strokeGeometry = scaleGeometryPaths(
      target.strokeGeometry,
      d.size.x / target.width,
      d.size.y / target.height
    )
  }

  return result
}
