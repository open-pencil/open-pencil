import { reapplyInstanceComponentProperties } from '@open-pencil/core'
import {
  materializeLibraryAsset,
  planOutdatedLibraryInstances,
  updateLibraryDefinitions,
  type ComponentLibraryRevision,
  type LibraryDefinitionUpdate
} from '@open-pencil/core/library'
import { captureGraphCheckpoint } from '@open-pencil/scene-graph/checkpoint'

import type { EditorStore } from '@/app/editor/session'
import type { LibraryRevisionReader } from '@/app/libraries/updates/groups'

type InstanceSwap = { instanceId: string; componentId: string }

function swapInstances(editor: EditorStore, swaps: InstanceSwap[]): void {
  for (const { instanceId, componentId } of swaps) {
    editor.graph.swapInstanceComponent(instanceId, componentId)
    reapplyInstanceComponentProperties(editor, instanceId)
  }
}

/** Swaps each planned instance to its new component as one undoable step. */
export function applyLibraryInstancePlans(
  editor: EditorStore,
  plans: ReturnType<typeof planOutdatedLibraryInstances>,
  label: string
): void {
  const apply = () => {
    swapInstances(editor, plans)
    editor.requestRender()
  }
  const restore = () => {
    swapInstances(
      editor,
      plans.map((plan) => ({
        instanceId: plan.instanceId,
        componentId: plan.previousComponentId
      }))
    )
    editor.requestRender()
  }
  apply()
  editor.pushUndoEntry({ label, forward: apply, inverse: restore })
}

/**
 * `assetKeys` and every other definition `latest` would only move along: an asset whose content
 * it leaves as the document's revision has it, and a component other assets use, which has no
 * update of its own. Redrawing those too lets the document reach `latest` once no asset with a
 * change is left out.
 */
async function withUnchanged(
  editor: EditorStore,
  latest: ComponentLibraryRevision,
  assetKeys: ReadonlySet<string>,
  getRevision: LibraryRevisionReader
): Promise<Set<string>> {
  const keys = new Set(assetKeys)
  const hashes = new Map(latest.manifest.assets.map((asset) => [asset.key, asset.contentHash]))
  for (const node of editor.graph.getAllNodes()) {
    const identity = node.librarySource?.identity
    if (identity?.libraryId !== latest.manifest.libraryId || keys.has(identity.assetKey)) continue
    if (identity.revisionId === latest.manifest.revisionId) continue
    const hash = hashes.get(identity.assetKey)
    if (hash === undefined) {
      keys.add(identity.assetKey)
      continue
    }
    const previous = await getRevision(identity.libraryId, identity.revisionId)
    const asset = previous.manifest.assets.find((entry) => entry.key === identity.assetKey)
    if (asset?.contentHash === hash) keys.add(identity.assetKey)
  }
  return keys
}

/**
 * Moves the instances of the assets a revision draws as another kind of layer, whose definitions
 * cannot be redrawn in place, to a copy of the revision's, as updating instance by instance does.
 * The document stays on its revision while the update leaves other definitions behind.
 */
function replaceDefinitions(
  editor: EditorStore,
  revision: ComponentLibraryRevision,
  { replaced, behind }: LibraryDefinitionUpdate
): void {
  const { libraryId } = revision.manifest
  const binding = editor.graph.enabledLibraries.get(libraryId)
  for (const assetKey of replaced) materializeLibraryAsset(editor.graph, revision, assetKey)
  swapInstances(editor, planOutdatedLibraryInstances(editor.graph, revision, new Set(replaced)))
  if (behind.length > 0 && binding) editor.graph.enabledLibraries.set(libraryId, binding)
}

/**
 * Redraws the document's definitions of each library, or only those of the given assets, at the
 * library's latest revision in place, so every instance, and every copy of one inside a
 * component, keeps its overrides. Undo puts the document back as it was, and redo as the update
 * left it, so the layers it added keep their IDs for the edits redone after it.
 *
 * Returns whether anything was updated.
 */
export async function updateLibraryDefinitionsInPlace(
  editor: EditorStore,
  libraries: ReadonlyMap<string, ReadonlySet<string> | undefined>,
  label: string,
  getRevision: LibraryRevisionReader
): Promise<boolean> {
  const updates: { revision: ComponentLibraryRevision; assetKeys?: ReadonlySet<string> }[] = []
  for (const [libraryId, assetKeys] of libraries) {
    const revision = await getRevision(libraryId)
    updates.push({
      revision,
      assetKeys: assetKeys && (await withUnchanged(editor, revision, assetKeys, getRevision))
    })
  }
  if (updates.length === 0) return false
  const before = captureGraphCheckpoint(editor.graph)
  const restore = (checkpoint: typeof before) => () => {
    checkpoint.restore()
    editor.refreshDocumentSettings()
  }
  try {
    editor.updateEnabledLibraries(() => {
      for (const { revision, assetKeys } of updates) {
        const update = updateLibraryDefinitions(editor.graph, revision, { assetKeys })
        if (update.replaced.length > 0) replaceDefinitions(editor, revision, update)
      }
    })
  } catch (error) {
    // An update that cannot be drawn, such as one leaving two components using each other,
    // must not leave half of it behind.
    restore(before)()
    throw error
  }
  const after = captureGraphCheckpoint(editor.graph)
  editor.requestRender()
  editor.pushUndoEntry({ label, forward: restore(after), inverse: restore(before) })
  return true
}
