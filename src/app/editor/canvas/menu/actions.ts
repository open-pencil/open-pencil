import { useClipboard } from '@vueuse/core'
import type { Ref } from 'vue'

import { nodeToXPath } from '@open-pencil/core/xpath'

import type { EditorStore } from '@/app/editor/active-store'
import { pasteClipboardToReplace } from '@/app/editor/clipboard/paste-to-replace'
import { executeClipboardCommand } from '@/app/editor/clipboard/system'
import { canVectorizeImageNode, vectorizeImageNode } from '@/app/editor/vectorize'
import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'
import { writeTauriClipboardText } from '@/app/tauri/clipboard'
import { isTauri } from '@/app/tauri/env'

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const bytes = new Uint8Array(data.length)
  bytes.set(data)
  return bytes.buffer
}

export function createCanvasMenuActions(store: EditorStore, selectedIds: Ref<Set<string>>) {
  const { copy } = useClipboard()

  function ids() {
    return [...selectedIds.value]
  }

  function execCommand(cmd: 'copy' | 'cut' | 'paste') {
    void executeClipboardCommand(store, cmd).then((ok) => {
      if (!ok) toast.error(notificationMessages.get().clipboardAccessBlocked)
      return undefined
    })
  }

  async function clipboardWrite(text: string | null, label: string) {
    if (!text) return
    if (isTauri()) {
      await writeTauriClipboardText(text)
    } else {
      await copy(text)
    }
    toast.info(notificationMessages.get().copiedAs({ format: label }))
  }

  async function copyNodeId() {
    const nodeIds = ids()
    if (nodeIds.length === 0) return
    const messages = notificationMessages.get()
    await clipboardWrite(
      nodeIds.join(', '),
      nodeIds.length > 1 ? messages.nodeIDs : messages.nodeID
    )
  }

  async function copyXPath() {
    const nodeIds = ids()
    if (nodeIds.length === 0) return
    const xpaths = nodeIds
      .map((id) => nodeToXPath(store.graph, id))
      .filter((xpath): xpath is string => xpath !== null)
    if (xpaths.length === 0) return
    const messages = notificationMessages.get()
    await clipboardWrite(xpaths.join('\n'), xpaths.length > 1 ? messages.xPaths : messages.xPath)
  }

  async function copyAsPNG() {
    if (typeof ClipboardItem === 'undefined') {
      toast.error(notificationMessages.get().pngClipboardUnavailable)
      return
    }
    const data = await store.renderExportImage(ids(), 2, 'PNG')
    if (!data) return
    const blob = new Blob([toArrayBuffer(data)], { type: 'image/png' })
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    toast.info(notificationMessages.get().copiedAs({ format: 'PNG' }))
  }

  return {
    ids,
    execCommand,
    pasteToReplace: () => pasteClipboardToReplace(store),
    clipboardWrite,
    copyNodeId,
    copyXPath,
    copyAsPNG,
    canVectorizeImage: () => {
      void selectedIds.value
      return canVectorizeImageNode(store)
    },
    vectorizeImage: async () => {
      const nodeId = ids()[0]
      if (nodeId) await vectorizeImageNode(store, nodeId)
    }
  }
}
