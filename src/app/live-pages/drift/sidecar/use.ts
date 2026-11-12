import { ref, shallowRef } from 'vue'

import { useEditorStore, type EditorStore } from '@/app/editor/active-store'
import { folderName } from '@/app/projects/schema'
import { getTabsSnapshot } from '@/app/tabs'
import { IS_TAURI } from '@/constants'

import { documentBaselines, type DriftDocument } from '../use'
import { documentBelongsTo } from './document'
import { desktopSidecarFiles, type SidecarFiles } from './files'
import { projectSidecarGit } from './git'
import { publishBaselines, type BaselinesPublish } from './publish'
import { readBaselines, writeBaselines, type SidecarOutcome } from './run'

export type SidecarOptions = {
  /** The repository the open document is saved in, or null while it is saved in none. */
  repository: () => string | null
  /** The baselines of the open document; the active document's by default. */
  document?: DriftDocument
  /** The document's own file name; the active document's by default. */
  name?: () => string | null
  /** The project's files; the desktop's own by default. */
  files?: SidecarFiles
}

/**
 * A project as a place to keep baselines: writing the open document's pictures into it, and
 * reading them back into the document. Both answer what happened rather than throwing, so the
 * panel says in its own words why nothing moved.
 */
export function usePageDriftSidecar(options: SidecarOptions) {
  const store = useEditorStore()
  const document = options.document ?? documentBaselines(store)
  const files = options.files ?? desktopSidecarFiles()
  const name = options.name ?? (() => documentNameOf(store.getDocumentFilePath()))

  const busy = ref(false)
  const outcome = shallowRef<SidecarOutcome | null>(null)

  /** Run one action alone. A browser build has no project folder, which it says up front. */
  async function run(work: () => Promise<SidecarOutcome>): Promise<void> {
    if (busy.value) return
    busy.value = true
    outcome.value = null
    try {
      outcome.value = IS_TAURI ? await work() : { status: 'unavailable' }
    } catch (error) {
      console.warn('[Drift] The project baselines could not be read or written:', error)
      outcome.value = { status: 'unavailable' }
    } finally {
      busy.value = false
    }
  }

  /** Write the open document's baselines into the project it is saved in. */
  function save(): Promise<void> {
    const repository = options.repository()
    if (repository === null) return Promise.resolve()
    return run(() => writeBaselines({ repository, document, name: name(), files }))
  }

  /** Read the project's baselines into the open document, as one undoable edit. */
  function load(): Promise<void> {
    const repository = options.repository()
    if (repository === null) return Promise.resolve()
    return run(() => readBaselines({ repository, document, name: name(), files }))
  }

  return { busy, outcome, save, load }
}

export type PageDriftSidecar = ReturnType<typeof usePageDriftSidecar>

/** The name a document is known by in its project, which its sidecar records. */
export function documentNameOf(path: string | null): string | null {
  return path === null ? null : folderName(path)
}

/**
 * The baselines of whatever document this project holds, written and committed before a pull
 * request opens. The pictures of a document saved elsewhere are left alone: they are not this
 * project's to publish.
 */
export function useProjectBaselines(repository: () => string) {
  const files = desktopSidecarFiles()
  const git = projectSidecarGit()

  /**
   * The open document of this repository. The project's own screen makes the project tab the
   * active one, and that tab carries no document, so the document tabs are asked directly rather
   * than the active store: otherwise the pull request would silently go out without baselines.
   */
  function documentIn(root: string): { store: EditorStore; path: string } | null {
    for (const tab of getTabsSnapshot()) {
      if (tab.kind !== 'document') continue
      const path = tab.store.getDocumentFilePath()
      if (path !== null && documentBelongsTo(path, root)) return { store: tab.store, path }
    }
    return null
  }

  async function publish(): Promise<BaselinesPublish> {
    const root = repository().trim()
    if (root === '') return 'empty'
    if (!IS_TAURI) return 'unavailable'
    const document = documentIn(root)
    if (document === null) return 'empty'
    return publishBaselines({
      repository: root,
      document: documentBaselines(document.store),
      name: documentNameOf(document.path),
      files,
      git
    })
  }

  return { publish }
}
