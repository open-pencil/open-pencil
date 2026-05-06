import { describe, expect, it } from 'bun:test'

import { importClipboardNodes } from '@open-pencil/core'
import type { NodeChange, SceneNode } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { createClipboardGraph } from '#tests/helpers/clipboard'

describe('importClipboardNodes', () => {
  it('skips VARIABLE_SET and VARIABLE nodes', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Document' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page 1'
      },
      {
        guid: { sessionID: 0, localID: 2 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'VARIABLE_SET',
        name: 'Primitives'
      },
      {
        guid: { sessionID: 0, localID: 3 },
        parentIndex: { guid: { sessionID: 0, localID: 2 }, position: '!' },
        type: 'VARIABLE',
        name: 'Colors/Brand/500'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'FRAME',
        name: 'Card',
        size: { x: 300, y: 200 },
        transform: { m00: 1, m01: 0, m02: 50, m10: 0, m11: 1, m12: 50 }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '!' },
        type: 'TEXT',
        name: 'Title',
        size: { x: 200, y: 30 },
        transform: { m00: 1, m01: 0, m02: 10, m10: 0, m11: 1, m12: 10 },
        textData: { characters: 'Hello' },
        fontSize: 16
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(created).toHaveLength(1)

    const card = getNodeOrThrow(graph, created[0])
    expect(card.type).toBe('FRAME')
    expect(card.name).toBe('Card')

    const children = graph.getChildren(card.id)
    expect(children).toHaveLength(1)
    expect(children[0].type).toBe('TEXT')
    expect(children[0].name).toBe('Title')

    const allNodes = [...graph.getAllNodes()]
    const variableNodes = allNodes.filter(
      (n) => n.name.includes('Primitives') || n.name.includes('Colors/')
    )
    expect(variableNodes).toHaveLength(0)
  })

  it('skips non-visual Figma types', () => {
    const { graph, pageId } = createClipboardGraph()

    const nonVisualTypes = [
      'WIDGET',
      'STAMP',
      'STICKY',
      'CONNECTOR',
      'CODE_BLOCK',
      'SHAPE_WITH_TEXT',
      'TABLE_NODE',
      'TABLE_CELL'
    ]
    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      ...nonVisualTypes.map((type, i) => ({
        guid: { sessionID: 0, localID: 100 + i },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: String.fromCharCode(33 + i) },
        type,
        name: `${type}_node`,
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      })),
      {
        guid: { sessionID: 0, localID: 200 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: 'z' },
        type: 'RECTANGLE',
        name: 'RealShape',
        size: { x: 50, y: 50 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(created).toHaveLength(1)
    expect(getNodeOrThrow(graph, created[0]).name).toBe('RealShape')
  })

  it('imports nested frames with children', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'FRAME',
        name: 'Outer',
        size: { x: 400, y: 300 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '!' },
        type: 'FRAME',
        name: 'Inner',
        size: { x: 200, y: 100 },
        transform: { m00: 1, m01: 0, m02: 20, m10: 0, m11: 1, m12: 20 }
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 11 }, position: '!' },
        type: 'TEXT',
        name: 'Label',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 5, m10: 0, m11: 1, m12: 5 },
        textData: { characters: 'Test' },
        fontSize: 14
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(created).toHaveLength(1)

    const outer = getNodeOrThrow(graph, created[0])
    expect(outer.name).toBe('Outer')

    const innerList = graph.getChildren(outer.id)
    expect(innerList).toHaveLength(1)
    expect(innerList[0].name).toBe('Inner')

    const labels = graph.getChildren(innerList[0].id)
    expect(labels).toHaveLength(1)
    expect(labels[0].name).toBe('Label')
    expect(labels[0].text).toBe('Test')
  })

  it('preserves fills and strokes', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'RECTANGLE',
        name: 'Colored',
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        fillPaints: [
          { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
        ],
        strokePaints: [
          { type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }
        ],
        strokeWeight: 2
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    const node = getNodeOrThrow(graph, created[0])
    expect(node.fills).toHaveLength(1)
    expect(node.fills[0].color.r).toBe(1)
    expect(node.strokes).toHaveLength(1)
    expect(node.strokes[0].color.b).toBe(1)
    expect(node.strokes[0].weight).toBe(2)
  })

  it('imports layoutAlignSelf from stackChildAlignSelf', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'FRAME',
        name: 'Row',
        size: { x: 400, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        stackMode: 'HORIZONTAL'
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '!' },
        type: 'FRAME',
        name: 'Stretched',
        size: { x: 200, y: 50 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        stackChildAlignSelf: 'STRETCH'
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '"' },
        type: 'FRAME',
        name: 'Auto',
        size: { x: 200, y: 50 },
        transform: { m00: 1, m01: 0, m02: 200, m10: 0, m11: 1, m12: 0 }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    const row = getNodeOrThrow(graph, created[0])
    const children = graph.getChildren(row.id)
    expect(children[0].layoutAlignSelf).toBe('STRETCH')
    expect(children[1].layoutAlignSelf).toBe('AUTO')
  })

  it('imports clipsContent from frameMaskDisabled', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'FRAME',
        name: 'Clipped',
        size: { x: 200, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        frameMaskDisabled: false
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'FRAME',
        name: 'Unclipped',
        size: { x: 200, y: 100 },
        transform: { m00: 1, m01: 0, m02: 200, m10: 0, m11: 1, m12: 0 },
        frameMaskDisabled: true
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '#' },
        type: 'FRAME',
        name: 'Default',
        size: { x: 200, y: 100 },
        transform: { m00: 1, m01: 0, m02: 400, m10: 0, m11: 1, m12: 0 }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(getNodeOrThrow(graph, created[0]).clipsContent).toBe(true)
    expect(getNodeOrThrow(graph, created[1]).clipsContent).toBe(false)
    expect(getNodeOrThrow(graph, created[2]).clipsContent).toBe(false)
  })

  it('imports fontWeight from fontName.style via styleToWeight', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'TEXT',
        name: 'Medium',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        textData: { characters: 'Hello' },
        fontSize: 14,
        fontName: { family: 'PT Root UI', style: 'Medium', postscript: 'PTRootUI-Medium' }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'TEXT',
        name: 'Bold',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 20 },
        textData: { characters: 'World' },
        fontSize: 14,
        fontName: { family: 'Inter', style: 'Bold', postscript: 'Inter-Bold' }
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '#' },
        type: 'TEXT',
        name: 'Italic',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 40 },
        textData: { characters: 'Italic' },
        fontSize: 14,
        fontName: { family: 'Inter', style: 'Bold Italic', postscript: 'Inter-BoldItalic' }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(getNodeOrThrow(graph, created[0]).fontWeight).toBe(500)
    expect(getNodeOrThrow(graph, created[1]).fontWeight).toBe(700)
    expect(getNodeOrThrow(graph, created[2]).fontWeight).toBe(700)
    expect(getNodeOrThrow(graph, created[2]).italic).toBe(true)
  })

  it('converts letterSpacing object to pixels', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'TEXT',
        name: 'PixelSpacing',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        textData: { characters: 'A' },
        fontSize: 20,
        letterSpacing: { value: 2, units: 'PIXELS' }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'TEXT',
        name: 'PercentSpacing',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 20 },
        textData: { characters: 'B' },
        fontSize: 20,
        letterSpacing: { value: 10, units: 'PERCENT' }
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '#' },
        type: 'TEXT',
        name: 'NoSpacing',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 40 },
        textData: { characters: 'C' },
        fontSize: 20
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(getNodeOrThrow(graph, created[0]).letterSpacing).toBe(2)
    expect(getNodeOrThrow(graph, created[1]).letterSpacing).toBe(2) // 10% of 20px
    expect(getNodeOrThrow(graph, created[2]).letterSpacing).toBe(0)
  })

  it('converts RAW lineHeight to pixels', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'TEXT',
        name: 'RawLH',
        size: { x: 100, y: 36 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        textData: { characters: 'A' },
        fontSize: 24,
        lineHeight: { value: 1.5, units: 'RAW' }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'TEXT',
        name: 'PixelLH',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 40 },
        textData: { characters: 'B' },
        fontSize: 16,
        lineHeight: { value: 20, units: 'PIXELS' }
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '#' },
        type: 'TEXT',
        name: 'PercentLH',
        size: { x: 100, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 80 },
        textData: { characters: 'C' },
        fontSize: 20,
        lineHeight: { value: 120, units: 'PERCENT' }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(getNodeOrThrow(graph, created[0]).lineHeight).toBe(36) // 24 * 1.5
    expect(getNodeOrThrow(graph, created[1]).lineHeight).toBe(20)
    expect(getNodeOrThrow(graph, created[2]).lineHeight).toBe(24) // 120% of 20
  })

  it('converts letterSpacing and lineHeight in style overrides', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'TEXT',
        name: 'Styled',
        size: { x: 200, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        fontSize: 16,
        textData: {
          characters: 'Hello World',
          characterStyleIDs: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
          styleOverrideTable: [
            {
              styleID: 1,
              fontName: { family: 'Inter', style: 'Bold' },
              fontSize: 20,
              lineHeight: { value: 1.5, units: 'RAW' },
              letterSpacing: { value: -2, units: 'PERCENT' }
            }
          ]
        }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    const node = getNodeOrThrow(graph, created[0])
    expect(node.styleRuns).toHaveLength(1)
    expect(node.styleRuns[0].style.lineHeight).toBe(30) // 20 * 1.5
    expect(node.styleRuns[0].style.letterSpacing).toBeCloseTo(-0.4) // 20 * -2/100
  })

  it('maps SYMBOL type to COMPONENT with auto-layout', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'SYMBOL',
        name: 'Dialog/Form',
        size: { x: 452, y: 299 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        stackMode: 'VERTICAL',
        stackSpacing: 16,
        stackVerticalPadding: 24,
        stackHorizontalPadding: 24,
        stackPrimarySizing: 'RESIZE_TO_FIT',
        stackCounterSizing: 'RESIZE_TO_FIT'
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '!' },
        type: 'TEXT',
        name: 'Title',
        size: { x: 404, y: 32 },
        transform: { m00: 1, m01: 0, m02: 24, m10: 0, m11: 1, m12: 24 },
        textData: { characters: 'Hello' },
        fontSize: 24,
        fontWeight: 700
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '"' },
        type: 'RECTANGLE',
        name: 'Divider',
        size: { x: 404, y: 1 },
        transform: { m00: 1, m01: 0, m02: 24, m10: 0, m11: 1, m12: 72 }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(created).toHaveLength(1)

    const component = getNodeOrThrow(graph, created[0])
    expect(component.type).toBe('COMPONENT')
    expect(component.layoutMode).toBe('VERTICAL')
    expect(component.itemSpacing).toBe(16)
    expect(component.primaryAxisSizing).toBe('HUG')
    expect(component.counterAxisSizing).toBe('HUG')

    const children = graph.getChildren(component.id)
    expect(children).toHaveLength(2)
    expect(children[0].name).toBe('Title')
    expect(children[1].name).toBe('Divider')
  })

  it('populates instance children from pasted component', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      // Component with a child
      {
        guid: { sessionID: 1, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'SYMBOL',
        name: 'Icon/Warning',
        size: { x: 48, y: 48 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 1, localID: 11 },
        parentIndex: { guid: { sessionID: 1, localID: 10 }, position: '!' },
        type: 'VECTOR',
        name: 'Triangle',
        size: { x: 48, y: 42 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 3 }
      },
      // Instance referencing the component
      {
        guid: { sessionID: 2, localID: 20 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'INSTANCE',
        name: 'Icon/Warning',
        size: { x: 48, y: 48 },
        transform: { m00: 1, m01: 0, m02: 100, m10: 0, m11: 1, m12: 0 },
        symbolData: { symbolID: { sessionID: 1, localID: 10 } }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(created).toHaveLength(2)

    const component = getNodeOrThrow(graph, created[0])
    expect(component.type).toBe('COMPONENT')
    expect(graph.getChildren(component.id)).toHaveLength(1)

    const instance = getNodeOrThrow(graph, created[1])
    expect(instance.type).toBe('INSTANCE')
    expect(instance.componentId).toBe(component.id)

    const instanceChildren = graph.getChildren(instance.id)
    expect(instanceChildren).toHaveLength(1)
    expect(instanceChildren[0].name).toBe('Triangle')
    expect(instanceChildren[0].type).toBe('VECTOR')
  })

  it('internal canvas components populate instances but are not pasted', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page 1'
      },
      // Internal Only Canvas with component
      {
        guid: { sessionID: 99, localID: 2 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '"' },
        type: 'CANVAS',
        name: 'Internal Only Canvas',
        internalOnly: true
      },
      {
        guid: { sessionID: 1, localID: 10 },
        parentIndex: { guid: { sessionID: 99, localID: 2 }, position: '!' },
        type: 'SYMBOL',
        name: 'Icon',
        size: { x: 24, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 1, localID: 11 },
        parentIndex: { guid: { sessionID: 1, localID: 10 }, position: '!' },
        type: 'VECTOR',
        name: 'Path',
        size: { x: 24, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      // Visible page with instance
      {
        guid: { sessionID: 2, localID: 20 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'INSTANCE',
        name: 'Icon',
        size: { x: 24, y: 24 },
        transform: { m00: 1, m01: 0, m02: 50, m10: 0, m11: 1, m12: 50 },
        symbolData: { symbolID: { sessionID: 1, localID: 10 } }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(created).toHaveLength(1)

    const instance = getNodeOrThrow(graph, created[0])
    expect(instance.type).toBe('INSTANCE')
    expect(instance.name).toBe('Icon')

    const children = graph.getChildren(instance.id)
    expect(children).toHaveLength(1)
    expect(children[0].name).toBe('Path')
    expect(children[0].type).toBe('VECTOR')

    // Component should NOT exist as a visible node
    for (const node of graph.getAllNodes()) {
      if (node.type === 'COMPONENT' && node.name === 'Icon') {
        throw new Error('Internal component should not be pasted as visible node')
      }
    }
  })

  it('detaches orphaned instances to FRAME when component is missing', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      // Frame containing an instance whose component is NOT in the clipboard
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'FRAME',
        name: 'Card',
        size: { x: 400, y: 200 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '!' },
        type: 'INSTANCE',
        name: 'Button',
        size: { x: 120, y: 40 },
        transform: { m00: 1, m01: 0, m02: 20, m10: 0, m11: 1, m12: 20 },
        fillPaints: [
          { type: 'SOLID', color: { r: 0.2, g: 0.4, b: 1, a: 1 }, opacity: 1, visible: true }
        ],
        cornerRadius: 8,
        symbolData: { symbolID: { sessionID: 99, localID: 999 } }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(created).toHaveLength(1)

    const card = getNodeOrThrow(graph, created[0])
    const children = graph.getChildren(card.id)
    expect(children).toHaveLength(1)

    const button = children[0]
    expect(button.type).toBe('FRAME')
    expect(button.name).toBe('Button')
    expect(button.componentId).toBe('')
    expect(button.fills).toHaveLength(1)
    expect(button.fills[0].color.b).toBe(1)
    expect(button.cornerRadius).toBe(8)
    expect(button.width).toBe(120)
    expect(button.height).toBe(40)
  })

  it('applies symbolOverrides text to instance children via overrideKey', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page 1'
      },
      {
        guid: { sessionID: 99, localID: 2 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '"' },
        type: 'CANVAS',
        name: 'Internal Only Canvas',
        internalOnly: true
      },
      // Component on internal canvas
      {
        guid: { sessionID: 1, localID: 10 },
        parentIndex: { guid: { sessionID: 99, localID: 2 }, position: '!' },
        type: 'SYMBOL',
        name: 'Day',
        size: { x: 46, y: 46 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 1, localID: 11 },
        parentIndex: { guid: { sessionID: 1, localID: 10 }, position: '!' },
        type: 'TEXT',
        name: 'Number',
        size: { x: 14, y: 17 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        textData: { characters: '1' },
        overrideKey: { sessionID: 50, localID: 100 }
      },
      // Instance on visible page with text override
      {
        guid: { sessionID: 2, localID: 20 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'INSTANCE',
        name: 'Day',
        size: { x: 46, y: 46 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        symbolData: {
          symbolID: { sessionID: 1, localID: 10 },
          symbolOverrides: [
            {
              guidPath: { guids: [{ sessionID: 50, localID: 100 }] },
              textData: { characters: '25' }
            }
          ]
        }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(created).toHaveLength(1)

    const instance = getNodeOrThrow(graph, created[0])
    expect(instance.type).toBe('INSTANCE')
    const children = graph.getChildren(instance.id)
    expect(children).toHaveLength(1)
    expect(children[0].text).toBe('25')
  })

  it('imports textAutoResize from clipboard data', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'TEXT',
        name: 'AutoHeight',
        size: { x: 200, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        textData: { characters: 'Hello' },
        fontSize: 16,
        textAutoResize: 'HEIGHT'
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'TEXT',
        name: 'AutoBoth',
        size: { x: 100, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 30 },
        textData: { characters: 'World' },
        fontSize: 16,
        textAutoResize: 'WIDTH_AND_HEIGHT'
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '#' },
        type: 'TEXT',
        name: 'Fixed',
        size: { x: 100, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 60 },
        textData: { characters: 'Fixed' },
        fontSize: 16
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(getNodeOrThrow(graph, created[0]).textAutoResize).toBe('HEIGHT')
    expect(getNodeOrThrow(graph, created[1]).textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(getNodeOrThrow(graph, created[2]).textAutoResize).toBe('NONE')
  })

  it('undo removes all imported nodes including children', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'FRAME',
        name: 'Parent',
        size: { x: 400, y: 300 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '!' },
        type: 'RECTANGLE',
        name: 'Child1',
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '"' },
        type: 'TEXT',
        name: 'Child2',
        size: { x: 200, y: 30 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 100 },
        textData: { characters: 'Hello' },
        fontSize: 14
      }
    ] as NodeChange[]

    const nodesBefore = [...graph.getAllNodes()].length
    const childrenBefore = graph.getChildren(pageId).length
    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect([...graph.getAllNodes()].length).toBe(nodesBefore + 3)

    for (const id of [...created].reverse()) graph.deleteNode(id)
    expect([...graph.getAllNodes()].length).toBe(nodesBefore)
    expect(graph.getChildren(pageId)).toHaveLength(childrenBefore)
  })

  it('redo recreates full subtree with correct parent-child relationships', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'FRAME',
        name: 'Parent',
        size: { x: 400, y: 300 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '!' },
        type: 'RECTANGLE',
        name: 'Child1',
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 0, localID: 12 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '"' },
        type: 'TEXT',
        name: 'Child2',
        size: { x: 200, y: 30 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 100 },
        textData: { characters: 'Hello' },
        fontSize: 14
      }
    ] as NodeChange[]

    const childrenBefore = graph.getChildren(pageId).length
    const created = importClipboardNodes(nodeChanges, graph, pageId)
    const parent = getNodeOrThrow(graph, created[0])

    const allSnapshots: SceneNode[] = []
    function walk(id: string) {
      const n = getNodeOrThrow(graph, id)
      allSnapshots.push({ ...n })
      for (const cid of n.childIds) walk(cid)
    }
    for (const id of created) walk(id)

    // Undo
    for (const id of [...created].reverse()) graph.deleteNode(id)
    expect(graph.getChildren(pageId)).toHaveLength(childrenBefore)

    // Redo — recreate with childIds: [] to avoid duplicates from createNode's parent-append
    for (const snapshot of allSnapshots) {
      graph.createNode(snapshot.type, snapshot.parentId ?? pageId, {
        ...snapshot,
        childIds: []
      })
    }

    const restored = getNodeOrThrow(graph, parent.id)
    expect(restored).toBeTruthy()
    expect(restored.name).toBe('Parent')
    expect(restored.childIds).toHaveLength(2)

    const children = graph.getChildren(restored.id)
    expect(children[0].name).toBe('Child1')
    expect(children[1].name).toBe('Child2')
    expect(children[1].text).toBe('Hello')
  })

  it('redo without childIds:[] causes duplicate children', () => {
    const { graph, pageId } = createClipboardGraph()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'FRAME',
        name: 'Parent',
        size: { x: 400, y: 300 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 0, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '!' },
        type: 'RECTANGLE',
        name: 'Child',
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    const parent = getNodeOrThrow(graph, created[0])

    const allSnapshots: SceneNode[] = []
    function walk(id: string) {
      const n = getNodeOrThrow(graph, id)
      allSnapshots.push({ ...n })
      for (const cid of n.childIds) walk(cid)
    }
    for (const id of created) walk(id)

    for (const id of [...created].reverse()) graph.deleteNode(id)

    // Recreate WITHOUT clearing childIds — demonstrates the bug
    for (const snapshot of allSnapshots) {
      graph.createNode(snapshot.type, snapshot.parentId ?? pageId, snapshot)
    }

    const restored = getNodeOrThrow(graph, parent.id)
    // Bug: parent has duplicated childIds because snapshot already had [childId]
    // and createNode appends childId again
    expect(restored.childIds.length).toBeGreaterThan(1)
  })
})
