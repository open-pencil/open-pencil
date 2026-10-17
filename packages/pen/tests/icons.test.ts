import { describe, expect, test } from 'bun:test'

import { parsePenFile, type PenNode } from '@open-pencil/pen'
import { readIcon } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'

function at<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a value')
  return value
}

function pen(child: PenNode): string {
  return JSON.stringify({ version: '2.8', children: [child] })
}

function read(json: string, name: string) {
  const graph = parsePenFile(json)
  // A page takes the name of the document's first child, so it can shadow the node under test.
  const nodes = [...graph.getAllNodes()].filter((node) => node.type !== 'CANVAS')
  return at(nodes.find((node) => node.name === name))
}

const ICON: PenNode = {
  type: 'icon',
  id: 'i1',
  name: 'Search icon',
  icon: 'message-circle',
  library: 'lucide',
  width: 24,
  height: 24,
  fill: '#ff0000'
}

describe('an icon node', () => {
  test('keeps the library reference where the app reads icons from', () => {
    const node = read(pen(ICON), 'Search icon')

    // The graph's icon model, not a metadata key this importer invented: `lucide:message-circle`
    // is the Iconify name the app resolves a glyph from.
    expect(readIcon(node)).toEqual({ name: 'lucide:message-circle' })
  })

  test('keeps its box and fill, so it still occupies its place in the layout', () => {
    const node = read(pen(ICON), 'Search icon')

    expect(node.width).toBe(24)
    expect(colorToHex(at(node.fills[0]).color)).toBe('#FF0000')
  })

  test('stores no reference nothing could resolve when it names no library', () => {
    const json = pen({ ...ICON, library: undefined })

    expect(readIcon(read(json, 'Search icon'))).toBeNull()
  })

  test('takes a name that already carries its library as it stands', () => {
    const json = pen({ ...ICON, icon: 'lucide:message-circle', library: undefined })

    expect(readIcon(read(json, 'Search icon'))).toEqual({ name: 'lucide:message-circle' })
  })
})

describe('a node type with no equivalent', () => {
  test('is imported as a frame, so its box still occupies its place', () => {
    const node = read(pen({ type: 'polygon', id: 'p1', name: 'Poly' }), 'Poly')

    expect(node.type).toBe('FRAME')
  })
})
