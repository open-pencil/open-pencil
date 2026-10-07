import Fuse, { type FuseOptionKey } from 'fuse.js'

/**
 * How close a query must be, shared by every search in the editor: a typo is forgiven, and a
 * match counts wherever it falls in the text rather than only near the start.
 */
const FUZZY_OPTIONS = { threshold: 0.2, ignoreLocation: true } as const

/** The items that match `query`, best match first, for lists people pick from. */
export function fuzzySearch<T>(items: readonly T[], keys: FuseOptionKey<T>[], query: string): T[] {
  return new Fuse(items, { ...FUZZY_OPTIONS, keys }).search(query).map((result) => result.item)
}

/**
 * The items that match `query` in their own order, for lists people arrange, such as variables
 * grouped and reordered by hand. An empty query keeps every item.
 */
export function fuzzyFilter<T>(items: readonly T[], keys: FuseOptionKey<T>[], query: string): T[] {
  const term = query.trim()
  if (!term) return [...items]
  const matched = new Set(fuzzySearch(items, keys, term))
  return items.filter((item) => matched.has(item))
}
