import { basename, extname } from 'pathe'

import { resolveEditorProfile } from '@open-pencil/core'
import { remoteFileTitle } from '@open-pencil/core/io/remote'
import type { DesignViewport } from '@open-pencil/dom-css'
import { errorMessage } from '@open-pencil/std/errors'
import { messageStores } from '@open-pencil/vue/i18n'
import { nextFrame } from '@open-pencil/vue/shared/frame'

import { describeDiagnosticError, recordDocumentFailure } from '@/app/diagnostics'
import { applyImportedDocument } from '@/app/document/io/imported-document'
import { loadHTMLImporter } from '@/app/document/io/importer'
import type { OpenFileOptions } from '@/app/document/io/state'
import { countedFetch, pageFetch } from '@/app/document/io/url/fetch'
import type { RenderedWebPage } from '@/app/document/io/url/render/page'
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
  /** The window a web page is laid out in. */
  viewport?: DesignViewport
}

/**
 * The page as its scripts build it, rendered by the desktop app, or null when it cannot be,
 * including when the renderer fails to load; the HTML its server sent then stands in. The renderer
 * and the scripts it runs in the page are loaded only when a page is rendered.
 */
async function renderedPage(
  webPage: OpenedWebPage,
  load: EditorPreparationHandle
): Promise<RenderedWebPage | null> {
  load.update({ phase: 'rendering-page', detail: webPage.title })
  try {
    const { renderWebPage } = await import('@/app/document/io/url/render/page')
    const viewport = webPage.viewport ?? (await loadHTMLImporter()).HTML_IMPORT_VIEWPORT
    return await renderWebPage(webPage.url, viewport, load.signal)
  } catch {
    load.signal.throwIfAborted()
    return null
  }
}

/**
 * The HTML to import, what its document is called, and the address its links resolve against: a
 * web page's as its scripts built it when it is rendered, or else the file's own.
 */
async function pageSource(
  file: File,
  webPage: OpenedWebPage | undefined,
  load: EditorPreparationHandle
): Promise<{ html: string; title: string; url: string | undefined }> {
  const rendered = webPage?.render ? await renderedPage(webPage, load) : null
  if (rendered) {
    // A page its scripts sent elsewhere is named after where it ended up.
    return { html: rendered.html, title: remoteFileTitle(new URL(rendered.url)), url: rendered.url }
  }
  if (webPage?.rendersOnly) throw new Error(messageStores.files.get().openURLBrowserCheck)
  return {
    html: await file.text(),
    title: webPage?.title ?? documentNameFor(file),
    url: webPage?.url
  }
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
    const {
      HTML_IMPORT_VIEWPORT,
      loadPageFontFaces,
      sceneGraphFromStyledHTML,
      browserHTMLToDesignDocument
    } = await loadHTMLImporter()
    const { baseURL, viewport = HTML_IMPORT_VIEWPORT } = options
    const webPage = baseURL !== undefined
    // A web page counts the files it loads as it lays out: its stylesheets, pictures, and fonts.
    const phase = webPage ? 'loading-files' : 'styling'
    load.update({ phase, detail: pageName })
    let counting = true
    const fetch = countedFetch(pageFetch(baseURL), (completed, total) => {
      if (counting) load.update({ phase, detail: pageName, completed, total, unit: 'files' })
    })
    // Laid out as a browser would, so layers land where the page put its elements.
    const styled = await browserHTMLToDesignDocument(html, {
      cssText: options.cssText,
      signal: load.signal,
      compute: { layout: true, viewport },
      // A page brings its stylesheets and pictures from where it lives; a local file, those it
      // links by full address.
      baseURL,
      importLinkedStylesheets: true,
      fetch
    })
    load.signal.throwIfAborted()
    // The page's own fonts, icon fonts among them, before its text is set in them.
    const pageFamilies = await loadPageFontFaces(styled, fetch, load.signal)
    load.signal.throwIfAborted()
    counting = false
    load.update({ phase: 'layout', detail: pageName })
    const matcher = importIconMatcher(editor, load.signal)
    const graph = await sceneGraphFromStyledHTML(styled, {
      pageName,
      pageFamilies,
      // A web page sits in a frame the size of the window it was laid out in; a file's HTML,
      // often a snippet, stays loose layers.
      pageWindow: webPage ? viewport : undefined,
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
      const page = await pageSource(file, options.webPage, load)
      await applyDOMText(
        page.html,
        {
          cssText: options.cssText,
          documentName: page.title,
          baseURL: page.url,
          viewport: options.webPage?.viewport
        },
        load
      )
      // A web page is the HTML file its title names, so a save downloads `<title>.fig`.
      const sourceName = options.webPage ? `${page.title}.html` : file.name
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
