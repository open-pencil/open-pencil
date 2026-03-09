import { describe, test, expect } from 'bun:test'

import {
  collectFontKeys,
  isFontLoaded,
  markFontLoaded,
  styleToWeight,
  weightToStyle,
  SceneGraph,
} from '@open-pencil/core'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

describe('styleToWeight', () => {
  test('maps common style names', () => {
    expect(styleToWeight('Regular')).toBe(400)
    expect(styleToWeight('Bold')).toBe(700)
    expect(styleToWeight('Light')).toBe(300)
    expect(styleToWeight('Thin')).toBe(100)
    expect(styleToWeight('Medium')).toBe(500)
    expect(styleToWeight('SemiBold')).toBe(600)
    expect(styleToWeight('ExtraBold')).toBe(800)
    expect(styleToWeight('Black')).toBe(900)
  })

  test('handles italic variants', () => {
    expect(styleToWeight('Bold Italic')).toBe(700)
    expect(styleToWeight('Light Italic')).toBe(300)
  })

  test('case insensitive', () => {
    expect(styleToWeight('bold')).toBe(700)
    expect(styleToWeight('THIN')).toBe(100)
    expect(styleToWeight('semibold')).toBe(600)
  })
})

describe('weightToStyle', () => {
  test('maps weights to style names', () => {
    expect(weightToStyle(100)).toBe('Thin')
    expect(weightToStyle(200)).toBe('ExtraLight')
    expect(weightToStyle(300)).toBe('Light')
    expect(weightToStyle(400)).toBe('Medium')
    expect(weightToStyle(500)).toBe('Medium')
    expect(weightToStyle(600)).toBe('SemiBold')
    expect(weightToStyle(700)).toBe('Bold')
    expect(weightToStyle(800)).toBe('ExtraBold')
    expect(weightToStyle(900)).toBe('Black')
  })

  test('appends Italic suffix', () => {
    expect(weightToStyle(400, true)).toBe('Medium Italic')
    expect(weightToStyle(700, true)).toBe('Bold Italic')
  })
})

describe('markFontLoaded / isFontLoaded', () => {
  test('marks and checks font', () => {
    const family = `TestFont_${Date.now()}`
    expect(isFontLoaded(family)).toBe(false)
    markFontLoaded(family, 'Regular', new ArrayBuffer(8))
    expect(isFontLoaded(family)).toBe(true)
  })

  test('different styles for same family', () => {
    const family = `MultiStyle_${Date.now()}`
    expect(isFontLoaded(family)).toBe(false)
    markFontLoaded(family, 'Bold', new ArrayBuffer(8))
    expect(isFontLoaded(family)).toBe(true)
  })
})

describe('collectFontKeys', () => {
  test('returns empty for non-text nodes', () => {
    const graph = new SceneGraph()
    const id = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Rect',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    }).id
    expect(collectFontKeys(graph, [id])).toEqual([])
  })

  test('returns empty for text nodes using default font (Inter)', () => {
    const graph = new SceneGraph()
    const id = graph.createNode('TEXT', pageId(graph), {
      name: 'Label',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Inter',
      fontWeight: 400,
    }).id
    expect(collectFontKeys(graph, [id])).toEqual([])
  })

  test('collects non-default font family', () => {
    const graph = new SceneGraph()
    const id = graph.createNode('TEXT', pageId(graph), {
      name: 'Label',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Roboto',
      fontWeight: 400,
    }).id
    const keys = collectFontKeys(graph, [id])
    expect(keys).toEqual([['Roboto', 'Medium']])
  })

  test('collects bold weight', () => {
    const graph = new SceneGraph()
    const id = graph.createNode('TEXT', pageId(graph), {
      name: 'Label',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Roboto',
      fontWeight: 700,
    }).id
    const keys = collectFontKeys(graph, [id])
    expect(keys).toEqual([['Roboto', 'Bold']])
  })

  test('collects italic variant', () => {
    const graph = new SceneGraph()
    const id = graph.createNode('TEXT', pageId(graph), {
      name: 'Label',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Roboto',
      fontWeight: 400,
      italic: true,
    }).id
    const keys = collectFontKeys(graph, [id])
    expect(keys).toEqual([['Roboto', 'Medium Italic']])
  })

  test('deduplicates same family+style', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    graph.createNode('TEXT', page, {
      name: 'A',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'A',
      fontFamily: 'Roboto',
      fontWeight: 400,
    })
    graph.createNode('TEXT', page, {
      name: 'B',
      x: 0,
      y: 30,
      width: 100,
      height: 20,
      text: 'B',
      fontFamily: 'Roboto',
      fontWeight: 400,
    })
    const ids = graph.getChildren(page).map((n) => n.id)
    const keys = collectFontKeys(graph, ids)
    expect(keys).toEqual([['Roboto', 'Medium']])
  })

  test('collects multiple families', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    graph.createNode('TEXT', page, {
      name: 'A',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'A',
      fontFamily: 'Roboto',
      fontWeight: 400,
    })
    graph.createNode('TEXT', page, {
      name: 'B',
      x: 0,
      y: 30,
      width: 100,
      height: 20,
      text: 'B',
      fontFamily: 'Open Sans',
      fontWeight: 700,
    })
    const ids = graph.getChildren(page).map((n) => n.id)
    const keys = collectFontKeys(graph, ids)
    expect(keys).toHaveLength(2)
    expect(keys).toContainEqual(['Roboto', 'Medium'])
    expect(keys).toContainEqual(['Open Sans', 'Bold'])
  })

  test('walks into nested children', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frame = graph.createNode('FRAME', page, {
      name: 'Frame',
      x: 0,
      y: 0,
      width: 400,
      height: 400,
    }).id
    graph.createNode('TEXT', frame, {
      name: 'Nested',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'Hello',
      fontFamily: 'Poppins',
      fontWeight: 600,
    })
    const keys = collectFontKeys(graph, [frame])
    expect(keys).toEqual([['Poppins', 'SemiBold']])
  })

  test('collects fonts from style runs', () => {
    const graph = new SceneGraph()
    const id = graph.createNode('TEXT', pageId(graph), {
      name: 'Mixed',
      x: 0,
      y: 0,
      width: 200,
      height: 20,
      text: 'Hello World',
      fontFamily: 'Roboto',
      fontWeight: 400,
      styleRuns: [
        {
          start: 0,
          end: 5,
          style: { fontFamily: 'Roboto', fontWeight: 400 },
        },
        {
          start: 6,
          end: 11,
          style: { fontFamily: 'Montserrat', fontWeight: 700 },
        },
      ],
    }).id
    const keys = collectFontKeys(graph, [id])
    expect(keys).toHaveLength(2)
    expect(keys).toContainEqual(['Roboto', 'Medium'])
    expect(keys).toContainEqual(['Montserrat', 'Bold'])
  })

  test('style run inherits node font when not specified', () => {
    const graph = new SceneGraph()
    const id = graph.createNode('TEXT', pageId(graph), {
      name: 'Partial',
      x: 0,
      y: 0,
      width: 200,
      height: 20,
      text: 'Hello',
      fontFamily: 'Lato',
      fontWeight: 300,
      styleRuns: [
        {
          start: 0,
          end: 5,
          style: {},
        },
      ],
    }).id
    const keys = collectFontKeys(graph, [id])
    expect(keys).toEqual([['Lato', 'Light']])
  })

  test('skips invalid node IDs', () => {
    const graph = new SceneGraph()
    expect(collectFontKeys(graph, ['nonexistent'])).toEqual([])
  })
})
