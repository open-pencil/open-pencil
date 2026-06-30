import type { Editor, EditorState } from '@open-pencil/core/editor'
import { browserHTMLToSceneGraph } from '@open-pencil/dom-css/browser'

import { yieldToUI } from '@/app/document/io/browser'
import { applyImportedDocument } from '@/app/document/io/imported-document'
import { toast } from '@/app/shell/ui'

type OpenDOMDocumentState = EditorState & {
  documentName: string
  loading: boolean
}

type OpenDOMFileOptions = {
  editor: Editor
  state: OpenDOMDocumentState
  setDocumentSource: (
    fileName: string,
    sourceFormat: string,
    handle?: FileSystemFileHandle,
    path?: string
  ) => void
  fitCurrentPageToViewport: () => Promise<void>
}

type DOMImportOptions = {
  cssText?: string
  handle?: FileSystemFileHandle
  path?: string
}

type DOMTextImportOptions = {
  cssText?: string
  documentName?: string
}

function documentNameFor(file: File): string {
  return file.name.replace(/\.(html?|xhtml)$/i, '')
}

export function createDOMOpenActions({
  editor,
  state,
  setDocumentSource,
  fitCurrentPageToViewport
}: OpenDOMFileOptions) {
  async function applyDOMText(html: string, options: DOMTextImportOptions) {
    await yieldToUI()
    const pageName = options.documentName ?? 'DOM Import'
    const graph = await browserHTMLToSceneGraph(html, { cssText: options.cssText, pageName })
    await yieldToUI()
    await applyImportedDocument(editor, graph)
    state.documentName = pageName
    await fitCurrentPageToViewport()
    editor.requestRender()
    return pageName
  }

  async function importDOMText(html: string, options: DOMTextImportOptions = {}) {
    try {
      state.loading = true
      const pageName = await applyDOMText(html, options)
      setDocumentSource(`${pageName}.html`, 'html')
      toast.info('Imported DOM/CSS document')
    } catch (e) {
      console.error('Failed to import DOM/CSS:', e)
      toast.error(`Failed to import DOM/CSS: ${e instanceof Error ? e.message : String(e)}`)
      throw e
    } finally {
      state.loading = false
    }
  }

  async function openDOMFile(file: File, options: DOMImportOptions = {}) {
    try {
      state.loading = true
      const html = await file.text()
      await applyDOMText(html, {
        cssText: options.cssText,
        documentName: documentNameFor(file)
      })
      setDocumentSource(file.name, 'html', options.handle, options.path)
    } catch (e) {
      console.error('Failed to open DOM/CSS file:', e)
      toast.error(`Failed to open DOM/CSS file: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      state.loading = false
    }
  }

  return { openDOMFile, importDOMText }
}
