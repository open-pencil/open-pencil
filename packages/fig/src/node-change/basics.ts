import type { SceneNode } from '@open-pencil/scene-graph'
import type { Matrix } from '@open-pencil/scene-graph/primitives'

export function mapToFigmaType(type: SceneNode['type']): string {
  switch (type) {
    case 'FRAME':
      return 'FRAME'
    case 'RECTANGLE':
      return 'RECTANGLE'
    case 'ROUNDED_RECTANGLE':
      return 'ROUNDED_RECTANGLE'
    case 'ELLIPSE':
      return 'ELLIPSE'
    case 'TEXT':
      return 'TEXT'
    case 'LINE':
      return 'LINE'
    case 'STAR':
      return 'STAR'
    case 'POLYGON':
      return 'REGULAR_POLYGON'
    case 'VECTOR':
      return 'VECTOR'
    case 'BOOLEAN_OPERATION':
      return 'BOOLEAN_OPERATION'
    case 'GROUP':
      return 'FRAME'
    case 'SECTION':
      return 'SECTION'
    case 'COMPONENT':
      return 'SYMBOL'
    case 'COMPONENT_SET':
      return 'FRAME'
    case 'INSTANCE':
      return 'INSTANCE'
    case 'CONNECTOR':
      return 'CONNECTOR'
    case 'SHAPE_WITH_TEXT':
      return 'SHAPE_WITH_TEXT'
    default:
      return 'RECTANGLE'
  }
}

/** Generate a printable, lexicographically ordered parent position. */
export function fractionalPosition(index: number): string {
  const BASE = 94
  const FIRST = 33
  const TILDE = 126
  const numTildes = Math.floor(index / BASE)
  const lastChar = String.fromCharCode(FIRST + (index % BASE))
  return String.fromCharCode(TILDE).repeat(numTildes) + lastChar
}

const ORDER_KEY_MIN = 33
const ORDER_KEY_MAX = 126

/**
 * A printable key strictly between `lo` and `hi` (either may be open), or null when none
 * exists because `hi` is already the smallest key after `lo`.
 */
export function orderKeyBetween(lo: string | null, hi: string | null): string | null {
  const low = lo ?? ''
  let high = hi
  let key = ''
  for (let i = 0; ; i++) {
    const a = i < low.length ? low.charCodeAt(i) : ORDER_KEY_MIN - 1
    const b = high !== null && i < high.length ? high.charCodeAt(i) : ORDER_KEY_MAX + 1
    if (a === b) {
      key += String.fromCharCode(a)
      continue
    }
    if (b - a > 1) return key + String.fromCharCode(Math.floor((a + b) / 2))
    if (a < ORDER_KEY_MIN) return null
    // Keep `a` here; every later character is then below `high`.
    key += String.fromCharCode(a)
    high = null
  }
}

/**
 * Order keys for siblings in their current order. Imported keys are kept while they still
 * increase; siblings without a usable key get the index key when it fits between its
 * neighbours, and otherwise a key between them, so no two siblings share a key.
 */
export function siblingOrderKeys(sourceKeys: ReadonlyArray<string | null | undefined>): string[] {
  const keys: string[] = []
  let prev: string | null = null
  let pending: number[] = []

  const fill = (upper: string | null): string[] | null => {
    const filled: string[] = []
    let lo = prev
    for (const index of pending) {
      const candidate = fractionalPosition(index)
      const key =
        (lo === null || candidate > lo) && (upper === null || candidate < upper)
          ? candidate
          : orderKeyBetween(lo, upper)
      if (key === null) return null
      filled.push(key)
      lo = key
    }
    return filled
  }

  for (let index = 0; index < sourceKeys.length; index++) {
    const key = sourceKeys[index]
    const filled = key && (prev === null || key > prev) ? fill(key) : null
    if (key && filled) {
      pending.forEach((pendingIndex, i) => (keys[pendingIndex] = filled[i]))
      keys[index] = key
      prev = key
      pending = []
    } else {
      pending.push(index)
    }
  }
  const rest = fill(null) ?? []
  pending.forEach((pendingIndex, i) => (keys[pendingIndex] = rest[i]))
  return keys
}

export function computeExportTransform(node: SceneNode): Matrix {
  const sx = node.flipX ? -1 : 1
  const cos = Math.cos((node.rotation * Math.PI) / 180)
  const sin = Math.sin((node.rotation * Math.PI) / 180)

  const m00 = cos * sx
  const m01 = -sin * sx
  const m10 = sin
  const m11 = cos
  const centerX = node.width / 2
  const centerY = node.height / 2

  return {
    m00,
    m01,
    m02: node.x + centerX - m00 * centerX - m01 * centerY,
    m10,
    m11,
    m12: node.y + centerY - m10 * centerX - m11 * centerY
  }
}
