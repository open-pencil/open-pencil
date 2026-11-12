/**
 * Helpers for lists of any length. Spreading an array into a call's arguments, as in
 * `push(...items)` or `Math.max(...values)`, throws once it holds more than about 120,000 items in
 * Chrome; these take any number (`@open-pencil/data/no-spread-arguments`).
 */

/** Appends every item of `items` to `target`, in order. */
export function appendAll<T>(target: T[], items: Iterable<T>): void {
  for (const item of items) target.push(item)
}

/** Inserts every item of `items` into `target` before `index`, in order, as `splice` would. */
export function insertAll<T>(target: T[], index: number, items: Iterable<T>): void {
  const tail = target.splice(index)
  appendAll(target, items)
  appendAll(target, tail)
}

/** The largest of `values`, or `-Infinity` when there are none, as `Math.max` gives. */
export function maxOf(values: Iterable<number>): number {
  let largest = -Infinity
  for (const value of values) {
    if (Number.isNaN(value)) return Number.NaN
    if (value > largest) largest = value
  }
  return largest
}

/** The smallest of `values`, or `Infinity` when there are none, as `Math.min` gives. */
export function minOf(values: Iterable<number>): number {
  let smallest = Infinity
  for (const value of values) {
    if (Number.isNaN(value)) return Number.NaN
    if (value < smallest) smallest = value
  }
  return smallest
}
