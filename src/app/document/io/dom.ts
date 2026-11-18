import { resolveEditorProfile, type Editor, type EditorState } from '@open-pencil/core'
import { embedPageImages } from '@open-pencil/core/io/formats/html/images'
import {
  HTML_IMPORT_VIEWPORT,
  sceneGraphFromStyledHTML
} from '@open-pencil/core/io/formats/html/layers'
import { browserHTMLToDesignDocument } from '@open-pencil/dom-css/browser'
import { nextFrame } from '@open-pencil/vue/shared/frame'

import { describeDiagnosticError, recordDocumentFailure } from '@/app/diagnostics'
import { applyImportedDocument } from '@/app/document/io/imported-document'
import { fetchRemoteBytes } from '@/app/document/io/url/fetch'
import { importIconMatcher } from '@/app/editor/icons/provider'
import type { EditorPreparationController } from '@/app/editor/preparation/controller'
import type { EditorPreparationHandle } from '@/app/editor/preparation/types'
import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'

type OpenDOMDocumentState = EditorState & {
  documentName: string
  /** Whether the side panels show, which a document opens with as its kind starts it. */
  showUI: boolean
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
  fitCurrentPageToViewport: (signal?: AbortSignal) => Promise<void>
  preparationController: EditorPreparationController
}

type DOMImportOptions = {
  cssText?: string
  handle?: FileSystemFileHandle
  path?: string
  preparation?: EditorPreparationHandle
}

type DOMTextImportOptions = {
  cssText?: string
  documentName?: string
  /** The web address the page came from, which its stylesheets and images resolve against. */
  baseURL?: string
}

/** The web address a document was opened from, when its path is one rather than a file's. */
function webAddressOf(path: string | undefined): string | undefined {
  return path && /^https?:\/\//i.test(path) ? path : undefined
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function documentNameFor(file: File): string {
  return file.name.replace(/\.(html?|xhtml)$/i, '')
}

export function createDOMOpenActions({
  editor,
  state,
  setDocumentSource,
  fitCurrentPageToViewport,
  preparationController
}: OpenDOMFileOptions) {
  async function applyDOMText(
    html: string,
    options: DOMTextImportOptions,
    load: ReturnType<EditorPreparationController['begin']>
  ) {
    await nextFrame()
    const pageName = options.documentName ?? 'DOM Import'
    load.update({ phase: 'styling', detail: pageName })
    // Laid out as a browser would, so layers land where the page put its elements.
    const { baseURL } = options
    const styled = await browserHTMLToDesignDocument(html, {
      cssText: options.cssText,
      signal: load.signal,
      compute: { layout: true, viewport: HTML_IMPORT_VIEWPORT },
      // A page from the web brings its stylesheets and pictures from where it lives.
      baseURL,
      importLinkedStylesheets: baseURL !== undefined
    })
    load.signal.throwIfAborted()
    // Pictures by web address come with it; relative ones only for a page from the web, which
    // has an address to resolve them against.
    await embedPageImages(styled, { baseURL, fetch: fetchRemoteBytes, signal: load.signal })
    load.update({ phase: 'layout', detail: pageName })
    const matcher = importIconMatcher(editor, load.signal)
    const graph = await sceneGraphFromStyledHTML(styled, {
      pageName,
      // Asked only when the page draws SVG it does not name, which the index may be loading for.
      matchIcon:
        matcher &&
        ((svgs) => {
          load.update({ phase: 'naming-icons', detail: pageName })
          return matcher(svgs)
        })
    })
    await nextFrame()
    await applyImportedDocument(editor, graph, load)
    // Into a reused tab too, the document opens with the panels its kind starts with.
    state.showUI = resolveEditorProfile(editor.state).panelsOpen
    state.documentName = pageName
    // A later open supersedes this one while it waits for a hidden tab to be shown.
    await fitCurrentPageToViewport(load.signal)
    load.signal.throwIfAborted()
    editor.requestRender()
    return pageName
  }

  async function importDOMText(html: string, options: DOMTextImportOptions = {}) {
    const load = preparationController.begin({
      kind: 'dom-import',
      subject: options.documentName ?? 'DOM Import'
    })
    let succeeded = false
    try {
      const pageName = await applyDOMText(html, options, load)
      setDocumentSource(`${pageName}.html`, 'html')
      toast.info(notificationMessages.get().importedDOMCSS)
      succeeded = true
    } catch (e) {
      if (load.signal.aborted) throw e
      const diagnostic = describeDiagnosticError(e)
      load.fail({
        code: 'decode-failed',
        message: errorDetail(e),
        retryable: diagnostic.retryable ?? true
      })
      recordDocumentFailure({
        operation: 'import',
        format: 'dom-css',
        ...diagnostic,
        retryable: diagnostic.retryable
      })
      console.error('Failed to import DOM/CSS:', e)
      toast.error(notificationMessages.get().importDOMCSSFailed({ error: errorDetail(e) }))
      throw e
    } finally {
      if (succeeded) load.complete()
    }
  }

  async function openDOMFile(file: File, options: DOMImportOptions = {}) {
    const load =
      options.preparation ?? preparationController.begin({ kind: 'dom-import', subject: file.name })
    const ownsLoad = options.preparation === undefined
    let succeeded = false
    try {
      const html = await file.text()
      await applyDOMText(
        html,
        {
          cssText: options.cssText,
          documentName: documentNameFor(file),
          baseURL: webAddressOf(options.path)
        },
        load
      )
      setDocumentSource(file.name, 'html', options.handle, options.path)
      succeeded = true
    } catch (e) {
      if (load.signal.aborted || !ownsLoad) throw e
      const diagnostic = describeDiagnosticError(e)
      load.fail({
        code: 'decode-failed',
        message: errorDetail(e),
        retryable: diagnostic.retryable ?? true
      })
      recordDocumentFailure({
        operation: 'open',
        format: 'dom-css',
        ...diagnostic,
        retryable: diagnostic.retryable
      })
      console.error('Failed to open DOM/CSS file:', e)
      toast.error(notificationMessages.get().openDOMCSSFailed({ error: errorDetail(e) }))
    } finally {
      if (ownsLoad && succeeded) load.complete()
    }
  }

  return { openDOMFile, importDOMText }
}
