export interface RuntimeScenario {
  code: string
  name: string
}

export const runtimeScenarios: RuntimeScenario[] = [
  {
    name: 'Kiwi GUID subpath',
    code: "const { guidToString } = await import('@open-pencil/kiwi/fig/guid'); if (guidToString({ sessionID: 1, localID: 2 }) !== '1:2') throw new Error('Kiwi GUID subpath failed')"
  },
  {
    name: 'Kiwi container subpath',
    code: "const { buildFigKiwi, parseFigKiwiChunks } = await import('@open-pencil/kiwi/fig/container'); const chunks = parseFigKiwiChunks(buildFigKiwi(new Uint8Array([1]), new Uint8Array([2]))); if (chunks?.length !== 2) throw new Error('Kiwi container subpath failed')"
  },
  {
    name: 'FIG archive API',
    code: "const { FIG_PACKAGE_STATUS, effectiveFigmaRawNodeFields, parseFigBuffer, writeFigArchive, readFigContainer, writeFigContainer } = await import('@open-pencil/fig'); if (FIG_PACKAGE_STATUS !== 'archive-api' || typeof effectiveFigmaRawNodeFields !== 'function' || typeof parseFigBuffer !== 'function' || typeof writeFigArchive !== 'function') throw new Error('Fig package status smoke failed'); const document = readFigContainer(writeFigContainer({ schemaDeflated: new Uint8Array([1]), dataRaw: new Uint8Array([2]) })); if (document.dataRaw[0] !== 2) throw new Error('Fig container smoke failed')"
  },
  {
    name: 'FIG NodeChange API',
    code: "const { convertLineHeight, sceneNodeToKiwi } = await import('@open-pencil/fig/node-change'); if (convertLineHeight({ value: 120, units: 'PERCENT' }, 20) !== 24 || typeof sceneNodeToKiwi !== 'function') throw new Error('Fig NodeChange subpath failed')"
  },
  {
    name: 'FIG instance override API',
    code: "const { populateAndApplyOverrides } = await import('@open-pencil/fig/instance-overrides'); if (typeof populateAndApplyOverrides !== 'function') throw new Error('Fig instance override subpath failed')"
  },
  {
    name: 'SceneGraph package',
    code: "const { SceneGraph } = await import('@open-pencil/scene-graph'); const graph = new SceneGraph(); if (graph.getPages().length !== 1) throw new Error('SceneGraph package smoke failed')"
  },
  {
    name: 'PEN parser',
    code: "const { parsePenFile } = await import('@open-pencil/pen'); const graph = parsePenFile(JSON.stringify({ version: '1', children: [{ id: 'frame', type: 'frame', width: 100, height: 50 }] })); if (graph.getPages()[0].childIds.length !== 1) throw new Error('Pen package smoke failed')"
  },
  {
    name: 'DOM/CSS conversion',
    code: "const { htmlToSceneGraph } = await import('@open-pencil/dom-css'); const graph = await htmlToSceneGraph('<div class=card>OpenPencil</div>', { cssText: '.card { width: 320px; }' }); if (graph.getPages()[0].width !== 320) throw new Error('DOM/CSS scene graph failed')"
  },
  {
    name: 'DOM/CSS browser API',
    code: "const browser = await import('@open-pencil/dom-css/browser'); for (const key of ['browserHTMLToDesignDocument', 'browserHTMLToSceneGraph', 'browserTailwindJSXToSceneGraph']) if (typeof browser[key] !== 'function') throw new Error('DOM/CSS browser export missing: ' + key)"
  },
  {
    name: 'DOM/CSS JSX runtime',
    code: "const { jsx, jsxToDesignDocument } = await import('@open-pencil/dom-css/jsx-runtime'); const document = await jsxToDesignDocument(jsx('section', { class: 'card', style: { width: '120px' }, children: 'OpenPencil' })); const node = document.children[0]; if (node?.type !== 'element' || node.inlineStyle?.width !== '120px') throw new Error('DOM/CSS JSX runtime failed')"
  }
]
