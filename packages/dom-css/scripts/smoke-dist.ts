import type * as DomCSS from '../src/index'

const distPath = '../dist/index.js'
const browserDistPath = '../dist/browser.js'
const dist = await import(distPath)
const browserDist = await import(browserDistPath)

const browserHTMLToSceneGraph: typeof DomCSS.browserHTMLToSceneGraph = dist.browserHTMLToSceneGraph
const browserTailwindJSXToDesignDocument: typeof DomCSS.browserTailwindJSXToDesignDocument =
  dist.browserTailwindJSXToDesignDocument
const compileTailwindCSS: typeof DomCSS.compileTailwindCSS = dist.compileTailwindCSS
const createHeadlessCSSRuntime: typeof DomCSS.createHeadlessCSSRuntime =
  dist.createHeadlessCSSRuntime
const htmlToSceneGraph: typeof DomCSS.htmlToSceneGraph = dist.htmlToSceneGraph
const jsx: typeof DomCSS.jsx = dist.jsx
const jsxToDesignDocument: typeof DomCSS.jsxToDesignDocument = dist.jsxToDesignDocument
const serializeHTML: typeof DomCSS.serializeHTML = dist.serializeHTML

type DesignDocument = DomCSS.DesignDocument

const document: DesignDocument = {
  type: 'document',
  children: [
    {
      type: 'element',
      tagName: 'article',
      attrs: { class: 'card' },
      children: [{ type: 'text', text: 'OpenPencil' }]
    }
  ]
}

const html = serializeHTML(document)
if (!html.includes('OpenPencil')) {
  throw new Error('Expected built serializeHTML() to emit document text')
}

const css = await compileTailwindCSS(['flex', 'w-80'])
if (!css.includes('.w-80')) {
  throw new Error('Expected built compileTailwindCSS() to emit Tailwind utility CSS')
}

const graph = await htmlToSceneGraph('<article class="card">OpenPencil</article>', {
  cssText: '.card { display: flex; width: 320px; }',
  runtime: createHeadlessCSSRuntime()
})
const page = graph.getPages()[0]
const card = page ? graph.getChildren(page.id)[0] : undefined
if (card?.type !== 'FRAME' || card.width !== 320) {
  throw new Error('Expected built htmlToSceneGraph() to produce a sized frame')
}

const jsxDocument = await jsxToDesignDocument(
  jsx('article', { class: 'card', children: 'OpenPencil' })
)
if (jsxDocument.children[0]?.type !== 'element') {
  throw new Error('Expected built JSX helpers to produce DesignDOM elements')
}

if (typeof browserHTMLToSceneGraph !== 'function') {
  throw new TypeError('Expected built browser HTML helper to be exported')
}

if (typeof browserTailwindJSXToDesignDocument !== 'function') {
  throw new TypeError('Expected built browser JSX helper to be exported')
}

if (typeof browserDist.browserHTMLToSceneGraph !== 'function') {
  throw new TypeError('Expected built browser subpath HTML helper to be exported')
}

if (typeof browserDist.browserTailwindJSXToDesignDocument !== 'function') {
  throw new TypeError('Expected built browser subpath helper to be exported')
}
