/**
 * Tree traversal shared by source records and occurrences. Both trees have the same one
 * rule that matters for addressing: a search may pass through ordinary containers but never
 * implicitly into an instance, whose contents belong to another owner's scope.
 */
export interface TreeShape<T> {
  childrenOf(node: T): readonly T[]
  isInstance(node: T): boolean
}

export interface BoundedMatch<T> {
  count: number
  /** The single match, when exactly one exists. */
  match?: T
  /** The root-level node whose subtree holds that match. */
  top?: T
}

/**
 * Find nodes below `roots` through ordinary containers, never past an instance boundary.
 * A matched node ends its branch: what lies inside it is addressed by a further segment.
 */
export function findWithinBoundary<T>(
  roots: readonly T[],
  shape: TreeShape<T>,
  matches: (node: T) => boolean
): BoundedMatch<T> {
  const found: { match: T; top: T }[] = []
  const visit = (node: T, top: T): void => {
    if (matches(node)) {
      found.push({ match: node, top })
      return
    }
    if (shape.isInstance(node)) return
    for (const child of shape.childrenOf(node)) visit(child, top)
  }
  for (const root of roots) visit(root, root)
  return found.length === 1 ? { count: 1, ...found[0] } : { count: found.length }
}

/** Every node below and including `root`, parents before children, in child order. */
export function* descendants<T>(root: T, childrenOf: (node: T) => readonly T[]): Generator<T> {
  yield root
  for (const child of childrenOf(root)) yield* descendants(child, childrenOf)
}
