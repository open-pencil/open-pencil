import type { DrawIOGeometry } from '@open-pencil/drawio'
import type { SceneNode } from '@open-pencil/scene-graph'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'

/** A cell with no box or points, for the fields a cell leaves unset. */
export const EMPTY_GEOMETRY: DrawIOGeometry = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  relative: false,
  points: [],
  sourcePoint: null,
  targetPoint: null,
  offset: null
}

/** A length to the hundredth, as draw.io writes them. */
export function round(value: number): number {
  return Math.round(value * 100) / 100
}

function box(node: SceneNode): DrawIOGeometry {
  return {
    ...EMPTY_GEOMETRY,
    x: round(node.x),
    y: round(node.y),
    width: round(node.width),
    height: round(node.height)
  }
}

/** Where a layer sits, how far it turns about its centre, and how it is mirrored, as draw.io says. */
export interface Placed {
  geometry: DrawIOGeometry
  rotation: number
  flipH: boolean
  flipV: boolean
}

/** An angle in degrees between -180 and 180. */
function normalAngle(degrees: number): number {
  return ((((degrees + 180) % 360) + 360) % 360) - 180
}

/**
 * A layer drawn by `world`, its matrix on the page, as a draw.io cell whose parent's box starts at
 * `origin` on the page. draw.io mirrors a cell about its centre and then turns it, negating the
 * turn when it mirrors one way only, and turns or mirrors no cell inside another with it, so
 * each cell carries the whole of its own matrix. Either way a cell is mirrored, what its down
 * axis points to gives the turn.
 */
export function placed(node: SceneNode, world: Mat3, origin: Vector): Placed {
  const centre = Matrix.mapPoint(world, { x: node.width / 2, y: node.height / 2 })
  const [a, b, , c, d] = world
  const geometry = {
    ...box(node),
    x: round(centre.x - node.width / 2 - origin.x),
    y: round(centre.y - node.height / 2 - origin.y)
  }
  const turn = (Math.atan2(-b, d) * 180) / Math.PI
  if (a * d - b * c < 0) {
    // A layer mirrored up and down by itself stays so; any other mirror goes left to right.
    const flipV = node.flipY && !node.flipX
    const rotation = flipV ? (Math.atan2(b, -d) * 180) / Math.PI : turn
    return { geometry, rotation: normalAngle(rotation), flipH: !flipV, flipV }
  }
  // Mirrored both ways is a half turn, which a layer flipped both ways keeps as flips.
  if (node.flipX && node.flipY) {
    return { geometry, rotation: normalAngle(turn - 180), flipH: true, flipV: true }
  }
  return { geometry, rotation: normalAngle(turn), flipH: false, flipV: false }
}

/** A placed cell's turn and mirrors as style pairs, which an unturned, unmirrored cell leaves out. */
export function placedValues({
  rotation,
  flipH,
  flipV
}: Placed): Record<string, string | undefined> {
  return {
    rotation: Math.abs(rotation) < 1e-6 ? undefined : String(round(rotation)),
    flipH: flipH ? '1' : undefined,
    flipV: flipV ? '1' : undefined
  }
}
