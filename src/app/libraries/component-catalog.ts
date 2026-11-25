import { isLibraryComponentAsset } from '@open-pencil/core/library'
import type {
  ComponentCatalog,
  ComponentCatalogInsertInput,
  ComponentCatalogLibraryAsset
} from '@open-pencil/core/tools'
import { appendAll } from '@open-pencil/std/arrays'

import type { EditorStore } from '@/app/editor/session'
import { readLibraryPriority } from '@/app/libraries/preferences'
import type { LibraryService } from '@/app/libraries/service'

export type EnabledLibraryAsset = ComponentCatalogLibraryAsset

/** The `ComponentCatalog` of `store`'s document: every method reads that store, never an "active editor". */
export function componentCatalogForEditor(
  service: LibraryService,
  store: EditorStore
): ComponentCatalog {
  return {
    listLibraries: () => service.listLibraries(),
    listComponents: (input) => listComponents(service, store, input),
    insertComponent: (input) => insertComponent(service, store, input)
  }
}

async function listComponents(
  service: LibraryService,
  store: EditorStore,
  input: {
    name?: string
    libraryId?: string
    enabledOnly?: boolean
  }
): Promise<EnabledLibraryAsset[]> {
  const normalizedName = input.name?.trim().toLowerCase()
  const libraries = await service.listLibraries()
  const assets: EnabledLibraryAsset[] = []
  for (const summary of libraries) {
    if (input.libraryId && input.libraryId !== summary.libraryId) continue
    const binding = store.graph.enabledLibraries.get(summary.libraryId)
    if (input.enabledOnly && !binding?.enabled) continue
    // Enabled rows enumerate the bound revision, which is what inserts materialize.
    const revisionId = binding?.enabled ? binding.revisionId : summary.latestRevisionId
    // A revision still syncing is a library with no enumerable assets, not a failed list;
    // `readManifest` maps that mirror miss to `null`.
    const manifest = await service.readManifest(summary.libraryId, revisionId)
    if (!manifest) continue
    appendAll(
      assets,
      manifest.assets
        .filter(isLibraryComponentAsset)
        .filter((asset) => !normalizedName || asset.name.toLowerCase().includes(normalizedName))
        .map((asset) => ({
          libraryId: summary.libraryId,
          libraryName: summary.name,
          revisionId,
          asset,
          enabled: binding?.enabled ?? false,
          priority: readLibraryPriority(summary.libraryId)
        }))
    )
  }
  return assets.sort((left, right) => right.priority - left.priority)
}

async function insertComponent(
  service: LibraryService,
  store: EditorStore,
  input: ComponentCatalogInsertInput
): Promise<{ id: string; componentId: string; revisionId: string }> {
  const binding = store.graph.enabledLibraries.get(input.libraryId)
  const boundRevisionId = binding?.revisionId
  if (input.revisionId && boundRevisionId && input.revisionId !== boundRevisionId) {
    throw new Error(
      `Library ${input.libraryId} is bound to revision ${boundRevisionId}; pass that revisionId or none`
    )
  }
  const revisionId = input.revisionId ?? boundRevisionId
  if (!revisionId) throw new Error(`Library is not enabled: ${input.libraryId}`)
  const materialized = await service.materialize(store, input.libraryId, revisionId, input.assetKey)
  let componentId = materialized.componentId
  if (input.variantValues && materialized.componentSetId) {
    const match = store.findVariantByValues(materialized.componentSetId, input.variantValues)
    if (match) componentId = match.id
  }
  const parentId = input.parentId ?? store.state.currentPageId
  const id = store.createInstanceFromComponent(componentId, input.x, input.y, parentId)
  if (!id) throw new Error(`Failed to insert library component: ${input.assetKey}`)
  store.requestRender()
  return { id, componentId, revisionId }
}
