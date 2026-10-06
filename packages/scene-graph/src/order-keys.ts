/**
 * Fractional order keys: printable-ASCII strings (`!` to `~`) that order siblings by plain string
 * comparison, as Figma writes `parentIndex.position`. A new key fits between two neighbours
 * without renumbering the others.
 */

const ORDER_KEY_MIN = 33 // '!'
const ORDER_KEY_MAX = 126 // '~'
const ORDER_KEY_MID = 'O'
const INDEX_KEY_BASE = ORDER_KEY_MAX - ORDER_KEY_MIN + 1

/** The order key for position `index` of a freshly numbered sibling list. */
export function fractionalPosition(index: number): string {
  const numTildes = Math.floor(index / INDEX_KEY_BASE)
  const lastChar = String.fromCharCode(ORDER_KEY_MIN + (index % INDEX_KEY_BASE))
  return String.fromCharCode(ORDER_KEY_MAX).repeat(numTildes) + lastChar
}

/**
 * The shortest key strictly between `lo` and `hi` (either may be open), or null when the
 * printable alphabet has none. Splits at the first character where they differ when a character
 * fits between; otherwise keeps that character and recurses into the remainder.
 */
function keyBetween(lo: string | null, hi: string | null): string | null {
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
    return low.slice(0, i + 1) + (keyBetween(low.slice(i + 1), null) ?? ORDER_KEY_MID)
  }
  // lo is a prefix of hi whose next character can't be lowered: keep it and go below the rest.
  const rest = hi?.slice(i + 1) ?? ''
  if (!hi || rest === '') return null
  return hi.slice(0, i + 1) + (keyBetween(null, rest) ?? '')
}

/** A key above `lo` that has room for `suffix` while staying below `hi`, or null. */
function keyWithSuffix(lo: string | null, hi: string, suffix: string): string | null {
  // A key that is a prefix of hi leaves no room after it; go one level deeper until it is not.
  for (let key = keyBetween(lo, hi); key !== null; key = keyBetween(key, hi)) {
    if (key + suffix < hi) return key + suffix
    if (!hi.startsWith(key)) return null
  }
  return null
}

/**
 * A key above `lo` and below `hi`; either bound may be open.
 *
 * `suffix`, a few random printable characters, is appended where it fits, so two peers that
 * insert at the same spot at once get distinct keys with room between them. The key stays short:
 * it grows by about one character for every five keys inserted into the same gap.
 *
 * Every pair of bounds gets a key. When no printable key sorts between them, because `lo` is not
 * below `hi` or `hi` is `lo` followed only by `!`, the result is the key `orderKeyBetween(lo, null)`
 * gives, which is above `lo` but not below `hi`, and the caller must re-key `hi`.
 */
export function orderKeyBetween(lo: string | null, hi: string | null, suffix = ''): string {
  const key = keyBetween(lo, hi)
  if (key === null) return (keyBetween(lo, null) ?? ORDER_KEY_MID) + suffix
  if (!suffix) return key
  if (hi === null) return key + suffix
  return keyWithSuffix(lo, hi, suffix) ?? key
}

/** Whether some printable key sorts strictly between `lo` and `hi`. */
export function hasOrderKeyBetween(lo: string | null, hi: string | null): boolean {
  return keyBetween(lo, hi) !== null
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
    if (low === 0 && index > 0 && !hasOrderKeyBetween(null, key)) continue
    if (low > 0) previous.set(index, tails[low - 1])
    tails[low] = index
  }
  const kept = new Set<number>()
  for (let index = tails.at(-1); index !== undefined; index = previous.get(index)) kept.add(index)
  return kept
}

export interface SiblingOrderKeyOptions {
  /**
   * Returns a suffix for each key the function makes up, as `orderKeyBetween` takes. Without it,
   * a sibling that needs a key gets its index key when that fits between its neighbours.
   */
  suffix?: () => string
}

/**
 * Order keys for siblings in their current order. The longest increasing run of existing keys
 * is kept; other siblings get the index key when it fits between their neighbours (or a key with
 * a suffix, when `options.suffix` is given), and otherwise a key between them, so no two siblings
 * share a key.
 */
export function siblingOrderKeys(
  sourceKeys: ReadonlyArray<string | null | undefined>,
  options: SiblingOrderKeyOptions = {}
): string[] {
  const keys: string[] = []
  let prev: string | null = null
  let pending: number[] = []

  const nextKey = (index: number, lo: string | null, upper: string | null): string | null => {
    if (options.suffix) {
      const key = orderKeyBetween(lo, upper, options.suffix())
      return upper === null || key < upper ? key : null
    }
    const candidate = fractionalPosition(index)
    if ((lo === null || candidate > lo) && (upper === null || candidate < upper)) return candidate
    return keyBetween(lo, upper)
  }

  const fill = (upper: string | null): string[] | null => {
    const filled: string[] = []
    let lo = prev
    for (const index of pending) {
      const key = nextKey(index, lo, upper)
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
