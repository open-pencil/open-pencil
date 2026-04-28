import { useClipboard } from '@vueuse/core'
import { nodeToXPath } from '@open-pencil/core/xpath'

import { toast } from '@/app/shell/ui'

import type { EditorStore } from '@/app/editor/active-store'
import type { Ref } from 'vue'

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
    try {
      if (window.document.execCommand(cmd)) return
    } catch (error) {
      console.warn(`Clipboard command ${cmd} failed`, error)
    }

    toast.error('Clipboard access is blocked in this browser context')
  }

  async function clipboardWrite(text: string | null, label: string) {
    if (!text) return
    await copy(text)
    toast.info(`Copied as ${label}`)
  }

  async function copyNodeId() {
    const nodeIds = ids()
    if (nodeIds.length === 0) return
    await copy(nodeIds.join(', '))
    toast.info(`Copied node ID${nodeIds.length > 1 ? 's' : ''}`)
  }

  async function copyXPath() {
    const nodeIds = ids()
    if (nodeIds.length === 0) return
    const xpaths = nodeIds
      .map((id) => nodeToXPath(store.graph, id))
      .filter((xpath): xpath is string => xpath !== null)
    if (xpaths.length === 0) return
    await copy(xpaths.join('\n'))
    toast.info(`Copied XPath${xpaths.length > 1 ? 's' : ''}`)
  }

  async function copyAsPNG() {
    if (typeof ClipboardItem === 'undefined') {
      toast.error('PNG clipboard export is not available in this browser')
      return
    }
    const data = await store.renderExportImage(ids(), 2, 'PNG')
    if (!data) return
    const blob = new Blob([toArrayBuffer(data)], { type: 'image/png' })
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    toast.info('Copied as PNG')
  }

  return { ids, execCommand, clipboardWrite, copyNodeId, copyXPath, copyAsPNG }
}
