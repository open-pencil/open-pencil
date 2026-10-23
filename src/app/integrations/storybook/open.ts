import {
  findComponentMapping,
  implementationStoryURL,
  parseComponentMappings,
  type ComponentMapping,
  type ComponentMappings
} from '@open-pencil/dom-css/export/storybook/mapping'

import { loadedFigFileName, matchesLoadedRevision } from '@/app/document/io/revision'
import { getActiveEditorStore } from '@/app/editor/active-store'
import type { EditorStore } from '@/app/editor/active-store'
import { notificationMessages } from '@/app/i18n/notifications'
import {
  pickComponentMapping,
  type PickedComponentMapping
} from '@/app/integrations/storybook/picker'
import {
  implementationSelection,
  type ImplementationSelectionStore
} from '@/app/integrations/storybook/selection'
import { openExternalLink, toast } from '@/app/shell/ui'
import { IS_TAURI } from '@/constants'

export interface ImplementationStore extends ImplementationSelectionStore {
  state: { selectedIds: Set<string> }
  getSourceIdentity: () => { path: string | null }
  getStorageBinding: () => object | null
  hasUnsavedChanges: () => boolean
}

export interface ImplementationNavigation {
  pick: () => Promise<PickedComponentMapping | null>
  matchesDocument: (mappingPath: string, relative: string, document: string) => Promise<boolean>
  isCurrent: () => boolean
  /** A browser offers a fresh explicit click after the asynchronous picker and validation. */
  open: (url: string, pinned: boolean) => void | Promise<void>
}

/** Keep shared parser diagnostics as the cause, outside the localized user-facing message. */
function readComponentMappings(text: string): ComponentMappings {
  try {
    return parseComponentMappings(text)
  } catch (cause) {
    throw new Error(notificationMessages.get().implementationMappingInvalid, { cause })
  }
}

async function mappedCandidates(
  config: ComponentMappings,
  picked: PickedComponentMapping,
  store: ImplementationStore,
  sourceId: string,
  fileName: string,
  navigation: ImplementationNavigation
) {
  const candidates = []
  for (const mapping of config.components) {
    if (
      mapping.design.id !== sourceId &&
      !mapping.states.some((state) => state.designId === sourceId)
    )
      continue
    if (picked.path) {
      const document = store.getSourceIdentity().path
      if (
        !document ||
        !(await navigation.matchesDocument(picked.path, mapping.design.file, document))
      )
        continue
    } else if (mapping.design.file.split('/').at(-1) !== fileName) continue
    candidates.push(mapping)
  }
  return candidates
}

/** Resolve a developer-owned association without changing the document or its mapping file. */
export async function openImplementationStory(
  store: ImplementationStore,
  navigation: ImplementationNavigation
): Promise<void> {
  const graph = store.graph
  const selection = implementationSelection(store)
  if (!selection) throw new Error(notificationMessages.get().implementationSelectionRequired)
  const { component, sourceId } = selection
  const current = () => {
    if (!navigation.isCurrent() || store.graph !== graph) return false
    const next = implementationSelection(store)
    return (
      next?.node === selection.node && next.component === component && next.sourceId === sourceId
    )
  }
  const picked = await navigation.pick()
  if (!picked || !current()) return
  const config = readComponentMappings(picked.text)
  const fileName = loadedFigFileName(graph)
  if (!fileName) throw new Error(notificationMessages.get().implementationMappingReopenRequired)
  const candidates = await mappedCandidates(config, picked, store, sourceId, fileName, navigation)
  if (!current()) return
  if (candidates.length !== 1)
    throw new Error(
      notificationMessages.get().implementationMappingCount({ count: candidates.length })
    )
  let mapping: ComponentMapping
  try {
    mapping = findComponentMapping(config, candidates[0].design.file, sourceId)
  } catch (cause) {
    throw new Error(notificationMessages.get().implementationMappingInvalid, { cause })
  }
  const revision = mapping.design.revision
  if (
    revision &&
    (store.hasUnsavedChanges() ||
      store.getStorageBinding() ||
      !(await matchesLoadedRevision(graph, revision)))
  )
    throw new Error(notificationMessages.get().implementationMappingRevisionMismatch)
  if (!current()) return
  if (revision && store.hasUnsavedChanges())
    throw new Error(notificationMessages.get().implementationDocumentChanged)
  const state = mapping.states.find((item) => item.designId === sourceId)
  await navigation.open(implementationStoryURL(config, mapping, state), !!revision)
}

export function requestOpenImplementationStory(store: EditorStore): void {
  void openImplementationStory(store, {
    pick: pickComponentMapping,
    isCurrent: () => getActiveEditorStore() === store,
    matchesDocument: async (mappingPath, relative, document) => {
      const { invoke } = await import('@tauri-apps/api/core')
      return invoke<boolean>('mapping_document_matches', { mappingPath, relative, document })
    },
    open: async (url, pinned) => {
      if (IS_TAURI) await openExternalLink(url)
      else
        toast.info(
          pinned
            ? notificationMessages.get().implementationStoryReady
            : notificationMessages.get().implementationStoryUnpinned,
          {
            label: notificationMessages.get().openImplementationStory,
            run: () => {
              void openExternalLink(url)
            }
          }
        )
    }
  }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : String(error)))
}
