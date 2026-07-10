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
 * Rebuild fillGeometry command blobs from a (possibly edited) VectorNetwork so
 * fills follow network edits. Imported .fig vectors pair fillGeometry entries
 * with network regions positionally (fillGeometry[i] ↔ regions[i]); per-entry
 * styleID/fills are preserved. Networks without regions (open chains) map to a
 * single fillGeometry entry.
 */
export function regenerateFillGeometry(
  network: VectorNetwork,
  existing: GeometryPath[]
): GeometryPath[] {
  if (existing.length === 0) return existing
  const { vertices, segments, regions } = network

  if (regions.length === existing.length) {
    return existing.map((g, i) => {
      const region = regions[i]
      const builder = new GeometryBlobBuilder()
      for (const loop of region.loops) addLoopToPath(builder, loop, segments, vertices)
      return { ...g, windingRule: region.windingRule, commandsBlob: builder.toBlob() }
    })
  }

  if (regions.length === 0 && existing.length === 1) {
    const builder = new GeometryBlobBuilder()
    addOpenSegmentsToPath(builder, segments, vertices)
    return [{ ...existing[0], commandsBlob: builder.toBlob() }]
  }

  // ponytail: region count no longer matches the imported fillGeometry (e.g. a
  // region was deleted mid-edit) — the mapping is unknown, keep the old blobs.
  // Upgrade path: re-derive region↔style pairing geometrically.
  return existing
}
