import type { Editor, EditorState } from '@open-pencil/core/editor'
import { exportFigFile } from '@open-pencil/core/io/formats/fig'

import { createAutosave } from '@/app/document/autosave'
import { createDocumentChanges } from '@/app/document/io/changes'
import {
  documentNameFromFigPath,
  downloadNameFromPath,
  figDownloadName
} from '@/app/document/io/names'
import { createSaveActions } from '@/app/document/io/save'
import { createDocumentSourceState } from '@/app/document/io/source-state'
import type { DocumentSourceAccess } from '@/app/document/io/types'
import { createDocumentRecovery } from '@/app/document/recovery'
import { recoveryEnabled } from '@/app/document/recovery/preferences'
import { activeStorageProviderID } from '@/app/integrations/storage'
import type { StorageDocumentBinding, StorageProviderID } from '@/app/integrations/storage/types'
import { createCanvasId } from '@/app/storage/id'
import { trackDocumentFormat } from '@/app/telemetry'

type DocumentSourceState = EditorState & {
  documentName: string
  autosaveEnabled: boolean
}

export { createDocumentSourceState }

type DocumentSourceOptions = DocumentSourceAccess & {
  editor: Editor
  state: DocumentSourceState
  stopWatchingFile: () => void
  startWatchingFile: () => Promise<void>
  getRenderer: () => Editor['renderer']
}

export function createDocumentSourceActions({
  editor,
  state,
  stopWatchingFile,
  startWatchingFile,
  getFileHandle,
  setFileHandle,
  getFilePath,
  setFilePath,
  getDownloadName,
  setDownloadName,
  getStorageBinding,
  setStorageBinding,
  setSourceIdentity,
  getSavedVersion,
  setSavedVersion,
  setLastWriteTime,
  getRenderer
}: DocumentSourceOptions) {
  const changes = createDocumentChanges(editor)

  async function saveAndTrack(save: () => Promise<boolean>) {
    const revision = changes.capture()
    const saved = await save()
    if (saved) changes.markSaved(revision)
    return saved
  }

  function buildFigFile() {
    const renderer = getRenderer()
    return exportFigFile(editor.graph, renderer?.ck, renderer ?? undefined, state.currentPageId)
  }

  function buildRecoveryFigFile() {
    return exportFigFile(editor.graph, undefined, undefined, state.currentPageId)
  }

  const recovery = createDocumentRecovery({
    state,
    version: changes.capture,
    isEnabled: () => recoveryEnabled.value,
    buildFigFile: buildRecoveryFigFile,
    hasWritableSource: () => !!getFileHandle() || !!getFilePath() || !!getStorageBinding()
  })

  const { saveFigFile, saveLocalCopy, writeFile } = createSaveActions({
    state,
    version: changes.capture,
    buildFigFile,
    getFilePath,
    setFilePath,
    getFileHandle,
    setFileHandle,
    getDownloadName,
    setDownloadName,
    getStorageBinding,
    setStorageBinding,
    setSourceIdentity,
    setSavedVersion,
    setLastWriteTime,
    onWriteSuccess: (version) => recovery.markProtectedVersion(version),
    onDownloadSuccess: (version) => recovery.markProtectedVersion(version)
  })

  const autosave = createAutosave({
    state,
    version: changes.capture,
    getSavedVersion,
    hasWritableSource: () => !!getFileHandle() || !!getFilePath() || !!getStorageBinding(),
    saveCurrentDocument: async (version) => {
      const revision = changes.capture()
      const data = await buildFigFile()
      if (await writeFile(data, version)) changes.markSaved(revision)
    }
  })

  function markDocumentSaved() {
    changes.markSaved()
    setSavedVersion(changes.capture())
  }

  /**
   * Every design lives in the library, as in Figma: it saves itself on this device and syncs
   * to storage once storage is set up. Nothing is written until the design changes.
   */
  function bindToLibrary() {
    stopWatchingFile()
    setFileHandle(null)
    setFilePath(null)
    setStorageBinding({ providerId: activeStorageProviderID.value, documentId: createCanvasId() })
    state.autosaveEnabled = true
  }

  bindToLibrary()

  /**
   * An opened file is imported: the design becomes a new library copy and the file on disk is
   * left as it was. The file's identity is kept so opening it again finds its tab.
   */
  function setDocumentSource(
    fileName: string,
    sourceFormat: string,
    handle?: FileSystemFileHandle,
    path?: string
  ) {
    bindToLibrary()
    recovery.renewRecoveryId()
    setDownloadName(figDownloadName(fileName, sourceFormat))
    setSourceIdentity({ handle: handle ?? null, path: path ?? null })
    markDocumentSaved()
    void recovery.markProtectedVersion(changes.capture())
    trackDocumentFormat('document_opened', sourceFormat)
    void addImportToLibrary()
  }

  /** Writes the import into the library as it was opened; an unedited .fig keeps its bytes. */
  async function addImportToLibrary() {
    const version = changes.capture()
    try {
      await writeFile(await buildFigFile(), version)
    } catch (error) {
      console.warn('[Library] Could not add the opened file to the library', error)
    }
  }

  /** Renaming is an edit: the library entry takes the new name with the next save. */
  function renameDocument(name: string) {
    state.documentName = name
    changes.markChanged()
  }

  /**
   * Move an open library design to another library entry, keeping its unsaved edits: the next
   * save writes them there. Used when a conflict keeps this device's version as a copy.
   */
  function rebindLibraryDocument(documentId: string, documentName: string) {
    const binding = getStorageBinding()
    if (!binding) return
    setStorageBinding({ providerId: binding.providerId, documentId })
    setDownloadName(`${documentName}.fig`)
    state.documentName = documentName
    changes.markChanged()
  }

  function setStorageDocumentSource(binding: StorageDocumentBinding, documentName: string) {
    stopWatchingFile()
    setFileHandle(null)
    setFilePath(null)
    setDownloadName(`${documentName}.fig`)
    setSourceIdentity({ handle: null, path: null })
    setStorageBinding(binding)
    recovery.renewRecoveryId()
    state.documentName = documentName
    state.autosaveEnabled = true
    markDocumentSaved()
    void recovery.markProtectedVersion(changes.capture())
  }

  function setPlannedFilePath(path: string) {
    stopWatchingFile()
    setStorageBinding(null)
    setFileHandle(null)
    setFilePath(path)
    const downloadName = downloadNameFromPath(path)
    setDownloadName(downloadName)
    state.documentName = documentNameFromFigPath(downloadName)
  }

  let retargeting = false

  /**
   * Save to a new target; when the write fails, the document keeps the source it had. A second
   * retarget while one is in flight is refused, so a failure never restores another save's target.
   */
  async function saveToNewTarget(planTarget: () => void): Promise<boolean> {
    if (retargeting) return false
    retargeting = true
    const previous = {
      filePath: getFilePath(),
      fileHandle: getFileHandle(),
      storageBinding: getStorageBinding(),
      downloadName: getDownloadName(),
      documentName: state.documentName
    }
    const restore = () => {
      setStorageBinding(previous.storageBinding)
      setFileHandle(previous.fileHandle)
      setFilePath(previous.filePath)
      setDownloadName(previous.downloadName)
      state.documentName = previous.documentName
      if (previous.filePath || previous.fileHandle) void startWatchingFile()
    }
    planTarget()
    try {
      const saved = await saveAndTrack(saveFigFile)
      if (!saved) restore()
      return saved
    } catch (error) {
      restore()
      throw error
    } finally {
      retargeting = false
    }
  }

  async function saveFigFileToPath(path: string): Promise<boolean> {
    const saved = await saveToNewTarget(() => setPlannedFilePath(path))
    if (saved) void startWatchingFile()
    return saved
  }

  /** Upload the document to storage as a new stored document and keep editing it there. */
  async function saveFigFileToStorage(providerId: StorageProviderID): Promise<boolean> {
    const saved = await saveToNewTarget(() => {
      stopWatchingFile()
      setFileHandle(null)
      setFilePath(null)
      setDownloadName(`${state.documentName}.fig`)
      setStorageBinding({ providerId, documentId: createCanvasId() })
    })
    if (saved) {
      setSourceIdentity({ handle: null, path: null })
      state.autosaveEnabled = true
    }
    return saved
  }

  function startWatchingCurrentFile() {
    void startWatchingFile()
  }

  function disposeDocumentIO() {
    changes.dispose()
    stopWatchingFile()
    autosave.disposeAutosave()
    recovery.disposeRecovery()
  }

  return {
    setDocumentSource,
    setStorageDocumentSource,
    setPlannedFilePath,
    saveFigFileToPath,
    saveFigFileToStorage,
    startWatchingCurrentFile,
    disposeDocumentIO,
    saveFigFile: () => saveAndTrack(saveFigFile),
    saveLocalCopy,
    renameDocument,
    rebindLibraryDocument,
    hasUnsavedChanges: changes.hasUnsavedChanges,
    markDocumentSaved,
    getStorageBinding,
    getRecoveryId: () => recovery.getRecoveryId(),
    adoptRecoverySnapshot: (id: string) => {
      changes.markChanged()
      return recovery.adoptRecoverySnapshot(id)
    },
    persistRecoveryNow: () => recovery.persistNow(),
    /** Write pending edits now: to the library, or to a recovery snapshot for other designs. */
    persistNow: async () => {
      const binding = getStorageBinding()
      if (!binding) return recovery.persistNow()
      if (changes.hasUnsavedChanges()) await saveAndTrack(saveFigFile)
      else await recovery.persistNow()
      // Leaving the page: commit to storage now instead of after the commit spacing.
      const { flushStorageSync } = await import('@/app/storage/sync/runtime')
      await flushStorageSync(binding.documentId)
    },
    discardRecovery: () => recovery.discardRecovery()
  }
}
