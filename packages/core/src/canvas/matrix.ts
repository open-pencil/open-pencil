import type { Vector } from '@open-pencil/core'

export type Mat3 = number[]

const identity = (): Mat3 => [1, 0, 0, 0, 1, 0, 0, 0, 1]

const multiply2 = (m1: Mat3, m2: Mat3): Mat3 => {
  // row-major general 3x3 multiply: out = m1 * m2
  return [
    m1[0] * m2[0] + m1[1] * m2[3] + m1[2] * m2[6],
    m1[0] * m2[1] + m1[1] * m2[4] + m1[2] * m2[7],
    m1[0] * m2[2] + m1[1] * m2[5] + m1[2] * m2[8],

    m1[3] * m2[0] + m1[4] * m2[3] + m1[5] * m2[6],
    m1[3] * m2[1] + m1[4] * m2[4] + m1[5] * m2[7],
    m1[3] * m2[2] + m1[4] * m2[5] + m1[5] * m2[8],

    m1[6] * m2[0] + m1[7] * m2[3] + m1[8] * m2[6],
    m1[6] * m2[1] + m1[7] * m2[4] + m1[8] * m2[7],
    m1[6] * m2[2] + m1[7] * m2[5] + m1[8] * m2[8]
  ]
}

const multiply = (...ms: Mat3[]): Mat3 => {
  if (ms.length === 0) return identity()
  let out = ms[0].slice() as Mat3
  for (let i = 1; i < ms.length; i++) out = multiply2(out, ms[i])
  return out
}

const translated = (dx: number, dy: number): Mat3 => [1, 0, dx, 0, 1, dy, 0, 0, 1]

const rotated = (radians: number, px = 0, py = 0): Mat3 => {
  const s = Math.sin(radians)
  const c = Math.cos(radians)
  // exactly like ck.Matrix.rotated
  return [
    c,
    -s,
    s * py + (1 - c) * px,

    s,
    c,
    -s * px + (1 - c) * py,

    0,
    0,
    1
  ]
}

const scaled = (sx: number, sy: number, px = 0, py = 0): Mat3 => {
  // match ck.Matrix.scaled
  return [
    sx,
    0,
    px - sx * px,

    0,
    sy,
    py - sy * py,

    0,
    0,
    1
  ]
}

const invert = (m: Mat3): Mat3 | null => {
  // match ck.Matrix.invert (Sarrus)
  const det =
    m[0] * m[4] * m[8] +
    m[1] * m[5] * m[6] +
    m[2] * m[3] * m[7] -
    m[2] * m[4] * m[6] -
    m[1] * m[3] * m[8] -
    m[0] * m[5] * m[7]
  if (!det) return null

  return [
    (m[4] * m[8] - m[5] * m[7]) / det,
    (m[2] * m[7] - m[1] * m[8]) / det,
    (m[1] * m[5] - m[2] * m[4]) / det,

    (m[5] * m[6] - m[3] * m[8]) / det,
    (m[0] * m[8] - m[2] * m[6]) / det,
    (m[2] * m[3] - m[0] * m[5]) / det,

    (m[3] * m[7] - m[4] * m[6]) / det,
    (m[1] * m[6] - m[0] * m[7]) / det,
    (m[0] * m[4] - m[1] * m[3]) / det
  ]
}

const mapPoints = (matrix: Mat3, ptArr: number[]): number[] => {
  if (ptArr.length % 2) throw new Error('mapPoints requires even length [x,y,...].')
  const out = ptArr.slice()
  for (let i = 0; i < out.length; i += 2) {
    const x = out[i]
    const y = out[i + 1]
    const denom = matrix[6] * x + matrix[7] * y + matrix[8]
    const xTrans = matrix[0] * x + matrix[1] * y + matrix[2]
    const yTrans = matrix[3] * x + matrix[4] * y + matrix[5]
    out[i] = xTrans / denom
    out[i + 1] = yTrans / denom
  }
  return out
}

const mapPoint = (m: Mat3, p: Vector): Vector => {
  const arr = mapPoints(m, [p.x, p.y])
  return { x: arr[0], y: arr[1] }
}

const Matrix = { identity, multiply, translated, rotated, scaled, invert, mapPoints, mapPoint }
export default Matrix
