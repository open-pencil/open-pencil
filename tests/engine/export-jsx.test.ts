import { describe, expect, test } from 'bun:test'

import { SceneGraph, sceneNodeToJSX, selectionToJSX } from '@open-pencil/core'

function makeGraph() {
  const graph = new SceneGraph()
  graph.createNode('CANVAS', graph.rootId, { name: 'Page 1' })
  return graph
}

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

describe('sceneNodeToJSX', () => {
  test('basic rectangle', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Box',
      width: 100,
      height: 50
    })
    const jsx = sceneNodeToJSX(node.id, graph)
    expect(jsx).toBe('<Rectangle name="Box" w={100} h={50} />')
  })

  test('rectangle with fill and rounded corners', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Card',
      width: 320,
      height: 200,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
      cornerRadius: 16
    })
    const jsx = sceneNodeToJSX(node.id, graph)
    expect(jsx).toContain('w={320}')
    expect(jsx).toContain('h={200}')
    expect(jsx).toContain('bg="#FFFFFF"')
    expect(jsx).toContain('rounded={16}')
    expect(jsx).toContain('<Rectangle')
    expect(jsx).toContain('/>')
  })

  test('text node', () => {
    const graph = makeGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'Title',
      width: 200,
      height: 24,
      text: 'Hello World',
      fontSize: 18,
      fontWeight: 700,
      fills: [
        { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
      ]
    })
    const jsx = sceneNodeToJSX(node.id, graph)
    expect(jsx).toContain('<Text')
    expect(jsx).toContain('size={18}')
    expect(jsx).toContain('weight="bold"')
    expect(jsx).toContain('color="#000000"')
    expect(jsx).toContain('>Hello World</Text>')
  })

  test('frame with auto-layout', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'Row',
      width: 400,
      height: 100,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 16,
      paddingTop: 12,
      paddingRight: 12,
      paddingBottom: 12,
      paddingLeft: 12,
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG'
    })
    const jsx = sceneNodeToJSX(frame.id, graph)
    expect(jsx).toContain('flex="row"')
    expect(jsx).toContain('gap={16}')
    expect(jsx).toContain('p={12}')
    expect(jsx).toContain('w={400}')
  })

  test('frame with children', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'Card',
      width: 320,
      height: 200,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED'
    })
    graph.createNode('RECTANGLE', frame.id, {
      name: 'Image',
      width: 320,
      height: 120
    })
    graph.createNode('TEXT', frame.id, {
      name: 'Title',
      width: 200,
      height: 20,
      text: 'Card Title',
      fontSize: 16,
      fontWeight: 700,
      fills: [
        { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }
      ]
    })

    const jsx = sceneNodeToJSX(frame.id, graph)
    expect(jsx).toContain('<Frame')
    expect(jsx).toContain('flex="col"')
    expect(jsx).toContain('gap={8}')
    expect(jsx).toContain('  <Rectangle')
    expect(jsx).toContain('  <Text')
    expect(jsx).toContain('>Card Title</Text>')
    expect(jsx).toContain('</Frame>')
  })

  test('asymmetric padding', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'Box',
      width: 100,
      height: 100,
      layoutMode: 'HORIZONTAL',
      paddingTop: 8,
      paddingRight: 16,
      paddingBottom: 8,
      paddingLeft: 16,
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })
    const jsx = sceneNodeToJSX(frame.id, graph)
    expect(jsx).toContain('py={8}')
    expect(jsx).toContain('px={16}')
    expect(jsx).not.toContain('pt=')
    expect(jsx).not.toContain('pb=')
  })

  test('independent corners', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Pill',
      width: 100,
      height: 40,
      cornerRadius: 20,
      independentCorners: true,
      topLeftRadius: 20,
      topRightRadius: 0,
      bottomRightRadius: 0,
      bottomLeftRadius: 20
    })
    const jsx = sceneNodeToJSX(node.id, graph)
    expect(jsx).toContain('roundedTL={20}')
    expect(jsx).toContain('roundedBL={20}')
    expect(jsx).not.toContain('roundedTR=')
    expect(jsx).not.toContain('roundedBR=')
  })

  test('opacity and rotation', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 50,
      height: 50,
      opacity: 0.5,
      rotation: 45
    })
    const jsx = sceneNodeToJSX(node.id, graph)
    expect(jsx).toContain('opacity={0.5}')
    expect(jsx).toContain('rotate={45}')
  })

  test('stroke', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      strokes: [
        { color: { r: 1, g: 0, b: 0, a: 1 }, weight: 2, opacity: 1, visible: true, align: 'INSIDE' as const }
      ]
    })
    const jsx = sceneNodeToJSX(node.id, graph)
    expect(jsx).toContain('stroke="#FF0000"')
    expect(jsx).toContain('strokeWidth={2}')
  })

  test('hidden children are excluded', () => {
    const graph = makeGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'Parent',
      width: 100,
      height: 100
    })
    graph.createNode('RECTANGLE', frame.id, {
      name: 'Visible',
      width: 50,
      height: 50
    })
    graph.createNode('RECTANGLE', frame.id, {
      name: 'Hidden',
      width: 50,
      height: 50,
      visible: false
    })
    const jsx = sceneNodeToJSX(frame.id, graph)
    expect(jsx).toContain('Visible')
    expect(jsx).not.toContain('Hidden')
  })

  test('empty text node renders self-closing', () => {
    const graph = makeGraph()
    const node = graph.createNode('TEXT', pageId(graph), {
      name: 'Empty',
      width: 100,
      height: 20,
      text: ''
    })
    const jsx = sceneNodeToJSX(node.id, graph)
    expect(jsx).toContain('/>')
    expect(jsx).not.toContain('</Text>')
  })

  test('omits default values', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      opacity: 1,
      rotation: 0,
      cornerRadius: 0
    })
    const jsx = sceneNodeToJSX(node.id, graph)
    expect(jsx).not.toContain('opacity')
    expect(jsx).not.toContain('rotate')
    expect(jsx).not.toContain('rounded')
  })

  test('effects: shadow and blur', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 4 },
          radius: 8,
          spread: 0,
          visible: true
        },
        {
          type: 'LAYER_BLUR',
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          radius: 4,
          spread: 0,
          visible: true
        }
      ]
    })
    const jsx = sceneNodeToJSX(node.id, graph)
    expect(jsx).toContain('shadow="0 4 8')
    expect(jsx).toContain('blur={4}')
  })
})

describe('selectionToJSX', () => {
  test('multiple nodes separated by blank lines', () => {
    const graph = makeGraph()
    const a = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'A',
      width: 10,
      height: 10
    })
    const b = graph.createNode('ELLIPSE', pageId(graph), {
      name: 'B',
      width: 20,
      height: 20
    })
    const jsx = selectionToJSX([a.id, b.id], graph)
    expect(jsx).toContain('<Rectangle')
    expect(jsx).toContain('<Ellipse')
    expect(jsx).toContain('\n\n')
  })
})
