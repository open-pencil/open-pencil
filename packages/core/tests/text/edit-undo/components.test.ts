import { describe, test, expect } from 'bun:test'

import { setupTextEdit } from '#core-tests/helpers/text/edit'

import type { SceneGraph } from '@open-pencil/scene-graph'
import { getInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'
import { expectDefined, getNodeOrThrow } from '@open-pencil/test-support/assert'

describe('text edit undo in an instance', () => {
  test('keeps an empty text override inside an instance through sync and undo', () => {
    const { graph, undo, textEditor, actions } = setupTextEdit()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id, {
      width: 100,
      height: 20
    })
    graph.createNode('TEXT', component.id, {
      text: 'Confidential',
      width: 100,
      height: 20
    })
    const instance = expectDefined(graph.createInstance(component.id, page.id), 'instance')
    const instanceText = getNodeOrThrow(graph, instance.childIds[0])

    actions.startTextEditing(instanceText.id)
    textEditor.selectAll()
    textEditor.backspace(instanceText)
    actions.commitTextEdit()

    expect(getNodeOrThrow(graph, instanceText.id).text).toBe('')
    expect(
      getInstanceOverride(
        getNodeOrThrow(graph, instance.id).instanceOverrides,
        instance.id,
        instanceText.id,
        'text'
      )
    ).toBe('')
    graph.syncInstances(component.id)
    expect(getNodeOrThrow(graph, instanceText.id).text).toBe('')

    undo.undo()
    expect(getNodeOrThrow(graph, instanceText.id).text).toBe('Confidential')
    expect(
      getInstanceOverride(
        getNodeOrThrow(graph, instance.id).instanceOverrides,
        instance.id,
        instanceText.id,
        'text'
      )
    ).toBeUndefined()

    undo.redo()
    graph.syncInstances(component.id)
    expect(getNodeOrThrow(graph, instanceText.id).text).toBe('')
  })

  test('does not create a text override for a style-only instance edit', () => {
    const { graph, textEditor, actions } = setupTextEdit()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id, { width: 100, height: 20 })
    graph.createNode('TEXT', component.id, { text: 'Label', width: 100, height: 20 })
    const instance = expectDefined(graph.createInstance(component.id, page.id), 'instance')
    const instanceText = getNodeOrThrow(graph, instance.childIds[0])

    actions.startTextEditing(instanceText.id)
    const state = expectDefined(textEditor.state, 'text editor state')
    graph.updateNode(instanceText.id, {
      styleRuns: [{ start: 0, length: state.text.length, style: { fontWeight: 700 } }]
    })
    actions.commitTextEdit()

    expect(
      getInstanceOverride(
        getNodeOrThrow(graph, instance.id).instanceOverrides,
        instance.id,
        instanceText.id,
        'text'
      )
    ).toBeUndefined()
  })
})

describe('editing text a component property drives', () => {
  function boundComponent(graph: SceneGraph) {
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id, {
      width: 100,
      height: 40,
      componentPropertyDefinitions: [
        { id: '10:1', name: 'Label', type: 'TEXT', defaultValue: 'Buy' }
      ]
    })
    const reference = [{ propertyId: '10:1', field: 'TEXT' as const }]
    const label = graph.createNode('TEXT', component.id, {
      text: 'Buy',
      width: 100,
      height: 20,
      componentPropertyReferences: reference
    })
    const caption = graph.createNode('TEXT', component.id, {
      text: 'Buy',
      width: 100,
      height: 20,
      componentPropertyReferences: reference
    })
    return { page, component, label, caption }
  }

  test('in the main component, the text becomes the default every linked layer shows', () => {
    const { graph, undo, textEditor, actions } = setupTextEdit()
    const { component, label, caption } = boundComponent(graph)

    actions.startTextEditing(label.id)
    textEditor.insert(' now', label)
    actions.commitTextEdit()

    const definition = () => getNodeOrThrow(graph, component.id).componentPropertyDefinitions[0]
    expect(definition()?.defaultValue).toBe('Buy now')
    expect(getNodeOrThrow(graph, caption.id).text).toBe('Buy now')

    undo.undo()
    expect(definition()?.defaultValue).toBe('Buy')
    expect(getNodeOrThrow(graph, label.id).text).toBe('Buy')
    expect(getNodeOrThrow(graph, caption.id).text).toBe('Buy')
    expect(undo.canUndo).toBe(false)
  })

  test("in an instance, the text becomes that instance's value for the property", () => {
    const { graph, undo, textEditor, actions } = setupTextEdit()
    const { page, component } = boundComponent(graph)
    const instance = expectDefined(graph.createInstance(component.id, page.id), 'instance')
    const [label, caption] = instance.childIds.map((id) => getNodeOrThrow(graph, id))

    actions.startTextEditing(label.id)
    textEditor.insert(' later', label)
    actions.commitTextEdit()

    expect(getNodeOrThrow(graph, instance.id).componentPropertyAssignments['10:1']).toBe(
      'Buy later'
    )
    expect(getNodeOrThrow(graph, caption.id).text).toBe('Buy later')
    expect(getNodeOrThrow(graph, component.id).componentPropertyDefinitions[0]?.defaultValue).toBe(
      'Buy'
    )

    undo.undo()
    expect(getNodeOrThrow(graph, instance.id).componentPropertyAssignments).toEqual({})
    expect(getNodeOrThrow(graph, label.id).text).toBe('Buy')
    expect(getNodeOrThrow(graph, caption.id).text).toBe('Buy')
  })

  test('typing over text a variable decides lets go of the variable in the same step', () => {
    const { graph, undo, textEditor, textNode, actions } = setupTextEdit()
    const collection = graph.createCollection('Copy')
    const count = graph.createVariable('count', 'FLOAT', collection.id, 3)
    graph.bindVariable(textNode.id, 'text', count.id)
    graph.updateNode(textNode.id, { text: '3' })

    actions.startTextEditing(textNode.id)
    textEditor.insert(' items', getNodeOrThrow(graph, textNode.id))
    actions.commitTextEdit()

    expect(getNodeOrThrow(graph, textNode.id)).toMatchObject({
      text: '3 items',
      boundVariables: {}
    })
    undo.undo()
    expect(getNodeOrThrow(graph, textNode.id)).toMatchObject({
      text: '3',
      boundVariables: { text: count.id }
    })
    expect(undo.canUndo).toBe(false)
  })
})
