import { describe, expect, it } from 'bun:test'

import { importClipboardNodes } from '@open-pencil/core'
import type { NodeChange } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { createClipboardGraph } from '#tests/helpers/clipboard'

describe('importClipboardNodes: components', () => {
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
})
