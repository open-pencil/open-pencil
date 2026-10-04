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

const ORDER_KEY_MIN = 33 // '!'
const ORDER_KEY_MAX = 126 // '~'
const ORDER_KEY_MID = 'O'

/**
 * A printable key strictly between `lo` and `hi` (either may be open), or null when none
 * exists. Splits at the first character where they differ when a character fits between;
 * otherwise keeps that character and recurses into the remainder, relying on string order.
 */
export function orderKeyBetween(lo: string | null, hi: string | null): string | null {
  if (lo !== null && hi !== null && lo >= hi) return null
  const low = lo ?? ''
  // An open upper bound shares no prefix, so the empty string ends the scan immediately.
  const high = hi ?? ''
  let i = 0
  while (i < low.length && i < high.length && low[i] === high[i]) i++
  const a = i < low.length ? low.charCodeAt(i) : ORDER_KEY_MIN - 1
  const b = hi !== null && i < hi.length ? hi.charCodeAt(i) : ORDER_KEY_MAX + 1
  if (b - a > 1) return low.slice(0, i) + String.fromCharCode(Math.floor((a + b) / 2))
  // Keep lo's character: anything above the rest of lo then sorts below hi.
  if (i < low.length) {
    return low.slice(0, i + 1) + (orderKeyBetween(low.slice(i + 1), null) ?? ORDER_KEY_MID)
  }
  // lo is a prefix of hi whose next character can't be lowered: keep it and go below the rest.
  const rest = hi?.slice(i + 1) ?? ''
  if (!hi || rest === '') return null
  return hi.slice(0, i + 1) + (orderKeyBetween(null, rest) ?? '')
}

/** Indices of the longest strictly increasing run of keys, so a moved layer re-keys alone. */
function increasingKeyIndices(sourceKeys: ReadonlyArray<string | null | undefined>): Set<number> {
  const tails: number[] = []
  const previous = new Map<number, number>()
  for (let index = 0; index < sourceKeys.length; index++) {
    const key = sourceKeys[index]
    if (!key) continue
    let low = 0
    let high = tails.length
    while (low < high) {
      const mid = (low + high) >> 1
      if ((sourceKeys[tails[mid]] ?? '') < key) low = mid + 1
      else high = mid
    }
    // A key with nothing below it cannot start the run once a sibling has to precede it.
    if (low === 0 && index > 0 && orderKeyBetween(null, key) === null) continue
    if (low > 0) previous.set(index, tails[low - 1])
    tails[low] = index
  }
  const kept = new Set<number>()
  for (let index = tails.at(-1); index !== undefined; index = previous.get(index)) kept.add(index)
  return kept
}

/**
 * Order keys for siblings in their current order. The longest increasing run of imported keys
 * is kept; other siblings get the index key when it fits between their neighbours, and
 * otherwise a key between them, so no two siblings share a key.
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

  const kept = increasingKeyIndices(sourceKeys)
  for (let index = 0; index < sourceKeys.length; index++) {
    const key = sourceKeys[index]
    const filled = key && kept.has(index) ? fill(key) : null
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
