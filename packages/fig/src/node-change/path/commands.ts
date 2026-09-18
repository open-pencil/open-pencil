import { transformGeometryBlob } from '@open-pencil/scene-graph/copy'
export interface OutlineCommand {
  type: string
  x?: number
  y?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
}

const CMD_CLOSE = 0
const CMD_MOVE_TO = 1
const CMD_LINE_TO = 2
const CMD_CUBIC_TO = 4

function commandByteLength(type: string): number {
  switch (type) {
    case 'M':
    case 'L':
      return 1 + 2 * Float32Array.BYTES_PER_ELEMENT
    case 'C':
    case 'Q':
      return 1 + 6 * Float32Array.BYTES_PER_ELEMENT
    case 'Z':
      return 1
    default:
      return 0
  }
}

export function encodePathCommandsBlob(commands: OutlineCommand[], scale = 1): Uint8Array {
  const byteLength = commands.reduce(
    (length, command) => length + commandByteLength(command.type),
    0
  )
  const bytes = new Uint8Array(byteLength)
  const view = new DataView(bytes.buffer)
  let offset = 0
  const pushFloat = (value: number | undefined) => {
    view.setFloat32(offset, (value ?? 0) / scale, true)
    offset += Float32Array.BYTES_PER_ELEMENT
  }
  const negY = (v: number | undefined) => (v === undefined ? undefined : -v)

  let curX = 0
  let curY = 0

  for (const command of commands) {
    switch (command.type) {
      case 'M':
        bytes[offset++] = CMD_MOVE_TO
        pushFloat(command.x)
        pushFloat(negY(command.y))
        curX = command.x ?? 0
        curY = command.y ?? 0
        break
      case 'L':
        bytes[offset++] = CMD_LINE_TO
        pushFloat(command.x)
        pushFloat(negY(command.y))
        curX = command.x ?? 0
        curY = command.y ?? 0
        break
      case 'C':
        bytes[offset++] = CMD_CUBIC_TO
        pushFloat(command.x1)
        pushFloat(negY(command.y1))
        pushFloat(command.x2)
        pushFloat(negY(command.y2))
        pushFloat(command.x)
        pushFloat(negY(command.y))
        curX = command.x ?? 0
        curY = command.y ?? 0
        break
      case 'Q': {
        const qx1 = command.x1 ?? 0
        const qy1 = command.y1 ?? 0
        const qx = command.x ?? 0
        const qy = command.y ?? 0
        bytes[offset++] = CMD_CUBIC_TO
        pushFloat(curX + (2 / 3) * (qx1 - curX))
        pushFloat(negY(curY + (2 / 3) * (qy1 - curY)))
        pushFloat(qx + (2 / 3) * (qx1 - qx))
        pushFloat(negY(qy + (2 / 3) * (qy1 - qy)))
        pushFloat(qx)
        pushFloat(negY(qy))
        curX = qx
        curY = qy
        break
      }
      case 'Z':
        bytes[offset++] = CMD_CLOSE
        break
    }
  }

  return bytes
}

/**
 * Bake accumulated resize scale into a glyph blob (font units). The Kiwi
 * Glyph schema has no scaleX/scaleY, so exporting them any other way loses
 * the scale on reload — positions and strokeGeometry persist scaled while
 * glyph shapes revert, garbling path text (DomeSticker save/reopen bug).
 * Paint order is T·S·R(-theta)·F (see drawDerivedText); rewriting points as
 * p' = F^-1·R(theta)·S·R(-theta)·F·p lets the same world transform hold without S.
 */
export function bakeGlyphScale(
  blob: Uint8Array,
  scaleX: number,
  scaleY: number,
  rotation: number
): Uint8Array {
  if (scaleX === 1 && scaleY === 1) return blob
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const m00 = scaleX * cos * cos + scaleY * sin * sin
  const m01 = (scaleY - scaleX) * sin * cos
  const m11 = scaleX * sin * sin + scaleY * cos * cos
  return transformGeometryBlob(blob, m00, m01, m01, m11)
}
