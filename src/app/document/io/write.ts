import type { Editor, EditorState } from '@open-pencil/core/editor'

import { getActiveCloudAdapter } from '@/app/cloud/active'
import { setCloudActivity } from '@/app/cloud/activity'
import { persistCloudCanvasLocally } from '@/app/cloud/sync/persist'
import type { CloudDocumentBinding } from '@/app/cloud/types'
import { isTauri } from '@/app/tauri/env'

type WriteDocumentState = EditorState & { documentName: string }

type DocumentWriterOptions = {
  state: WriteDocumentState
  getFilePath: () => string | null
  getFileHandle: () => FileSystemFileHandle | null
  getCloudBinding: () => CloudDocumentBinding | null
  setSavedVersion: (version: number) => void
  setLastWriteTime: (time: number) => void
  /** Live editor graph/renderer so we can render a real canvas preview on save. */
  getEditor?: () => Pick<Editor, 'graph' | 'renderer'> | null
}

export function createDocumentWriter({
  state,
  getFilePath,
  getFileHandle,
  getCloudBinding,
  setSavedVersion,
  setLastWriteTime,
  getEditor
}: DocumentWriterOptions) {
  return async function writeFile(data: Uint8Array) {
    setLastWriteTime(Date.now())
    const cloud = getCloudBinding()
    if (cloud) {
      const adapter = getActiveCloudAdapter()
      if (!adapter || adapter.id !== cloud.providerId) {
        throw new Error('Cloud storage is not configured for this document')
      }
      // Local-first: durable on device immediately; S3 catches up via outbox.
      setCloudActivity('Saving…')
      try {
        const editor = getEditor?.() ?? null
        await persistCloudCanvasLocally({
          providerId: cloud.providerId,
          canvasId: cloud.canvasId,
          name: state.documentName || 'Untitled',
          figBytes: data,
          editor,
          pageId: state.currentPageId
        })
        setSavedVersion(state.sceneVersion)
      } finally {
        setCloudActivity(null)
      }
      return
    }

    const filePath = getFilePath()
    const fileHandle = getFileHandle()
    if (filePath && isTauri()) {
      const { writeFile: tauriWrite } = await import('@tauri-apps/plugin-fs')
      await tauriWrite(filePath, data)
      setSavedVersion(state.sceneVersion)
      return
    }
    if (fileHandle) {
      const writable = await fileHandle.createWritable()
      await writable.write(new Uint8Array(data))
      await writable.close()
      setSavedVersion(state.sceneVersion)
    }
  }
}
