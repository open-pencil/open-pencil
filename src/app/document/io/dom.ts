import { basename, extname } from 'pathe'

import { resolveEditorProfile } from '@open-pencil/core'
import {
  HTML_IMPORT_VIEWPORT,
  loadPageFontFaces,
  sceneGraphFromStyledHTML
} from '@open-pencil/core/io/formats/html/layers'
import { browserHTMLToDesignDocument } from '@open-pencil/dom-css/browser'
import { errorMessage } from '@open-pencil/std/errors'
import { nextFrame } from '@open-pencil/vue/shared/frame'

import { describeDiagnosticError, recordDocumentFailure } from '@/app/diagnostics'
import { applyImportedDocument } from '@/app/document/io/imported-document'
import type { OpenFileOptions } from '@/app/document/io/state'
import { pageFetch } from '@/app/document/io/url/fetch'
import { importIconMatcher } from '@/app/editor/icons/provider'
import type { EditorPreparationController } from '@/app/editor/preparation/controller'
import type { EditorPreparationHandle } from '@/app/editor/preparation/types'
import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'
import type { OpenedWebPage } from '@/app/tabs/open/file'

type DOMImportOptions = {
  cssText?: string
  handle?: FileSystemFileHandle
  path?: string
  /** The web page the file is, whose address its links resolve against and whose title it takes. */
  webPage?: OpenedWebPage
  preparation?: EditorPreparationHandle
}

type DOMTextImportOptions = {
  cssText?: string
  documentName?: string
  /** The web address the page came from, which its stylesheets and images resolve against. */
  baseURL?: string
}

/** A page file's name without its extension, as `card.html` is the page `card`. */
function documentNameFor(file: File): string {
  return basename(file.name, extname(file.name))
}

export function createDOMOpenActions({
  editor,
  state,
  setDocumentSource,
  fitCurrentPageToViewport,
  preparationController
}: OpenFileOptions) {
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
    const fetch = pageFetch()
    const styled = await browserHTMLToDesignDocument(html, {
      cssText: options.cssText,
      signal: load.signal,
      compute: { layout: true, viewport: HTML_IMPORT_VIEWPORT },
      // A page brings its stylesheets and pictures from where it lives; a local file, those it
      // links by full address.
      baseURL,
      importLinkedStylesheets: true,
      fetch
    })
    load.signal.throwIfAborted()
    load.update({ phase: 'layout', detail: pageName })
    const matcher = importIconMatcher(editor, load.signal)
    // The page's own fonts, icon fonts among them, before its text is set in them.
    const pageFamilies = await loadPageFontFaces(styled, fetch, load.signal)
    load.signal.throwIfAborted()
    const graph = await sceneGraphFromStyledHTML(styled, {
      pageName,
      pageFamilies,
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
        message: errorMessage(e),
        retryable: diagnostic.retryable ?? true
      })
      recordDocumentFailure({
        operation: 'import',
        format: 'dom-css',
        ...diagnostic,
        retryable: diagnostic.retryable
      })
      console.error('Failed to import DOM/CSS:', e)
      toast.error(notificationMessages.get().importDOMCSSFailed({ error: errorMessage(e) }))
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
          documentName: options.webPage?.title ?? documentNameFor(file),
          baseURL: options.webPage?.url
        },
        load
      )
      // A web page is the HTML file its title names, so a save downloads `<title>.fig`.
      const sourceName = options.webPage ? `${options.webPage.title}.html` : file.name
      setDocumentSource(sourceName, 'html', options.handle, options.path)
      succeeded = true
    } catch (e) {
      if (load.signal.aborted || !ownsLoad) throw e
      const diagnostic = describeDiagnosticError(e)
      load.fail({
        code: 'decode-failed',
        message: errorMessage(e),
        retryable: diagnostic.retryable ?? true
      })
      recordDocumentFailure({
        operation: 'open',
        format: 'dom-css',
        ...diagnostic,
        retryable: diagnostic.retryable
      })
      console.error('Failed to open DOM/CSS file:', e)
      toast.error(notificationMessages.get().openDOMCSSFailed({ error: errorMessage(e) }))
    } finally {
      if (ownsLoad && succeeded) load.complete()
    }
  }

  return { openDOMFile, importDOMText }
}
