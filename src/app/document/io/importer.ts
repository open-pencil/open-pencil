/**
 * The HTML importer: dom-css's browser runtime, which lays HTML out as a browser would, and Core's
 * builder of layers from what it laid out. It loads with the first HTML import, paste of web
 * content, or code preview, since most sessions never import HTML.
 */
export async function loadHTMLImporter() {
  const [layers, browser] = await Promise.all([
    import('@open-pencil/core/io/formats/html/layers'),
    import('@open-pencil/dom-css/browser')
  ])
  return {
    HTML_IMPORT_VIEWPORT: layers.HTML_IMPORT_VIEWPORT,
    loadPageFontFaces: layers.loadPageFontFaces,
    sceneGraphFromStyledHTML: layers.sceneGraphFromStyledHTML,
    browserHTMLHasBoxes: browser.browserHTMLHasBoxes,
    browserHTMLToDesignDocument: browser.browserHTMLToDesignDocument,
    browserTailwindHTMLToDesignDocument: browser.browserTailwindHTMLToDesignDocument
  }
}
