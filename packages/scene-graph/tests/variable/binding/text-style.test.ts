import { describe, expect, spyOn, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { createDefaultSourceMetadata } from '@open-pencil/scene-graph/node-defaults'
import { rescaleNodeTree } from '@open-pencil/scene-graph/scaling'
import { sharedStylePatch } from '@open-pencil/scene-graph/shared-styles'
import {
  collectionsBoundIn,
  createStyleBindingLookup,
  effectiveBoundVariables,
  layersUsingVariables,
  reconcileVariableBindings
} from '@open-pencil/scene-graph/variables'
import { expectDefined } from '@open-pencil/test-support/assert'

const px = (value: number) => ({ value, unit: 'PIXELS' }) as const

function styledText(holder: 'FRAME' | 'INSTANCE' = 'FRAME') {
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
  const frame = graph.createNode(holder, page, {
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
    expect(effectiveBoundVariables(text, createStyleBindingLookup(graph)).fontSize).toBe(own.id)
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

describe('text style bindings in a scaled occurrence', () => {
  test('a text takes the lengths its style binds at the scale of its occurrence', () => {
    const { graph, text } = styledText('INSTANCE')
    graph.updateNode(text.id, { componentScale: 3 })

    reconcileVariableBindings(graph, { subtrees: [text.id] })

    expect([text.fontSize, text.lineHeight]).toEqual([60, px(78)])
  })

  test('a text binding the size itself keeps its own scaled variable over the style', () => {
    const { graph, collection, roomy, text } = styledText('INSTANCE')
    const own = graph.createVariable('Caption size', 'FLOAT', collection.id, 11)
    own.valuesByMode[roomy] = 12
    graph.updateNode(text.id, {
      componentScale: 3,
      boundVariables: { fontSize: own.id },
      variableBindingScales: { fontSize: 2 }
    })

    reconcileVariableBindings(graph, { subtrees: [text.id] })

    expect([text.fontSize, text.lineHeight]).toEqual([24, px(78)])
  })

  test('characters using a style take its bound size at the scale of their occurrence', () => {
    const { graph, frame } = styledText('INSTANCE')
    const text = graph.createNode('TEXT', frame.id, {
      text: 'Hello world',
      fontSize: 10,
      componentScale: 2,
      styleRuns: [{ start: 6, length: 5, style: { textStyleId: 'style:body', fontSize: 14 } }]
    })

    reconcileVariableBindings(graph, { subtrees: [text.id] })

    expect(text.fontSize).toBe(10)
    expect(text.styleRuns[0].style.fontSize).toBe(40)
  })
})

function scaledInstance() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const collection = graph.createCollection('Scale')
  const roomy = graph.createMode(collection.id, 'Roomy') ?? ''
  const size = graph.createVariable('Size', 'FLOAT', collection.id, 10)
  size.valuesByMode[roomy] = 20
  const tracking = graph.createVariable('Tracking', 'FLOAT', collection.id, 1)
  tracking.valuesByMode[roomy] = 2
  const style = graph.createNodeWithId('style:body', 'TEXT', page, {
    sharedStyleType: 'TEXT',
    internalOnly: true,
    fontSize: 10,
    letterSpacing: px(1),
    boundVariables: { fontSize: size.id, letterSpacing: tracking.id },
    source: { ...createDefaultSourceMetadata(), id: 'style:body' }
  })
  const component = graph.createNode('COMPONENT', page, { width: 40, height: 20 })
  const source = graph.createNode('TEXT', component.id, {
    text: 'Hello world',
    fontSize: 10,
    letterSpacing: px(1),
    textStyleId: 'style:body'
  })
  const frame = graph.createNode('FRAME', page, {})
  const instance = expectDefined(graph.createInstance(component.id, frame.id), 'instance')
  rescaleNodeTree(graph, instance.id, 3)
  const text = (): SceneNode => graph.getChildren(instance.id)[0]
  const toRoomy = () => {
    graph.updateNode(frame.id, { variableModes: { [collection.id]: roomy } })
    reconcileVariableBindings(graph, { subtrees: [frame.id] })
  }
  return { graph, collection, size, style, component, source, frame, text, toRoomy }
}

describe('text style bindings in a scaled instance', () => {
  test('a mode change scales the letter spacing the style binds', () => {
    const { text, toRoomy } = scaledInstance()

    toRoomy()

    expect([text().fontSize, text().letterSpacing]).toEqual([60, px(6)])
  })

  test('unbinding a variable from the style keeps the instance scale', () => {
    const { graph, style, frame, text } = scaledInstance()
    reconcileVariableBindings(graph, { subtrees: [frame.id] })

    graph.unbindVariable(style.id, 'fontSize')
    reconcileVariableBindings(graph, { subtrees: [style.id] })

    expect(text().fontSize).toBe(30)
  })

  test('a component edit synced into a scaled instance keeps the mode and the scale', () => {
    const { graph, component, source, text, toRoomy } = scaledInstance()
    toRoomy()

    graph.updateNode(source.id, { text: 'Changed' })
    graph.syncInstances(component.id)

    expect([text().text, text().fontSize]).toEqual(['Changed', 60])
  })

  test('a component edit synced into an unscaled instance keeps the mode', () => {
    const { graph, component, source, frame, toRoomy } = scaledInstance()
    const plain = expectDefined(graph.createInstance(component.id, frame.id), 'instance')
    toRoomy()

    graph.updateNode(source.id, { text: 'Changed' })
    graph.syncInstances(component.id)

    expect(graph.getChildren(plain.id)[0].fontSize).toBe(20)
  })

  test('characters binding a size themselves take it at the instance scale', () => {
    const { graph, size, component, frame } = scaledInstance()
    graph.createNode('TEXT', component.id, {
      text: 'Hello world',
      fontSize: 8,
      styleRuns: [
        { start: 6, length: 5, style: { fontSize: 10, boundVariables: { fontSize: size.id } } }
      ]
    })
    graph.syncInstances(component.id)
    const instance = expectDefined(graph.getChildren(frame.id)[0], 'instance')
    const runs = (): SceneNode => graph.getChildren(instance.id)[1]

    reconcileVariableBindings(graph, { subtrees: [frame.id] })

    expect(runs().styleRuns[0].style.fontSize).toBe(30)
  })
})

describe('text style values in a scaled instance', () => {
  function plainStyle(graph: SceneGraph) {
    const page = graph.getPages()[0].id
    return graph.createNodeWithId('style:plain', 'TEXT', page, {
      sharedStyleType: 'TEXT',
      internalOnly: true,
      fontSize: 7,
      lineHeight: px(9),
      letterSpacing: { value: 5, unit: 'PERCENT' },
      paragraphSpacing: 4,
      listSpacing: 2,
      source: { ...createDefaultSourceMetadata(), id: 'style:plain' }
    })
  }

  test('a style applied to a layer gives its lengths at the instance scale', () => {
    const { graph, text } = scaledInstance()
    const style = plainStyle(graph)

    const patch = sharedStylePatch('text', text(), 'style:plain', style)

    expect(patch).toMatchObject({
      fontSize: 21,
      lineHeight: px(27),
      letterSpacing: { value: 5, unit: 'PERCENT' },
      paragraphSpacing: 12,
      listSpacing: 6
    })
  })

  test('a style applied to a text of a detached instance keeps the scale its layers recorded', () => {
    const { graph, text } = scaledInstance()
    const style = plainStyle(graph)
    const detached = text()
    graph.detachInstance(expectDefined(detached.parentId, 'instance'))

    const patch = sharedStylePatch('text', detached, 'style:plain', style)

    expect(patch).toMatchObject({ fontSize: 21, paragraphSpacing: 12 })
  })

  test('a text of a detached instance takes what its style binds at the recorded scale', () => {
    const { graph, text, toRoomy } = scaledInstance()
    const detached = text()
    graph.detachInstance(expectDefined(detached.parentId, 'instance'))

    toRoomy()

    expect(detached.fontSize).toBe(60)
  })

  test('a styled text of a detached instance stays at its scale through a resolve and a variable edit', () => {
    const { graph, collection, size, text } = scaledInstance()
    const detached = text()
    reconcileVariableBindings(graph)
    graph.detachInstance(expectDefined(detached.parentId, 'instance'))

    reconcileVariableBindings(graph)
    const resolved = detached.fontSize
    size.valuesByMode[collection.modes[0].modeId] = 11
    reconcileVariableBindings(graph, { variables: [size.id] })

    expect([resolved, detached.fontSize]).toEqual([30, 33])
  })

  test('characters on a style keep the mode and the scale through a sync', () => {
    const { graph, component, frame, toRoomy } = scaledInstance()
    const source = graph.createNode('TEXT', component.id, {
      text: 'Hello world',
      fontSize: 8,
      styleRuns: [{ start: 0, length: 5, style: { textStyleId: 'style:body', fontSize: 10 } }]
    })
    graph.syncInstances(component.id)
    const instance = expectDefined(graph.getChildren(frame.id)[0], 'instance')
    const runs = (): SceneNode => graph.getChildren(instance.id)[1]
    toRoomy()

    graph.updateNode(source.id, { text: 'Changed text' })
    graph.syncInstances(component.id)

    expect(runs().styleRuns[0].style.fontSize).toBe(60)
  })

  test('a style the component layer takes reaches the synced copy in its mode and scale', () => {
    const { graph, component, frame, toRoomy } = scaledInstance()
    const source = graph.createNode('TEXT', component.id, { text: 'Hi', fontSize: 8 })
    graph.syncInstances(component.id)
    const instance = expectDefined(graph.getChildren(frame.id)[0], 'instance')
    toRoomy()

    graph.updateNode(source.id, { textStyleId: 'style:body', fontSize: 10 })
    graph.syncInstances(component.id)

    expect(graph.getChildren(instance.id)[1].fontSize).toBe(60)
  })
  test('a style the component layer takes alone reaches the synced copy in its mode and scale', () => {
    const { graph, component, frame, toRoomy } = scaledInstance()
    const source = graph.createNode('TEXT', component.id, { text: 'Hi', fontSize: 10 })
    graph.syncInstances(component.id)
    const instance = expectDefined(graph.getChildren(frame.id)[0], 'instance')
    toRoomy()

    graph.updateNode(source.id, { textStyleId: 'style:body' })
    graph.syncInstances(component.id)

    expect(graph.getChildren(instance.id)[1]).toMatchObject({
      textStyleId: 'style:body',
      fontSize: 60,
      letterSpacing: px(6)
    })
  })
})

describe('a text duplicated out of a scaled instance', () => {
  test('takes what its style binds at the scale its own binding keeps', () => {
    const { graph, collection, size, component, frame, text } = scaledInstance()
    const own = graph.createNode('TEXT', component.id, { text: 'Own', fontSize: 10 })
    graph.bindVariable(own.id, 'fontSize', size.id)
    graph.syncInstances(component.id)
    const instance = expectDefined(graph.getChildren(frame.id)[0], 'instance')
    reconcileVariableBindings(graph)
    const page = graph.getPages()[0].id
    const styled = expectDefined(graph.cloneTree(text().id, page), 'styled copy')
    const bound = expectDefined(graph.cloneTree(graph.getChildren(instance.id)[1].id, page), 'copy')

    size.valuesByMode[collection.modes[0].modeId] = 11
    reconcileVariableBindings(graph, { variables: [size.id] })

    expect([styled.fontSize, bound.fontSize]).toEqual([33, 33])
  })
})

describe('characters synced into a nested scaled instance', () => {
  test('take the scale the sync gives the copy', () => {
    const { graph, collection } = styledText()
    const page = graph.getPages()[0].id
    const inner = graph.createNode('COMPONENT', page, { width: 40, height: 20 })
    graph.createNode('TEXT', inner.id, {
      text: 'Hello world',
      fontSize: 14,
      styleRuns: [{ start: 0, length: 5, style: { textStyleId: 'style:body', fontSize: 14 } }]
    })
    const outer = graph.createNode('COMPONENT', page, { width: 80, height: 40 })
    const nested = expectDefined(graph.createInstance(inner.id, outer.id), 'nested')
    rescaleNodeTree(graph, nested.id, 2)
    const frame = graph.createNode('FRAME', page, {
      variableModes: { [collection.id]: collection.modes[0].modeId }
    })
    const placed = expectDefined(graph.createInstance(outer.id, frame.id), 'placed')
    rescaleNodeTree(graph, placed.id, 3)
    const text = (): SceneNode => graph.getChildren(graph.getChildren(placed.id)[0].id)[0]

    rescaleNodeTree(graph, nested.id, 0.5)
    graph.syncInstances(outer.id)

    expect([text().componentScale, text().styleRuns[0].style.fontSize]).toEqual([3, 42])
  })
})

describe('the style index', () => {
  test('follows a style whose ID changes after the index was built', () => {
    const { graph, style } = styledText()
    expect(graph.getSharedStyleNode('style:body', 'TEXT')).toBe(style)

    graph.updateNode(style.id, { source: { ...style.source, id: 'style:renamed' } })

    expect(graph.getSharedStyleNode('style:renamed', 'TEXT')).toBe(style)
    expect(graph.getSharedStyleNode('style:body', 'TEXT')).toBeUndefined()
  })
})
