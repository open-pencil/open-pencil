import type { GUID, NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import { isUnsupportedFigFragmentType } from '../node-classification'
import { materializeDocument, type DocumentAssemblyOptions } from './materialize'

export interface FragmentOptions {
  /** Only empty instances with no saved claims may lose an unavailable component. */
  missingComponent?: 'error' | 'detach-empty'
}

export interface FragmentMaterializationOptions extends FragmentOptions {
  images?: DocumentAssemblyOptions['images']
}

/** Interpret a partial document in isolation; retain internal resources separately from pasted roots. */
export function materializeFigFragment(
  source: readonly NodeChange[],
  blobs: Uint8Array[] = [],
  options: FragmentMaterializationOptions = {}
) {
  const changes = normalizeFigFragment(source, options)
  const result = materializeDocument(changes, blobs, {
    derivedBounds: true,
    images: options.images
  })
  const rootIds: string[] = []
  const dependencyPageIds: string[] = []
  for (const page of changes) {
    if (page.type !== 'CANVAS' || !page.guid) continue
    const id = result.sources.get(guidToString(page.guid))
    if (!id) continue
    if (page.internalOnly) dependencyPageIds.push(id)
    else rootIds.push(...result.graph.getChildren(id).map((node) => node.id))
  }
  return { ...result, rootIds, dependencyPageIds }
}

function indexFragment(changes: readonly NodeChange[]) {
  const ids = new Set<string>()
  const reserved = new Set<string>()
  const children = new Set<string>()
  for (const node of changes) {
    if (!node.guid) throw new Error('Clipboard fragment node has no GUID')
    const id = guidToString(node.guid)
    if (ids.has(id)) throw new Error(`Duplicate fragment source ${id}`)
    ids.add(id)
    reserved.add(id)
    if (node.parentIndex) {
      const parent = guidToString(node.parentIndex.guid)
      reserved.add(parent)
      children.add(parent)
    }
    if (node.symbolData?.symbolID) reserved.add(guidToString(node.symbolData.symbolID))
  }
  let localID = 0
  const allocate = (): GUID => {
    while (reserved.has(`0:${localID}`)) localID++
    const guid = { sessionID: 0, localID: localID++ }
    reserved.add(guidToString(guid))
    return guid
  }
  return { ids, children, allocate }
}

function normalizeMissingComponent(
  node: NodeChange,
  ids: Set<string>,
  children: Set<string>,
  options: FragmentOptions
): void {
  if (
    node.type !== 'INSTANCE' ||
    !node.symbolData ||
    ids.has(guidToString(node.symbolData.symbolID))
  )
    return
  const hasClaims =
    Object.keys(node.symbolData).some((key) => key !== 'symbolID') ||
    node.componentPropAssignments !== undefined ||
    node.derivedSymbolData
  if (
    options.missingComponent !== 'detach-empty' ||
    !node.guid ||
    children.has(guidToString(node.guid)) ||
    hasClaims
  ) {
    throw new Error(`Missing fragment component ${guidToString(node.symbolData.symbolID)}`)
  }
  node.type = 'FRAME'
  Reflect.deleteProperty(node, 'symbolData')
}

/** Normalize fragment containers only; semantics remain the document reader's responsibility. */
export function normalizeFigFragment(
  source: readonly NodeChange[],
  options: FragmentOptions = {}
): NodeChange[] {
  const changes = source
    .filter((node) => !isUnsupportedFigFragmentType(node.type))
    .map((node) => structuredClone(node))
  const { ids, children, allocate } = indexFragment(changes)
  const documents = changes.filter((node) => node.type === 'DOCUMENT')
  if (documents.length > 1) throw new Error('Multiple fragment documents')
  const documentGuid = documents[0]?.guid ?? allocate()
  if (!documents.length) changes.unshift({ type: 'DOCUMENT', guid: documentGuid })
  let fragmentPage: GUID | undefined
  for (const node of changes) {
    if (node.type === 'DOCUMENT') continue
    const parent = node.parentIndex?.guid
    if (node.type === 'CANVAS') {
      node.parentIndex = { guid: documentGuid, position: node.parentIndex?.position ?? '!' }
    } else if (
      !parent ||
      !ids.has(guidToString(parent)) ||
      guidToString(parent) === guidToString(documentGuid)
    ) {
      fragmentPage ??= allocate()
      node.parentIndex = { guid: fragmentPage, position: node.parentIndex?.position ?? '!' }
    }
    normalizeMissingComponent(node, ids, children, options)
  }
  if (fragmentPage)
    changes.push({
      type: 'CANVAS',
      guid: fragmentPage,
      name: 'Clipboard',
      parentIndex: { guid: documentGuid, position: '!' }
    })
  return changes
}
