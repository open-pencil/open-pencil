import { afterEach, describe, expect, test } from 'bun:test'

import { computeAllLayouts, SceneGraph, setTextMeasurer } from '@open-pencil/core'

function importedText(graph: SceneGraph, text: string, width: number, height: number, id: string) {
  const page = graph.getPages()[0]
  const node = graph.createNode('TEXT', page.id, {
    width,
    height,
    text,
    textAutoResize: 'WIDTH_AND_HEIGHT'
  })
  graph.updateNode(node.id, { source: { ...node.source, format: 'fig', id } })
  return node
}

afterEach(() => setTextMeasurer(null))

describe('effective generated FIG text layout', () => {
  test('shapes generated text and recomputes its HUG width lineage', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const source = importedText(graph, 'Effective instance text', 342, 20, '1:1')
    const checkbox = graph.createNode('INSTANCE', page.id, {
      width: 366,
      height: 40,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG',
      componentId: 'component'
    })
    graph.updateNode(checkbox.id, {
      source: { ...checkbox.source, format: 'fig', id: '1:5' }
    })
    graph.createNode('INSTANCE', checkbox.id, { width: 16, height: 16 })
    const textWrapper = graph.createNode('FRAME', checkbox.id, {
      width: 350,
      height: 40,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG',
      paddingLeft: 8,
      componentId: 'text-wrapper',
      derivedLayout: { width: 350, height: 40 }
    })
    const generatedText = graph.createNode('TEXT', textWrapper.id, {
      width: 342,
      height: 20,
      text: source.text,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      componentId: source.id,
      derivedLayout: { width: 342, height: 20 }
    })
    setTextMeasurer(() => ({ width: 336, height: 20 }))

    computeAllLayouts(graph)

    expect(graph.getNode(generatedText.id)).toMatchObject({
      width: 336,
      height: 20,
      derivedLayout: { width: 336, height: 20 }
    })
    expect(graph.getNode(textWrapper.id)).toMatchObject({
      width: 344,
      derivedLayout: { width: 344, height: 40 }
    })
    expect(graph.getNode(checkbox.id)).toMatchObject({ width: 360, height: 40 })
    expect(graph.getNode(source.id)).toMatchObject({ width: 342, height: 20 })
  })

  test('repositions centered generated text after effective shaping', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const source = importedText(graph, 'Centered label', 100, 20, '1:7')
    const parent = graph.createNode('FRAME', page.id, {
      width: 200,
      height: 40,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      primaryAxisAlign: 'CENTER'
    })
    const generatedText = graph.createNode('TEXT', parent.id, {
      width: 100,
      height: 20,
      text: source.text,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      componentId: source.id,
      derivedLayout: { width: 100, height: 20 }
    })
    setTextMeasurer(() => ({ width: 80, height: 20 }))

    computeAllLayouts(graph)

    expect(graph.getNode(generatedText.id)).toMatchObject({ x: 60, width: 80 })
  })

  test('resizes visible inherited-stretch children but preserves excluded children', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const source = importedText(graph, 'Chart heading', 100, 20, '1:8')
    const parent = graph.createNode('FRAME', page.id, {
      width: 120,
      height: 80,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG',
      paddingLeft: 10,
      paddingRight: 10,
      counterAxisAlign: 'STRETCH',
      componentId: 'parent',
      derivedLayout: { width: 120, height: 80 }
    })
    graph.createNode('TEXT', parent.id, {
      width: 100,
      height: 20,
      text: source.text,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      componentId: source.id,
      derivedLayout: { width: 100, height: 20 }
    })
    const inheritedStretch = graph.createNode('RECTANGLE', parent.id, {
      width: 100,
      height: 10,
      layoutAlignSelf: 'AUTO',
      derivedLayout: { width: 100, height: 10 }
    })
    const hiddenStretch = graph.createNode('RECTANGLE', parent.id, {
      width: 100,
      height: 10,
      visible: false,
      layoutAlignSelf: 'AUTO',
      derivedLayout: { width: 100, height: 10 }
    })
    const absoluteStretch = graph.createNode('RECTANGLE', parent.id, {
      width: 100,
      height: 10,
      layoutPositioning: 'ABSOLUTE',
      layoutAlignSelf: 'AUTO',
      derivedLayout: { width: 100, height: 10 }
    })
    setTextMeasurer(() => ({ width: 80, height: 20 }))

    computeAllLayouts(graph)

    expect(graph.getNode(parent.id)).toMatchObject({ width: 100 })
    expect(graph.getNode(inheritedStretch.id)).toMatchObject({ width: 80 })
    expect(graph.getNode(hiddenStretch.id)).toMatchObject({ width: 100 })
    expect(graph.getNode(absoluteStretch.id)).toMatchObject({ width: 100 })
  })

  test('preserves fixed generated ancestors after shaping their text', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const source = importedText(graph, 'Choose file', 76, 20, '1:2')
    const input = graph.createNode('FRAME', page.id, {
      width: 108,
      height: 40,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      paddingLeft: 16,
      paddingRight: 16,
      componentId: 'input',
      derivedLayout: { width: 108, height: 40 }
    })
    const generatedText = graph.createNode('TEXT', input.id, {
      width: 76,
      height: 20,
      text: source.text,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      componentId: source.id,
      derivedLayout: { width: 76, height: 20 }
    })
    setTextMeasurer(() => ({ width: 74, height: 20 }))

    computeAllLayouts(graph)

    expect(graph.getNode(generatedText.id)).toMatchObject({ width: 74, height: 20 })
    expect(graph.getNode(input.id)).toMatchObject({
      width: 108,
      height: 40,
      derivedLayout: { width: 108, height: 40 }
    })
  })

  test('reshapes stretched generated source text only inside HUG-width parents', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const source = importedText(graph, 'Bar Chart - Interactive', 333, 30, '1:3')
    graph.updateNode(source.id, { textAutoResize: 'HEIGHT' })
    const cardHeader = graph.createNode('FRAME', page.id, {
      width: 381,
      height: 102,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG',
      paddingLeft: 24,
      paddingRight: 24,
      componentId: 'card-header',
      derivedLayout: { width: 381, height: 102 }
    })
    const generatedText = graph.createNode('TEXT', cardHeader.id, {
      width: 333,
      height: 30,
      text: source.text,
      textAutoResize: 'HEIGHT',
      layoutAlignSelf: 'STRETCH',
      componentId: source.id,
      derivedLayout: { width: 333, height: 30 }
    })
    setTextMeasurer(() => ({ width: 329, height: 37 }))

    computeAllLayouts(graph)

    expect(graph.getNode(generatedText.id)).toMatchObject({ width: 329, height: 30 })
    expect(graph.getNode(cardHeader.id)).toMatchObject({
      width: 377,
      height: 102,
      derivedLayout: { width: 377, height: 102 }
    })
  })

  test('preserves fixed-width text inherited through the component lineage', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const source = importedText(graph, 'Label', 38, 14, '1:6')
    graph.updateNode(source.id, { textAutoResize: 'WIDTH_AND_HEIGHT' })
    const fixedIntermediate = graph.createNode('TEXT', page.id, {
      width: 280,
      height: 14,
      text: 'Email',
      textAutoResize: 'HEIGHT',
      componentId: source.id,
      derivedLayout: { width: 280, height: 14 }
    })
    const generatedText = graph.createNode('TEXT', page.id, {
      width: 302,
      height: 14,
      text: 'Name',
      textAutoResize: 'WIDTH_AND_HEIGHT',
      componentId: fixedIntermediate.id,
      derivedLayout: { width: 302, height: 14 }
    })
    setTextMeasurer(() => ({ width: 36, height: 17 }))

    computeAllLayouts(graph)

    expect(graph.getNode(generatedText.id)).toMatchObject({ width: 302, height: 14 })
  })

  test('preserves stretched override text and direct imported text bounds', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const source = importedText(graph, 'Source copy', 333, 20, '1:4')
    graph.updateNode(source.id, { textAutoResize: 'HEIGHT' })
    const parent = graph.createNode('FRAME', page.id, {
      width: 381,
      height: 68,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG',
      paddingLeft: 24,
      paddingRight: 24,
      componentId: 'parent',
      derivedLayout: { width: 381, height: 68 }
    })
    const overrideText = graph.createNode('TEXT', parent.id, {
      width: 333,
      height: 20,
      text: 'A different instance override',
      textAutoResize: 'HEIGHT',
      layoutAlignSelf: 'STRETCH',
      componentId: source.id,
      derivedLayout: { width: 333, height: 20 }
    })
    setTextMeasurer(() => ({ width: 329, height: 20 }))

    computeAllLayouts(graph)

    expect(graph.getNode(overrideText.id)).toMatchObject({ width: 333, height: 20 })
    expect(graph.getNode(source.id)).toMatchObject({ width: 333, height: 20 })
  })
})
