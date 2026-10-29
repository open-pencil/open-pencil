import { describe, expect, test } from 'bun:test'

import { createSVGNodes } from '@open-pencil/core/io/formats/svg'
import { SceneGraph } from '@open-pencil/scene-graph'

const BOM = '\uFEFF'

/** The shape of a VTracer 1.0.0-alpha.4 file: a declaration, a generator comment, and filled paths. */
const VTRACER_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: visioncortex VTracer 1.0.0-alpha.4 -->
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="192" height="128">
<path d="M0,0C64,0,128,0,192,0c0,42.67,0,85.33,0,128c-64,0-128,0-192,0C0,85.33,0,42.67,0,0Z" fill="#0F172A"/>
<path d="M125,26c16,0,32,0,48,0c0,25.67,0,51.33,0,77c-16,0-32,0-48,0c0-25.67,0-51.33,0-77Z" fill="#FAFAFA"/>
</svg>
`

const DOCTYPE =
  '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">'

function importedSize(svg: string): { children: number; width: number; height: number } | null {
  const graph = new SceneGraph()
  const root = createSVGNodes(graph, graph.getPages()[0].id, svg)
  return root
    ? { children: graph.getChildren(root.id).length, width: root.width, height: root.height }
    : null
}

describe('SVG files that start with a byte-order mark', () => {
  const expected = { children: 2, width: 192, height: 128 }

  test('import as the same layers as without it', () => {
    expect(importedSize(VTRACER_SVG)).toEqual(expected)
    expect(importedSize(BOM + VTRACER_SVG)).toEqual(expected)
  })

  test('import after a doctype', () => {
    const body = VTRACER_SVG.slice(VTRACER_SVG.indexOf('<svg'))
    expect(importedSize(`${BOM}<?xml version="1.0"?>\n${DOCTYPE}\n${body}`)).toEqual(expected)
  })

  test('import without an XML declaration', () => {
    expect(importedSize(BOM + VTRACER_SVG.slice(VTRACER_SVG.indexOf('<svg')))).toEqual(expected)
  })

  test('still reject a document that is not SVG', () => {
    expect(importedSize(`${BOM}<html><body/></html>`)).toBeNull()
  })
})
