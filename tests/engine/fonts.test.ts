import { describe, test, expect } from 'bun:test'

import {
  collectFontKeys,
  fetchBundledFont,
  isFontLoaded,
  isVariableFont,
  markFontLoaded,
  normalizeFontFamily,
  styleToVariant,
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
    expect(weightToStyle(400)).toBe('Regular')
    expect(weightToStyle(500)).toBe('Medium')
    expect(weightToStyle(600)).toBe('SemiBold')
    expect(weightToStyle(700)).toBe('Bold')
    expect(weightToStyle(800)).toBe('ExtraBold')
    expect(weightToStyle(900)).toBe('Black')
  })

  test('appends Italic suffix', () => {
    expect(weightToStyle(400, true)).toBe('Regular Italic')
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

  test('includes default font (Inter) in collected keys', () => {
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
    expect(collectFontKeys(graph, [id])).toEqual([['Inter', 'Regular']])
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
    expect(keys).toEqual([['Roboto', 'Regular']])
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
    expect(keys).toEqual([['Roboto', 'Regular Italic']])
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
    expect(keys).toEqual([['Roboto', 'Regular']])
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
    expect(keys).toContainEqual(['Roboto', 'Regular'])
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
    expect(keys).toContainEqual(['Roboto', 'Regular'])
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

describe('normalizeFontFamily', () => {
  test('strips " Variable" suffix', () => {
    expect(normalizeFontFamily('Inter Variable')).toBe('Inter')
    expect(normalizeFontFamily('Roboto Flex Variable')).toBe('Roboto Flex')
  })

  test('case insensitive', () => {
    expect(normalizeFontFamily('Inter VARIABLE')).toBe('Inter')
    expect(normalizeFontFamily('Inter variable')).toBe('Inter')
  })

  test('handles extra whitespace before Variable', () => {
    expect(normalizeFontFamily('Inter  Variable')).toBe('Inter')
  })

  test('returns unchanged when no Variable suffix', () => {
    expect(normalizeFontFamily('Inter')).toBe('Inter')
    expect(normalizeFontFamily('Roboto')).toBe('Roboto')
    expect(normalizeFontFamily('')).toBe('')
  })

  test('does not strip Variable in the middle', () => {
    expect(normalizeFontFamily('Variable Sans')).toBe('Variable Sans')
  })

  test('strips optical size suffix (pt)', () => {
    expect(normalizeFontFamily('DM Sans 9pt')).toBe('DM Sans')
    expect(normalizeFontFamily('DM Sans 14pt')).toBe('DM Sans')
  })

  test('strips optical size suffix (px)', () => {
    expect(normalizeFontFamily('Noto Sans 12px')).toBe('Noto Sans')
  })

  test('strips optical size suffix (em)', () => {
    expect(normalizeFontFamily('Custom Font 1em')).toBe('Custom Font')
  })

  test('does not strip size units in the middle', () => {
    expect(normalizeFontFamily('12pt Serif')).toBe('12pt Serif')
  })
})

describe('styleToVariant', () => {
  test('regular → "regular"', () => {
    expect(styleToVariant('Regular')).toBe('regular')
  })

  test('italic at 400 → "italic"', () => {
    expect(styleToVariant('Regular Italic')).toBe('italic')
  })

  test('bold → "700"', () => {
    expect(styleToVariant('Bold')).toBe('700')
  })

  test('bold italic → "700italic"', () => {
    expect(styleToVariant('Bold Italic')).toBe('700italic')
  })

  test('light → "300"', () => {
    expect(styleToVariant('Light')).toBe('300')
  })

  test('thin italic → "100italic"', () => {
    expect(styleToVariant('Thin Italic')).toBe('100italic')
  })

  test('semibold → "600"', () => {
    expect(styleToVariant('SemiBold')).toBe('600')
  })

  test('black → "900"', () => {
    expect(styleToVariant('Black')).toBe('900')
  })
})

describe('isVariableFont', () => {
  function makeFontBuffer(tables: string[]): ArrayBuffer {
    const numTables = tables.length
    const headerSize = 12
    const tableRecordSize = 16
    const totalSize = headerSize + numTables * tableRecordSize
    const buf = new ArrayBuffer(totalSize)
    const view = new DataView(buf)
    view.setUint32(0, 0x00010000)
    view.setUint16(4, numTables)
    for (let i = 0; i < numTables; i++) {
      const offset = headerSize + i * tableRecordSize
      for (let c = 0; c < 4; c++) {
        view.setUint8(offset + c, tables[i].charCodeAt(c))
      }
    }
    return buf
  }

  test('detects fvar table', () => {
    expect(isVariableFont(makeFontBuffer(['head', 'fvar', 'glyf']))).toBe(true)
  })

  test('returns false without fvar', () => {
    expect(isVariableFont(makeFontBuffer(['head', 'glyf', 'cmap']))).toBe(false)
  })

  test('returns false for empty buffer', () => {
    expect(isVariableFont(new ArrayBuffer(0))).toBe(false)
  })

  test('returns false for too-small buffer', () => {
    expect(isVariableFont(new ArrayBuffer(8))).toBe(false)
  })

  test('fvar as only table', () => {
    expect(isVariableFont(makeFontBuffer(['fvar']))).toBe(true)
  })
})

describe('fetchBundledFont', () => {
  test('loads Inter-Regular.ttf from assets in headless', async () => {
    const buffer = await fetchBundledFont('/Inter-Regular.ttf')
    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(buffer!.byteLength).toBeGreaterThan(100_000)
  })

  test('returns valid TTF data', async () => {
    const buffer = await fetchBundledFont('/Inter-Regular.ttf')
    const view = new DataView(buffer!)
    // TrueType magic: 0x00010000
    expect(view.getUint32(0)).toBe(0x00010000)
  })

  test('throws for nonexistent font', async () => {
    expect(fetchBundledFont('/Nonexistent-Font.ttf')).rejects.toThrow()
  })
})
