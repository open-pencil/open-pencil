import type { SceneNode, VectorNetwork, VectorSegment, VectorVertex } from './scene-graph'

const CMD_CLOSE = 0
const CMD_MOVE_TO = 1
const CMD_LINE_TO = 2
const CMD_CUBIC_TO = 4

export function round(n: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}

export function geometryBlobToSVGPath(blob: Uint8Array): string {
  if (blob.length === 0) return ''
  const dv = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  let o = 0
  const parts: string[] = []

  while (o < blob.length) {
    const cmd = blob[o++]
    switch (cmd) {
      case CMD_CLOSE:
        parts.push('Z')
        break
      case CMD_MOVE_TO: {
        const x = round(dv.getFloat32(o, true))
        const y = round(dv.getFloat32(o + 4, true))
        o += 8
        parts.push(`M${x} ${y}`)
        break
      }
      case CMD_LINE_TO: {
        const x = round(dv.getFloat32(o, true))
        const y = round(dv.getFloat32(o + 4, true))
        o += 8
        parts.push(`L${x} ${y}`)
        break
      }
      case CMD_CUBIC_TO: {
        const x1 = round(dv.getFloat32(o, true))
        const y1 = round(dv.getFloat32(o + 4, true))
        const x2 = round(dv.getFloat32(o + 8, true))
        const y2 = round(dv.getFloat32(o + 12, true))
        const x = round(dv.getFloat32(o + 16, true))
        const y = round(dv.getFloat32(o + 20, true))
        o += 24
        parts.push(`C${x1} ${y1} ${x2} ${y2} ${x} ${y}`)
        break
      }
      default:
        return parts.join('')
    }
  }

  return parts.join('')
}

function segmentToSVG(seg: VectorSegment, vertices: VectorVertex[], forward: boolean): string {
  const start = forward ? vertices[seg.start] : vertices[seg.end]
  const end = forward ? vertices[seg.end] : vertices[seg.start]
  const ts = forward ? seg.tangentStart : { x: -seg.tangentEnd.x, y: -seg.tangentEnd.y }
  const te = forward ? seg.tangentEnd : { x: -seg.tangentStart.x, y: -seg.tangentStart.y }

  const isStraight =
    Math.abs(ts.x) < 0.001 &&
    Math.abs(ts.y) < 0.001 &&
    Math.abs(te.x) < 0.001 &&
    Math.abs(te.y) < 0.001

  if (isStraight) {
    return `L${round(end.x)} ${round(end.y)}`
  }

  const cp1x = round(start.x + ts.x)
  const cp1y = round(start.y + ts.y)
  const cp2x = round(end.x + te.x)
  const cp2y = round(end.y + te.y)
  return `C${cp1x} ${cp1y} ${cp2x} ${cp2y} ${round(end.x)} ${round(end.y)}`
}

export function vectorNetworkToSVGPaths(network: VectorNetwork): string[] {
  const { vertices, segments, regions } = network

  if (regions.length > 0) {
    return regions.map((region) => {
      const parts: string[] = []
      for (const loop of region.loops) {
        if (loop.length === 0) continue
        const firstSeg = segments[loop[0]]
        parts.push(`M${round(vertices[firstSeg.start].x)} ${round(vertices[firstSeg.start].y)}`)
        for (const segIdx of loop) {
          parts.push(segmentToSVG(segments[segIdx], vertices, true))
        }
        parts.push('Z')
      }
      return parts.join('')
    })
  }

  const parts: string[] = []
  for (const seg of segments) {
    parts.push(`M${round(vertices[seg.start].x)} ${round(vertices[seg.start].y)}`)
    parts.push(segmentToSVG(seg, vertices, true))
  }

  return parts.length > 0 ? [parts.join('')] : []
}

export function makePolygonPoints(node: SceneNode): string {
  const cx = node.width / 2
  const cy = node.height / 2
  const rx = node.width / 2
  const ry = node.height / 2
  const n = Math.max(3, node.pointCount)
  const isStar = node.type === 'STAR'
  const innerRatio = isStar ? node.starInnerRadius : 1
  const totalPoints = isStar ? n * 2 : n
  const angleOffset = -Math.PI / 2

  const points: string[] = []
  for (let i = 0; i < totalPoints; i++) {
    const angle = angleOffset + (2 * Math.PI * i) / totalPoints
    const isInner = isStar && i % 2 === 1
    const r = isInner ? innerRatio : 1
    points.push(`${round(cx + rx * r * Math.cos(angle))},${round(cy + ry * r * Math.sin(angle))}`)
  }
  return points.join(' ')
}

export function hasRadius(node: SceneNode): boolean {
  return (
    node.cornerRadius > 0 ||
    (node.independentCorners &&
      (node.topLeftRadius > 0 ||
        node.topRightRadius > 0 ||
        node.bottomRightRadius > 0 ||
        node.bottomLeftRadius > 0))
  )
}

export function roundedRectPath(node: SceneNode): string {
  const w = node.width
  const h = node.height
  let tl: number, tr: number, br: number, bl: number
  if (node.independentCorners) {
    tl = node.topLeftRadius
    tr = node.topRightRadius
    br = node.bottomRightRadius
    bl = node.bottomLeftRadius
  } else {
    tl = tr = br = bl = node.cornerRadius
  }

  tl = Math.min(tl, w / 2, h / 2)
  tr = Math.min(tr, w / 2, h / 2)
  br = Math.min(br, w / 2, h / 2)
  bl = Math.min(bl, w / 2, h / 2)

  return [
    `M${round(tl)} 0`,
    `L${round(w - tr)} 0`,
    tr > 0 ? `A${round(tr)} ${round(tr)} 0 0 1 ${round(w)} ${round(tr)}` : '',
    `L${round(w)} ${round(h - br)}`,
    br > 0 ? `A${round(br)} ${round(br)} 0 0 1 ${round(w - br)} ${round(h)}` : '',
    `L${round(bl)} ${round(h)}`,
    bl > 0 ? `A${round(bl)} ${round(bl)} 0 0 1 0 ${round(h - bl)}` : '',
    `L0 ${round(tl)}`,
    tl > 0 ? `A${round(tl)} ${round(tl)} 0 0 1 ${round(tl)} 0` : '',
    'Z'
  ]
    .filter(Boolean)
    .join('')
}

export function arcPath(node: SceneNode): string {
  if (!node.arcData) return ''
  const { startingAngle, endingAngle, innerRadius } = node.arcData
  const cx = node.width / 2
  const cy = node.height / 2
  const rx = node.width / 2
  const ry = node.height / 2

  const fullCircle = Math.abs(endingAngle - startingAngle) >= Math.PI * 2 - 0.001
  if (fullCircle && innerRadius <= 0) {
    return `M${round(cx - rx)} ${round(cy)}A${round(rx)} ${round(ry)} 0 1 1 ${round(cx + rx)} ${round(cy)}A${round(rx)} ${round(ry)} 0 1 1 ${round(cx - rx)} ${round(cy)}Z`
  }

  const x1 = round(cx + rx * Math.cos(startingAngle))
  const y1 = round(cy + ry * Math.sin(startingAngle))
  const x2 = round(cx + rx * Math.cos(endingAngle))
  const y2 = round(cy + ry * Math.sin(endingAngle))
  const largeArc = Math.abs(endingAngle - startingAngle) > Math.PI ? 1 : 0
  const sweep = endingAngle > startingAngle ? 1 : 0

  const parts = [`M${x1} ${y1}`, `A${round(rx)} ${round(ry)} 0 ${largeArc} ${sweep} ${x2} ${y2}`]

  if (innerRadius > 0) {
    const irx = rx * innerRadius
    const iry = ry * innerRadius
    const ix1 = round(cx + irx * Math.cos(endingAngle))
    const iy1 = round(cy + iry * Math.sin(endingAngle))
    const ix2 = round(cx + irx * Math.cos(startingAngle))
    const iy2 = round(cy + iry * Math.sin(startingAngle))
    parts.push(`L${ix1} ${iy1}`)
    parts.push(`A${round(irx)} ${round(iry)} 0 ${largeArc} ${sweep === 1 ? 0 : 1} ${ix2} ${iy2}`)
    parts.push('Z')
  } else {
    parts.push(`L${round(cx)} ${round(cy)}Z`)
  }

  return parts.join('')
}
