import type { SceneNode } from './types'

/** Whether a layer masks its siblings: a mask that is shown, since a hidden mask masks nothing. */
export function isVisibleMask(node: Pick<SceneNode, 'visible' | 'isMask'>): boolean {
  return node.visible && node.isMask
}

/**
 * A run of masks and the siblings they mask, as indices into the children: the masks are
 * `[start, maskedStart)` and what they mask `[maskedStart, end)`, which may be empty.
 */
export interface MaskRun {
  readonly start: number
  readonly maskedStart: number
  readonly end: number
}

/**
 * Where masks act among a container's children, bottom to top. A visible mask, with the visible
 * masks right after it, masks every sibling after them up to the next visible mask, which starts
 * a run of its own; a sibling that is hidden or a hidden mask is masked like any other (Figma
 * desktop, live). Children before the first mask are not in any run.
 */
export function maskRuns<T>(children: readonly T[], isMask: (child: T) => boolean): MaskRun[] {
  const runs: MaskRun[] = []
  let index = 0
  while (index < children.length) {
    if (!isMask(children[index])) {
      index++
      continue
    }
    const start = index
    while (index < children.length && isMask(children[index])) index++
    const maskedStart = index
    while (index < children.length && !isMask(children[index])) index++
    runs.push({ start, maskedStart, end: index })
  }
  return runs
}
