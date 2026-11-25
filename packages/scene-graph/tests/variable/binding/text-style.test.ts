import { describe, expect, spyOn, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { createDefaultSourceMetadata } from '@open-pencil/scene-graph/node-defaults'
import {
  collectionsBoundIn,
  createTextStyleLookup,
  effectiveBoundVariables,
  layersUsingVariables,
  reconcileVariableBindings
} from '@open-pencil/scene-graph/variables'

const px = (value: number) => ({ value, unit: 'PIXELS' }) as const

function styledText() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const collection = graph.createCollection('Type scale')
  const roomy = graph.createMode(collection.id, 'Roomy') ?? ''
  const size = graph.createVariable('Body size', 'FLOAT', collection.id, 14)
  size.valuesByMode[roomy] = 20
  const leading = graph.createVariable('Body leading', 'FLOAT', collection.id, 18)
  leading.valuesByMode[roomy] = 26
  const style = graph.createNodeWithId('style:body', 'TEXT', page, {
    name: 'Body',
    sharedStyleType: 'TEXT',
    internalOnly: true,
    fontSize: 14,
    lineHeight: px(18),
    boundVariables: { fontSize: size.id, lineHeight: leading.id },
    source: { ...createDefaultSourceMetadata(), id: 'style:body' }
  })
  const frame = graph.createNode('FRAME', page, {
    variableModes: { [collection.id]: roomy }
  })
  const text = graph.createNode('TEXT', frame.id, {
    text: 'Hello',
    fontSize: 14,
    lineHeight: px(18),
    textStyleId: 'style:body'
  })
  return { graph, collection, roomy, size, leading, style, frame, text }
}

describe('text style bindings', () => {
  test('a text resolves what its style binds in the mode it is in', () => {
    const { graph, text } = styledText()

    reconcileVariableBindings(graph, { subtrees: [text.id] })

    expect([text.fontSize, text.lineHeight]).toEqual([20, px(26)])
    expect(text.textStyleId).toBe('style:body')
  })

  test('a text binding the same field itself keeps its own variable', () => {
    const { graph, collection, roomy, text } = styledText()
    const own = graph.createVariable('Caption size', 'FLOAT', collection.id, 11)
    own.valuesByMode[roomy] = 12
    graph.updateNode(text.id, { boundVariables: { fontSize: own.id } })

    reconcileVariableBindings(graph, { subtrees: [text.id] })

    expect([text.fontSize, text.lineHeight]).toEqual([12, px(26)])
    expect(effectiveBoundVariables(text, createTextStyleLookup(graph)).fontSize).toBe(own.id)
  })

  test('resolving what a style binds keeps the text on the style without recording an edit', () => {
    const { graph, text } = styledText()

    reconcileVariableBindings(graph, { subtrees: [text.id] })

    expect(text.textStyleId).toBe('style:body')
    expect(text.source.editedFields).not.toContain('textStyleId')
  })

  test('binding and unbinding a variable on a style reaches the texts using it', () => {
    const { graph, roomy, leading, style, text } = styledText()
    graph.unbindVariable(style.id, 'lineHeight')

    graph.bindVariable(style.id, 'lineHeight', leading.id)
    reconcileVariableBindings(graph, { subtrees: [style.id] })
    expect(text.lineHeight).toEqual(px(26))

    graph.unbindVariable(style.id, 'lineHeight')
    leading.valuesByMode[roomy] = 30
    reconcileVariableBindings(graph, { subtrees: [style.id] })
    expect(text.lineHeight).toEqual(px(18))
    expect(text.textStyleId).toBe('style:body')
  })

  test('a restyled text keeps percent spacing from its style as its font size changes', () => {
    const { graph, roomy, size, style, text } = styledText()
    const percent = (value: number) => ({ value, unit: 'PERCENT' }) as const
    graph.unbindVariable(style.id, 'lineHeight')
    graph.updateNode(style.id, { letterSpacing: percent(10), lineHeight: percent(150) })

    reconcileVariableBindings(graph, { subtrees: [style.id] })
    expect(text).toMatchObject({
      fontSize: 20,
      letterSpacing: percent(10),
      lineHeight: percent(150)
    })

    size.valuesByMode[roomy] = 24
    reconcileVariableBindings(graph, { variables: [size.id] })
    expect(text).toMatchObject({
      fontSize: 24,
      letterSpacing: percent(10),
      lineHeight: percent(150)
    })
  })

  test('unbinding a variable on a style gives characters using it the style value', () => {
    const { graph, frame, style } = styledText()
    const text = graph.createNode('TEXT', frame.id, {
      text: 'Hello world',
      fontSize: 10,
      styleRuns: [{ start: 6, length: 5, style: { textStyleId: 'style:body', fontSize: 14 } }]
    })
    reconcileVariableBindings(graph, { subtrees: [text.id] })

    graph.unbindVariable(style.id, 'fontSize')
    reconcileVariableBindings(graph, { subtrees: [style.id] })

    expect(text.styleRuns[0].style.fontSize).toBe(14)
    expect(text.fontSize).toBe(10)
  })

  test('characters using a style resolve what it binds', () => {
    const { graph, frame } = styledText()
    const text = graph.createNode('TEXT', frame.id, {
      text: 'Hello world',
      fontSize: 10,
      styleRuns: [{ start: 6, length: 5, style: { textStyleId: 'style:body', fontSize: 14 } }]
    })

    reconcileVariableBindings(graph, { subtrees: [text.id] })

    expect(text.fontSize).toBe(10)
    expect(text.styleRuns[0].style.fontSize).toBe(20)
    expect(text.styleRuns[0].style.textStyleId).toBe('style:body')
  })

  test('changing a variable a style binds reaches the texts using the style', () => {
    const { graph, roomy, size, style, text } = styledText()
    size.valuesByMode[roomy] = 24

    expect(layersUsingVariables(graph, [size.id]).map((node) => node.id)).toEqual([
      style.id,
      text.id
    ])
    reconcileVariableBindings(graph, { variables: [size.id] })

    expect(text.fontSize).toBe(24)
  })

  test('a frame holding a styled text offers the modes of what the style binds', () => {
    const { graph, collection, frame } = styledText()

    expect(collectionsBoundIn(graph, [frame.id])).toEqual(new Set([collection.id]))
  })

  test('a style kept under an ID other than its layer is found without walking the document', () => {
    const { graph, collection, style, frame } = styledText()
    graph.updateNode(style.id, { source: { ...style.source, id: 'style:0123456789ab' } })
    graph.createNode('TEXT', frame.id, { text: 'Hi', textStyleId: 'style:0123456789ab' })
    const getAllNodes = spyOn(graph, 'getAllNodes')

    expect(collectionsBoundIn(graph, [frame.id])).toEqual(new Set([collection.id]))
    expect(collectionsBoundIn(graph, [frame.id])).toEqual(new Set([collection.id]))
    expect(getAllNodes).not.toHaveBeenCalled()
  })

  test('a style found under another layer ID resolves the same', () => {
    const { graph, style, text } = styledText()
    graph.updateNode(style.id, { source: { ...style.source, id: 'style:renamed' } })
    graph.updateNode(text.id, { textStyleId: 'style:renamed' })

    reconcileVariableBindings(graph, { subtrees: [text.id] })

    expect(text.fontSize).toBe(20)
  })

  test('a style the document does not hold leaves the text as stored', () => {
    const { graph, text } = styledText()
    graph.updateNode(text.id, { textStyleId: 'style:missing' })

    expect(reconcileVariableBindings(graph, { subtrees: [text.id] })).toEqual([])
    expect(text.fontSize).toBe(14)
  })
})
