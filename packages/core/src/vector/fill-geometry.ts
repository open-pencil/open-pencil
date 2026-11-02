import type { GeometryPath, VectorNetwork } from '@open-pencil/scene-graph'

import { addLoopToPath, addOpenSegmentsToPath } from './path-helpers'
import type { PathSink } from './path-helpers'

const CMD_CLOSE = 0
const CMD_MOVE_TO = 1
const CMD_LINE_TO = 2
const CMD_CUBIC_TO = 4

/** PathSink that encodes commands into the .fig geometry commandsBlob format. */
class GeometryBlobBuilder implements PathSink {
  private cmds: { code: number; args: number[] }[] = []

  moveTo(x: number, y: number) {
    this.cmds.push({ code: CMD_MOVE_TO, args: [x, y] })
  }
  lineTo(x: number, y: number) {
    this.cmds.push({ code: CMD_LINE_TO, args: [x, y] })
  }
  cubicTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    this.cmds.push({ code: CMD_CUBIC_TO, args: [x1, y1, x2, y2, x3, y3] })
  }
  close() {
    this.cmds.push({ code: CMD_CLOSE, args: [] })
  }

  toBlob(): Uint8Array {
    const size = this.cmds.reduce((n, c) => n + 1 + c.args.length * 4, 0)
    const out = new Uint8Array(size)
    const view = new DataView(out.buffer)
    let o = 0
    for (const c of this.cmds) {
      out[o++] = c.code
      for (const v of c.args) {
        view.setFloat32(o, v, true)
        o += 4
      }
    }
    return out
  }
}

/**
 * Rebuild fillGeometry from a (possibly edited) VectorNetwork: one outline per region, in region
 * order, or one for the open chain of a network without regions. Paints stay on the regions.
 */
export function regenerateFillGeometry(
  network: VectorNetwork,
  existing: GeometryPath[]
): GeometryPath[] {
  if (existing.length === 0) return existing
  const { vertices, segments, regions } = network
  if (regions.length > 0) {
    return regions.map((region) => {
      const builder = new GeometryBlobBuilder()
      for (const loop of region.loops) addLoopToPath(builder, loop, segments, vertices)
      return { windingRule: region.windingRule, commandsBlob: builder.toBlob() }
    })
  }
  if (segments.length > 0) {
    const builder = new GeometryBlobBuilder()
    addOpenSegmentsToPath(builder, segments, vertices)
    const windingRule = existing.length === 1 ? existing[0].windingRule : 'NONZERO'
    return [{ windingRule, commandsBlob: builder.toBlob() }]
  }
  return []
}
