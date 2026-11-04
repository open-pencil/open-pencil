import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '#core/editor/create'
import { FigmaAPI } from '#core/figma-api'
import { exportFigFile, parseFigFile } from '#core/io/formats/fig'
import { populateFigPage, readerDiagnostics } from '#core/kiwi/fig/session/document-state'
import { getComponents } from '#core/tools/read/components'

import { parseFigBuffer } from '@open-pencil/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

/**
 * A component whose icon shows by a boolean variable and whose badge shows by a text variable,
 * placed twice. Figma's layer panel binds visibility to either type; the plugin API, which
 * `bindVariable` follows, takes booleans only, so the text binding is set directly.
 */
async function buttonFile(): Promise<Uint8Array> {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const collection = graph.createCollection('Visibility')
  const shown = graph.createVariable('visible_1', 'BOOLEAN', collection.id, false)
  const state = graph.createVariable('state', 'STRING', collection.id, 'off')
  const button = graph.createNode('COMPONENT', page, { name: 'Button', width: 120, height: 40 })
  const icon = graph.createNode('FRAME', button.id, { name: 'Icon_2', width: 16, height: 16 })
  graph.bindVariable(icon.id, 'visible', shown.id)
  graph.updateNode(icon.id, { visible: false })
  graph.createNode('FRAME', button.id, {
    name: 'Badge',
    width: 8,
    height: 8,
    visible: false,
    boundVariables: { visible: state.id }
  })
  graph.createNode('TEXT', button.id, { name: 'Label', text: 'Button' })
  expectDefined(graph.createInstance(button.id, page))
  expectDefined(graph.createInstance(button.id, page))
  return exportFigFile(graph)
}

function reopen(file: Uint8Array) {
  return parseFigFile(file.slice().buffer)
}

function layers(graph: SceneGraph, name: string) {
  return [...graph.getAllNodes()].filter((node) => node.name === name)
}

function variable(graph: SceneGraph, name: string) {
  const found = expectDefined([...graph.variables.values()].find((value) => value.name === name))
  const collection = expectDefined(graph.variableCollections.get(found.collectionId))
  return { variable: found, mode: collection.defaultModeId, collection }
}

test('visibility bound to a boolean or text variable is written as IS_TRUTHY, as Figma does', async () => {
  const records = parseFigBuffer((await buttonFile()).slice().buffer).nodeChanges
  const visibility = records.flatMap((record) =>
    (record.parameterConsumptionMap?.entries ?? [])
      .filter((entry) => entry.variableField === 'VISIBLE')
      .map((entry) => ({ name: record.name, data: entry.variableData }))
  )
  expect(visibility.map(({ name, data }) => [name, data?.resolvedDataType])).toEqual([
    ['Icon_2', 'BOOLEAN'],
    ['Badge', 'BOOLEAN']
  ])
  expect(
    visibility.map(({ data }) => {
      const expression = data?.value?.expressionValue
      return [expression?.expressionFunction, expression?.expressionArguments?.[0]?.resolvedDataType]
    })
  ).toEqual([
    ['IS_TRUTHY', 'BOOLEAN'],
    ['IS_TRUTHY', 'STRING']
  ])
})

test('an IS_TRUTHY binding survives lazy page loading and repeated component discovery', async () => {
  const graph = await parseFigFile((await buttonFile()).slice().buffer, { populate: 'none' })
  expect(layers(graph, 'Icon_2')).toHaveLength(0)
  expect(populateFigPage(graph, graph.getPages()[0].id)).toBe(true)
  const figma = new FigmaAPI(graph)
  for (let index = 0; index < 2; index++) {
    expect(await getComponents.execute(figma, { name: 'Button' })).toMatchObject({
      count: 1,
      components: [{ name: 'Button', type: 'COMPONENT' }]
    })
  }
  expect(readerDiagnostics(graph)).toEqual([])
  const shown = variable(graph, 'visible_1').variable
  const state = variable(graph, 'state').variable
  expect(layers(graph, 'Icon_2').map((node) => [node.boundVariables.visible, node.visible])).toEqual(
    Array.from({ length: 3 }, () => [shown.id, false])
  )
  expect(layers(graph, 'Badge').map((node) => [node.boundVariables.visible, node.visible])).toEqual(
    Array.from({ length: 3 }, () => [state.id, false])
  )
})

test('boolean visibility updates the definition and both instances, with undo and save/reopen', async () => {
  let graph = await reopen(await buttonFile())
  const editor = createEditor({ graph })
  try {
    const { variable: shown, mode } = variable(graph, 'visible_1')
    editor.updateVariableValue(shown.id, mode, true)
    expect(layers(graph, 'Icon_2').map((node) => node.visible)).toEqual([true, true, true])
    editor.undo.undo()
    expect(layers(graph, 'Icon_2').map((node) => node.visible)).toEqual([false, false, false])
    editor.undo.redo()
    expect(layers(graph, 'Icon_2').map((node) => node.visible)).toEqual([true, true, true])
    expect(layers(graph, 'Label').map((node) => node.visible)).toEqual([true, true, true])

    for (let cycle = 0; cycle < 2; cycle++) {
      graph = await reopen(await exportFigFile(graph))
      const restored = variable(graph, 'visible_1').variable
      expect(
        layers(graph, 'Icon_2').map((node) => [node.boundVariables.visible, node.visible])
      ).toEqual(Array.from({ length: 3 }, () => [restored.id, true]))
    }
  } finally {
    editor.dispose()
  }
})

test('text visibility shows the layer when the text reads as true, as Figma does', async () => {
  let graph = await reopen(await buttonFile())
  const editor = createEditor({ graph })
  try {
    const { variable: state, mode } = variable(graph, 'state')
    const badges = () => layers(graph, 'Badge').map((node) => node.visible)
    for (const [text, visible] of [
      ['yes', true],
      [' No ', false],
      ['0', true],
      ['', false],
      [' ', true],
      ['FALSE', false],
      ['on', true]
    ] as const) {
      editor.updateVariableValue(state.id, mode, text)
      expect(badges()).toEqual([visible, visible, visible])
    }
    graph = await reopen(await exportFigFile(graph))
    expect(badges()).toEqual([true, true, true])
  } finally {
    editor.dispose()
  }
})

test('an instance-specific mode survives save/reopen independently of its definition', async () => {
  const graph = await reopen(await buttonFile())
  const editor = createEditor({ graph })
  try {
    const { variable: shown, collection } = variable(graph, 'visible_1')
    graph.addMode(collection.id, 'shown', 'Shown')
    editor.updateVariableValue(shown.id, 'shown', true)
    const instance = expectDefined([...graph.getAllNodes()].find((node) => node.type === 'INSTANCE'))
    editor.updateNodeWithUndo(instance.id, { variableModes: { [collection.id]: 'shown' } })
    const visibility = (target: SceneGraph) =>
      layers(target, 'Icon_2')
        .map((node) => node.visible)
        .sort()
    expect(visibility(graph)).toEqual([false, false, true])
    const restored = await reopen(await exportFigFile(graph))
    expect(visibility(restored)).toEqual([false, false, true])
    expect(layers(restored, 'Icon_2').every((node) => node.boundVariables.visible)).toBe(true)
    const restoredEditor = createEditor({ graph: restored })
    try {
      const shownIcon = expectDefined(layers(restored, 'Icon_2').find((node) => node.visible))
      restoredEditor.updateNodeWithUndo(expectDefined(shownIcon.parentId), { variableModes: {} })
      expect(visibility(restored)).toEqual([false, false, false])
      const cleared = await reopen(await exportFigFile(restored))
      expect(visibility(cleared)).toEqual([false, false, false])
    } finally {
      restoredEditor.dispose()
    }
  } finally {
    editor.dispose()
  }
})
