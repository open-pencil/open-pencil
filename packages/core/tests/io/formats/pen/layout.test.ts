import { describe, expect, test } from 'bun:test'

import { layoutAuthoredNodes } from '@open-pencil/core/layout'
import { parsePenFile, type PenDocument, type PenIconSource, type PenNode } from '@open-pencil/pen'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

function parseLayoutDocument(
  children: PenNode[],
  icons?: PenIconSource,
  fields: Partial<PenDocument> = {}
) {
  const document: PenDocument = { version: '2.17', ...fields, children }
  // As Core's .pen reader lays out what it reads.
  return parsePenFile(JSON.stringify(document), {
    icons,
    layout: (graph) =>
      layoutAuthoredNodes(
        graph,
        graph.getPages().map((page) => page.id)
      )
  })
}

function fixedChild(id: string): PenNode {
  return { id, type: 'frame', width: 620, height: 420 }
}

describe('parsePenFile — Pen layout defaults (#564)', () => {
  test('treats an omitted frame layout as horizontal', () => {
    const graph = parseLayoutDocument([
      {
        id: 'screen',
        type: 'frame',
        width: 1440,
        layout: 'vertical',
        children: [
          {
            id: 'section',
            type: 'frame',
            width: 'fill_container',
            gap: 56,
            padding: [72, 80],
            alignItems: 'center',
            children: [
              fixedChild('fixed'),
              {
                id: 'fill',
                type: 'frame',
                width: 'fill_container',
                height: 420
              }
            ]
          }
        ]
      }
    ])

    expect(graph.getNode('section')).toMatchObject({
      layoutMode: 'HORIZONTAL',
      width: 1440,
      height: 564,
      paddingTop: 72,
      paddingRight: 80,
      paddingBottom: 72,
      paddingLeft: 80
    })
    expect(graph.getNode('fixed')).toMatchObject({ x: 80, y: 72, width: 620, height: 420 })
    expect(graph.getNode('fill')).toMatchObject({ x: 756, y: 72, width: 604, height: 420 })
  })

  test.each(['fit_content', 'fit_content(100)'])('maps %s to HUG sizing', (height) => {
    const graph = parseLayoutDocument([
      {
        id: 'section',
        type: 'frame',
        width: 1440,
        height,
        layout: 'horizontal',
        padding: [72, 80],
        children: [fixedChild('fixed')]
      }
    ])

    expect(graph.getNode('section')).toMatchObject({
      counterAxisSizing: 'HUG',
      height: 564
    })
  })

  test('uses the parameterized fit-content value when a frame has no content', () => {
    const graph = parseLayoutDocument([
      {
        id: 'empty',
        type: 'frame',
        width: 'fit_content(240)',
        height: 'fit_content(120)'
      }
    ])

    expect(graph.getNode('empty')).toMatchObject({
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      width: 240,
      height: 120,
      minWidth: 240,
      minHeight: 120
    })
  })

  test('ignores the parameterized fallback when content determines the size', () => {
    const graph = parseLayoutDocument([
      {
        id: 'content-frame',
        type: 'frame',
        width: 'fit_content(240)',
        height: 'fit_content(120)',
        padding: 10,
        children: [{ id: 'content', type: 'frame', width: 20, height: 30 }]
      }
    ])

    expect(graph.getNode('content-frame')).toMatchObject({
      width: 40,
      height: 50,
      minWidth: null,
      minHeight: null
    })
  })

  test('keeps explicit freeform frames out of auto-layout', () => {
    const graph = parseLayoutDocument([
      {
        id: 'freeform',
        type: 'frame',
        layout: 'none',
        children: [fixedChild('fixed')]
      }
    ])

    expect(graph.getNode('freeform')?.layoutMode).toBe('NONE')
  })
})

describe('parsePenFile — Pen sizing fallbacks (#564)', () => {
  test('sizes fill-container outside a layout by its fallback', () => {
    const graph = parseLayoutDocument([
      {
        id: 'free',
        type: 'frame',
        layout: 'none',
        width: 1000,
        height: 400,
        children: [{ id: 'filler', type: 'rectangle', width: 'fill_container(900)', height: 40 }]
      }
    ])
    expect(graph.getNode('filler')?.width).toBe(900)
  })

  test.each(['fit_content()', 'fit_content(nope)', 'fit_content(100)garbage'])(
    'falls back to the default size for malformed sizing %s',
    (width) => {
      const graph = parseLayoutDocument([
        {
          id: 'free',
          type: 'frame',
          layout: 'none',
          width: 1000,
          height: 400,
          children: [{ id: 'shape', type: 'rectangle', width, height: 40 }]
        }
      ])
      expect(graph.getNode('shape')?.width).toBe(100)
    }
  )
})

describe('parsePenFile — text without a width', () => {
  function hugButton(text: PenNode) {
    const graph = parseLayoutDocument([
      { id: 'button', name: 'button', type: 'frame', padding: [12, 24], children: [text] }
    ])
    const nodes = [...graph.getAllNodes()]
    return {
      button: nodes.find((node) => node.type === 'FRAME' && node.name === 'button'),
      label: nodes.find((node) => node.type === 'TEXT')
    }
  }

  test('sizes auto-width text from its content instead of a placeholder', () => {
    const { button, label } = hugButton({
      id: 'label',
      name: 'label',
      type: 'text',
      content: 'Button',
      fontSize: 18
    })

    expect(label?.width).toBeGreaterThan(0)
    expect(label?.width).toBeLessThan(200)
    expect(button?.width).toBeLessThan(250)
  })

  test('gives fixed-width text, even a single glyph, a non-zero width', () => {
    for (const content of ['A', 'Label']) {
      const { label } = hugButton({
        id: 'label',
        name: 'label',
        type: 'text',
        content,
        fontSize: 18,
        textGrowth: 'fixed-width'
      })
      expect(label?.width).toBeGreaterThan(0)
      expect(label?.width).toBeLessThan(200)
    }
  })

  test('keeps empty text without a width at zero', () => {
    const { label } = hugButton({ id: 'label', name: 'label', type: 'text', content: '' })
    expect(label?.width).toBe(0)
  })

  test('keeps an explicit narrow width on multi-character text', () => {
    const graph = parsePenFile(
      JSON.stringify({
        version: '2.17',
        children: [
          {
            id: 'label',
            name: 'label',
            type: 'text',
            content: 'Label',
            width: 0,
            textGrowth: 'fixed-width'
          }
        ]
      } satisfies PenDocument)
    )
    expect([...graph.getAllNodes()].find((node) => node.type === 'TEXT')?.width).toBe(0)
  })

  test('keeps an explicit zero width', () => {
    const graph = parsePenFile(
      JSON.stringify({
        version: '2.17',
        children: [
          {
            id: 'label',
            name: 'label',
            type: 'text',
            content: 'A',
            width: 0,
            textGrowth: 'fixed-width'
          }
        ]
      } satisfies PenDocument)
    )
    expect([...graph.getAllNodes()].find((node) => node.type === 'TEXT')?.width).toBe(0)
  })
})

describe('parsePenFile — turned layers sized by layout', () => {
  test('turns auto-width text about its corner after laying it out', () => {
    const graph = parseLayoutDocument([
      {
        id: 'free',
        type: 'frame',
        layout: 'none',
        width: 400,
        height: 300,
        children: [
          {
            id: 'label',
            type: 'text',
            x: 100,
            y: 200,
            rotation: 90,
            content: 'Revenue',
            fontSize: 14
          }
        ]
      }
    ])
    const label = graph.getNode('label')
    if (!label) throw new Error('label missing')
    expect(label.width).toBeGreaterThan(0)
    const [cornerX, cornerY] = Matrix.mapPoints(getNodeLocalMatrix(label), [0, 0])
    expect(cornerX).toBeCloseTo(100)
    expect(cornerY).toBeCloseTo(200)
    // Turned a quarter counter-clockwise, the text runs upwards from its corner.
    const [endX, endY] = Matrix.mapPoints(getNodeLocalMatrix(label), [label.width, 0])
    expect(endX).toBeCloseTo(100)
    expect(endY).toBeCloseTo(200 - label.width)
  })
})

describe('parsePenFile — space around', () => {
  test('gives each child an equal share of the free space, half on each side', () => {
    const graph = parseLayoutDocument([
      {
        id: 'row',
        type: 'frame',
        layout: 'horizontal',
        justifyContent: 'space_around',
        width: 300,
        height: 50,
        children: ['a', 'b', 'c'].map((id) => ({ id, type: 'rectangle', width: 30, height: 30 }))
      }
    ])
    // 210 of free space: 70 per child, 35 on each side of each.
    expect(['a', 'b', 'c'].map((id) => graph.getNode(id)?.x)).toEqual([35, 135, 235])
  })
})

describe('parsePenFile — paths sized by layout', () => {
  test('draws a filling path at its laid-out size in a component and a resized instance', () => {
    const graph = parseLayoutDocument([
      {
        id: 'mark',
        type: 'frame',
        reusable: true,
        width: 64,
        height: 64,
        layout: 'vertical',
        children: [
          {
            id: 'glyph',
            type: 'path',
            geometry: 'M0 0H10V10H0Z',
            viewBox: [0, 0, 10, 10],
            width: 'fill_container',
            height: 'fill_container'
          }
        ]
      },
      { id: 'small', type: 'ref', ref: 'mark', width: 16, height: 16 }
    ])

    const extent = (id: string) => {
      const vertices = graph.getNode(id)?.vectorNetwork?.vertices ?? []
      return {
        width: Math.max(...vertices.map((vertex) => vertex.x)),
        height: Math.max(...vertices.map((vertex) => vertex.y))
      }
    }
    const copy = graph.getNode('small')?.childIds[0] ?? ''
    expect(extent('glyph')).toEqual({ width: 64, height: 64 })
    expect(graph.getNode(copy)).toMatchObject({ width: 16, height: 16 })
    expect(extent(copy)).toEqual({ width: 16, height: 16 })
  })

  test('draws a filling path at the size a second layout gives it', () => {
    // Fitting the group to its 40 wide layer lays the row out again, widening the path.
    const graph = parseLayoutDocument([
      {
        id: 'row',
        type: 'frame',
        width: 200,
        height: 50,
        children: [
          {
            id: 'group',
            type: 'group',
            children: [{ id: 'swatch', type: 'rectangle', width: 40, height: 20 }]
          },
          {
            id: 'line',
            type: 'path',
            geometry: 'M0 0H10V10H0Z',
            viewBox: [0, 0, 10, 10],
            width: 'fill_container',
            height: 50
          }
        ]
      }
    ])

    const line = graph.getNode('line')
    const xs = line?.vectorNetwork?.vertices.map((vertex) => vertex.x) ?? []
    expect(line?.width).toBe(160)
    expect(Math.max(...xs)).toBe(160)
  })
})

describe('parsePenFile — icons sized by layout', () => {
  /** Draws each glyph as one square path, `size` wide, as the Iconify source does. */
  const icons: PenIconSource = {
    draw(graph, frameId, name, size, color) {
      graph.createNode('VECTOR', frameId, {
        name,
        width: size,
        height: size,
        fills: [{ type: 'SOLID', color, opacity: 1, visible: true }]
      })
      return true
    }
  }
  const icon: PenNode = {
    id: 'icon',
    type: 'icon',
    library: 'lucide',
    icon: 'zap',
    width: 'fill_container',
    height: 'fill_container',
    fill: '#FF0000'
  }
  const box = (id: string, children: PenNode[]): PenNode => ({
    id,
    type: 'frame',
    width: 24,
    height: 24,
    layout: 'vertical',
    children
  })

  test('draws a filling icon at its laid-out size in its own colour', () => {
    const graph = parseLayoutDocument([box('box', [icon])], icons)
    const [glyph] = graph.getChildren('icon')
    expect(glyph).toMatchObject({ width: 24, height: 24 })
    expect(glyph.fills[0]?.color).toEqual({ r: 1, g: 0, b: 0, a: 1 })
  })

  test('redraws a filling icon in the theme it was read in', () => {
    const graph = parseLayoutDocument(
      [{ ...box('box', [{ ...icon, fill: '$ink' }]), theme: { mode: 'dark' } }],
      icons,
      {
        themes: { mode: ['light', 'dark'] },
        variables: {
          ink: {
            type: 'color',
            value: [
              { value: '#FF0000', theme: { mode: 'light' } },
              { value: '#00FF00', theme: { mode: 'dark' } }
            ]
          }
        }
      }
    )
    const [glyph] = graph.getChildren('icon')
    expect(glyph).toMatchObject({ width: 24, height: 24 })
    expect(glyph.fills[0]?.color).toEqual({ r: 0, g: 1, b: 0, a: 1 })
  })

  test('draws a filling icon in a component at the size of each instance', () => {
    const graph = parseLayoutDocument(
      [
        { ...box('mark', [icon]), reusable: true },
        { id: 'same', type: 'ref', ref: 'mark' },
        { id: 'large', type: 'ref', ref: 'mark', width: 40, height: 40 }
      ],
      icons
    )
    const glyphSize = (iconId: string) => {
      const [glyph] = graph.getChildren(iconId)
      return { width: glyph.width, height: glyph.height }
    }
    const copy = (instanceId: string) => graph.getNode(instanceId)?.childIds[0] ?? ''
    expect(glyphSize('icon')).toEqual({ width: 24, height: 24 })
    expect(glyphSize(copy('same'))).toEqual({ width: 24, height: 24 })
    expect(glyphSize(copy('large'))).toEqual({ width: 40, height: 40 })
  })

  test('keeps only the icon components a laid-out icon shows', () => {
    const graph = parseLayoutDocument(
      [
        { ...box('mark', [icon]), reusable: true },
        { id: 'large', type: 'ref', ref: 'mark', width: 40, height: 40 }
      ],
      icons
    )
    const iconPage = graph.getPages(true).find((page) => page.name === 'Icons')
    expect(graph.getChildren(iconPage?.id ?? '').map((component) => component.name)).toEqual([
      'lucide/zap/24x24',
      'lucide/zap/40x40'
    ])
  })
})
