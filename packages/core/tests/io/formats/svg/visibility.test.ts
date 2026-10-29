import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { createSVGNodes } from '@open-pencil/core/io/formats/svg'
import { importSVG } from '@open-pencil/core/tools'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

/**
 * Each tree is what `figma.createNodeFromSvg` built in Figma 126 from the same markup, with
 * positions relative to the imported frame. Figma keeps hidden content as hidden layers, and a
 * group spans only the layers it shows.
 */
function layerTree(graph: SceneGraph, root: SceneNode): string[] {
  const lines: string[] = []
  const walk = (node: SceneNode, depth: number, originX: number, originY: number) => {
    const x = depth === 0 ? 0 : originX + node.x
    const y = depth === 0 ? 0 : originY + node.y
    const flags = `${node.visible ? '' : ' hidden'}${node.isMask ? ' mask' : ''}`
    lines.push(
      `${'  '.repeat(depth)}${node.type} "${node.name}" ${Math.round(x)},${Math.round(y)} ` +
        `${Math.round(node.width)}x${Math.round(node.height)}${flags}`
    )
    for (const child of graph.getChildren(node.id)) walk(child, depth + 1, x, y)
  }
  walk(root, 0, 0, 0)
  return lines
}

function importedTree(body: string, rootAttributes = ''): string[] {
  const graph = new SceneGraph()
  const root = createSVGNodes(graph, graph.getPages()[0].id, svg(body, rootAttributes))
  if (!root) throw new Error('Nothing imported')
  return layerTree(graph, root)
}

const svg = (body: string, rootAttributes = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" ${rootAttributes}>${body}</svg>`

const rect = (attributes: string) => `<rect width="10" height="10" ${attributes}/>`

describe('SVG import keeps hidden content as hidden layers', () => {
  test('import_svg keeps groups hidden by visibility or display (#1166)', async () => {
    const graph = new SceneGraph()
    await importSVG.execute(new FigmaAPI(graph), {
      svg: svg(`<g visibility="hidden"><path d="M0 0 L50 0 L50 50 Z" fill="#ff0000"/></g>
        <g display="none"><path d="M60 0 L90 0 L90 30 Z" fill="#00ff00"/></g>
        <path d="M0 60 L30 60 L30 90 Z" fill="#0000ff"/>`)
    })
    const [root] = graph.getChildren(graph.getPages()[0].id)
    expect(layerTree(graph, root)).toEqual([
      'FRAME "Frame" 0,0 100x100',
      '  GROUP "Group" 0,0 0x0 hidden',
      '    VECTOR "Vector" 0,0 50x50 hidden',
      '  GROUP "Group" 0,0 0x0 hidden',
      '    VECTOR "Vector" 60,0 30x30 hidden',
      '  VECTOR "Vector" 0,60 30x30'
    ])
  })

  test('reads the properties on shapes and from a style attribute, which wins', () => {
    expect(
      importedTree(`<path id="none" display="none" d="M60 0 L90 0 L90 30 Z"/>
        <path id="collapsed" visibility="collapse" d="M0 60 L30 60 L30 90 Z"/>
        <g visibility="visible" style="visibility: hidden">
          <rect id="hidden" width="10" height="10"/>
          <rect id="shown" x="20" width="10" height="10" visibility="hidden" style="visibility:visible"/>
        </g>
        <g display="inline" style="display: none"><rect width="10" height="10"/></g>
        <rect id="displayed" width="10" height="10" display="none" style="display:inline"/>`)
    ).toEqual([
      'FRAME "Frame" 0,0 100x100',
      '  VECTOR "none" 60,0 30x30 hidden',
      '  VECTOR "collapsed" 0,60 30x30 hidden',
      '  GROUP "Group" 20,0 10x10 hidden',
      '    VECTOR "hidden" 0,0 10x10 hidden',
      '    VECTOR "shown" 20,0 10x10',
      '  GROUP "Group" 0,0 0x0 hidden',
      '    VECTOR "Vector" 0,0 10x10 hidden',
      '  VECTOR "displayed" 0,0 10x10'
    ])
  })

  test('both properties inherit until a child sets its own', () => {
    expect(
      importedTree(`<g visibility="hidden"><g>
          <rect id="hidden" width="10" height="10"/>
          <g visibility="visible"><circle id="shown" cx="20" cy="20" r="5"/></g>
        </g></g>
        <g display="none"><g display="inline"><rect width="10" height="10"/></g></g>`)
    ).toEqual([
      'FRAME "Frame" 0,0 100x100',
      '  GROUP "Group" 0,0 0x0 hidden',
      '    GROUP "Group" 15,15 10x10 hidden',
      '      VECTOR "hidden" 0,0 10x10 hidden',
      '      GROUP "Group" 15,15 10x10',
      '        VECTOR "shown" 15,15 10x10',
      '  GROUP "Group" 0,0 10x10 hidden',
      '    GROUP "Group" 0,0 10x10',
      '      VECTOR "Vector" 0,0 10x10'
    ])
  })

  test('any visibility but visible hides, and any display but none shows', () => {
    const shown = ['inherit', 'initial', 'unset', 'block', 'NONE'].map((value) =>
      rect(`display="${value}"`)
    )
    expect(
      importedTree(`<g visibility="hidden">${rect('visibility="inherit"')}${rect('style="visibility:unset"')}
          ${rect('visibility="initial"')}${rect('visibility="VISIBLE"')}${rect('visibility=" visible "')}</g>
        <g display="none">${shown.join('')}</g>${rect('display=" none "')}`)
    ).toEqual([
      'FRAME "Frame" 0,0 100x100',
      '  GROUP "Group" 0,0 10x10 hidden',
      ...Array.from({ length: 4 }, () => '    VECTOR "Vector" 0,0 10x10 hidden'),
      '    VECTOR "Vector" 0,0 10x10',
      '  GROUP "Group" 0,0 10x10 hidden',
      ...Array.from({ length: 5 }, () => '    VECTOR "Vector" 0,0 10x10'),
      '  VECTOR "Vector" 0,0 10x10 hidden'
    ])
  })

  test('the root element passes its properties to the drawing', () => {
    for (const attribute of ['visibility="hidden"', 'display="none"']) {
      expect(importedTree(rect(''), attribute)).toEqual([
        'FRAME "Frame" 0,0 100x100',
        '  VECTOR "Vector" 0,0 10x10 hidden'
      ])
    }
  })

  test('a hidden <use> hides the copy it draws', () => {
    expect(
      importedTree(`<defs><path id="tri" d="M0 0 L50 0 L50 50 Z"/></defs>
        <use href="#tri" visibility="hidden"/><use href="#tri" display="none" x="40"/>
        <use href="#tri" y="50"/>`)
    ).toEqual([
      'FRAME "Frame" 0,0 100x100',
      '  VECTOR "Vector" 0,0 50x50 hidden',
      '  VECTOR "Vector" 40,0 50x50 hidden',
      '  VECTOR "Vector" 0,50 50x50'
    ])
  })

  test('hidden clip shapes stay in the mask, and a hidden clip path masks nothing', () => {
    expect(
      importedTree(`<defs><clipPath id="c">
          <rect width="20" height="20" visibility="hidden"/>
          <rect x="30" width="20" height="20" display="none"/>
          <rect x="60" width="20" height="20"/>
        </clipPath></defs><rect width="100" height="100" clip-path="url(#c)"/>`)
    ).toEqual([
      'FRAME "Frame" 0,0 100x100',
      '  GROUP "Clip path group" 60,0 20x20',
      '    GROUP "c" 60,0 20x20 mask',
      '      VECTOR "Vector" 0,0 20x20 hidden',
      '      VECTOR "Vector" 30,0 20x20 hidden',
      '      VECTOR "Vector" 60,0 20x20',
      '    VECTOR "Vector" 0,0 100x100'
    ])
    expect(
      importedTree(`<defs><clipPath id="c" display="none"><rect width="20" height="20"/></clipPath></defs>
        <rect width="100" height="100" clip-path="url(#c)"/>`)
    ).toEqual([
      'FRAME "Frame" 0,0 100x100',
      '  GROUP "Clip path group" 0,0 100x100',
      '    GROUP "c" 0,0 0x0 hidden mask',
      '      VECTOR "Vector" 0,0 20x20 hidden',
      '    VECTOR "Vector" 0,0 100x100'
    ])
  })

  test('hidden text imports as hidden text layers with its characters', () => {
    const graph = new SceneGraph()
    createSVGNodes(
      graph,
      graph.getPages()[0].id,
      svg(`<g visibility="hidden"><text x="0" y="20">Hidden</text></g>
        <text x="0" y="40" display="none">Absent</text>
        <text x="0" y="60">Shown</text>`)
    )
    const texts = [...graph.getAllNodes()].filter((node) => node.type === 'TEXT')
    expect(texts.map(({ text, visible }) => ({ text, visible }))).toEqual([
      { text: 'Hidden', visible: false },
      { text: 'Absent', visible: false },
      { text: 'Shown', visible: true }
    ])
  })
})
