import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { idOf, parentIdOf, type SourceIndex } from '../instance-overrides/source-index'
import { isComponentSetRecord } from '../node-change/convert'
import { componentDependencies, slotContentDependencies } from './component/dependencies'
import { createResourceResolver } from './resource-reference'
import { styleDependencies } from './style-dependencies'

export interface SceneDependencyClosure {
  /** Live page trees plus explicitly referenced component and slot content trees. */
  contentIds: ReadonlySet<string>
  /** Required ownership containers, without automatically including their siblings. */
  ancestorIds: ReadonlySet<string>
  /** Referenced records the archive lacks: broken hierarchy or style references. */
  missingIds: ReadonlySet<string>
  /** Components instances or defaults reference that Figma has since deleted. */
  missingComponentIds: ReadonlySet<string>
  /** Slot content frames instance assignments name that the archive does not contain. */
  missingSlotContentIds: ReadonlySet<string>
  externalPreferredKeys: ReadonlySet<string>
}

function validatePageSelection(
  sources: ReadonlyMap<string, NodeChange>,
  pageIds?: ReadonlySet<string>
): void {
  if (!pageIds) return
  for (const id of pageIds)
    if (sources.get(id)?.type !== 'CANVAS') throw new Error(`Unknown page ${id}`)
}

/** Ownership chains above content, stopping where an earlier chain already continues. */
function collectAncestors(
  sources: ReadonlyMap<string, NodeChange>,
  contentIds: ReadonlySet<string>,
  ancestorIds: Set<string>,
  missingIds: Set<string>
): void {
  for (const id of contentIds) {
    const visited = new Set<string>([id])
    let node = sources.get(id)
    let parent = node ? parentIdOf(node) : undefined
    while (parent !== undefined) {
      if (visited.has(parent)) throw new Error(`Cyclic source hierarchy at ${parent}`)
      visited.add(parent)
      if (ancestorIds.has(parent)) break
      ancestorIds.add(parent)
      node = sources.get(parent)
      if (!node) {
        missingIds.add(parent)
        break
      }
      parent = parentIdOf(node)
    }
  }
}

/** Plan reachability without deleting records or expanding unrelated internal siblings. */
export function collectSceneDependencies(
  changes: readonly NodeChange[],
  pageIds: ReadonlySet<string> | undefined,
  index: SourceIndex,
  /** The whole record for one of `changes`, when they are headers that leave fields out. */
  whole: (record: NodeChange) => NodeChange = (record) => record
): SceneDependencyClosure {
  const resolveReference = createResourceResolver(changes)
  const { sources, children } = index
  const availableIds = new Set(sources.keys())
  const contentIds = new Set<string>()
  const ancestorIds = new Set<string>()
  const externalPreferredKeys = new Set<string>()
  const missingIds = new Set<string>()
  const missingComponentIds = new Set<string>()
  const componentReferences = new Set<string>()
  const slotContentReferences = new Set<string>()
  const missingSlotContentIds = new Set<string>()
  validatePageSelection(sources, pageIds)
  // The other variants of a variant's set: switching an instance's variant, in the panel or in
  // preview, needs the whole set, while the set's page, whose other layers examples of it use,
  // does not come with it. A set on Figma's internal canvas is a copy of a library's, kept for
  // the variants the file uses, so it stays as the file uses it. Each parent is looked at once;
  // record headers leave out what marks a set, so its whole record is read then.
  const lookedAt = new Set<string>()
  const onInternalCanvas = (record: NodeChange): boolean => {
    let current: NodeChange | undefined = record
    const seen = new Set<string>()
    while (current && current.type !== 'CANVAS') {
      const parentId = parentIdOf(current)
      if (parentId === undefined || seen.has(parentId)) return false
      seen.add(parentId)
      current = sources.get(parentId)
    }
    return current?.internalOnly === true
  }
  const setVariants = (node: NodeChange): string[] => {
    const parentId = node.type === 'SYMBOL' ? parentIdOf(node) : undefined
    if (parentId === undefined || lookedAt.has(parentId)) return []
    lookedAt.add(parentId)
    const parent = sources.get(parentId)
    if (!parent || onInternalCanvas(parent) || !isComponentSetRecord(whole(parent))) return []
    return (children.get(parentId) ?? []).flatMap((sibling) =>
      sibling.type === 'SYMBOL' ? (idOf(sibling) ?? []) : []
    )
  }
  const pending = changes
    .filter(
      (node) =>
        node.type === 'CANVAS' &&
        (pageIds ? pageIds.has(idOf(node) ?? '') : node.internalOnly !== true)
    )
    .flatMap((node) => idOf(node) ?? [])
  while (pending.length) {
    const id = pending.pop()
    if (!id || contentIds.has(id)) continue
    const node = sources.get(id)
    if (!node) {
      if (componentReferences.has(id)) missingComponentIds.add(id)
      else if (slotContentReferences.has(id)) missingSlotContentIds.add(id)
      else missingIds.add(id)
      continue
    }
    contentIds.add(id)
    const record = whole(node)
    const components = componentDependencies(record, resolveReference, (key) =>
      externalPreferredKeys.add(key)
    )
    for (const component of components) componentReferences.add(component)
    const slotContent = slotContentDependencies(record)
    for (const content of slotContent) slotContentReferences.add(content)
    pending.push(
      ...(children.get(id) ?? []).flatMap((child) => idOf(child) ?? []),
      ...setVariants(node),
      ...styleDependencies(record, resolveReference, availableIds),
      ...components,
      ...slotContent
    )
  }
  collectAncestors(sources, contentIds, ancestorIds, missingIds)
  return {
    contentIds,
    ancestorIds,
    missingIds,
    missingComponentIds,
    missingSlotContentIds,
    externalPreferredKeys
  }
}
