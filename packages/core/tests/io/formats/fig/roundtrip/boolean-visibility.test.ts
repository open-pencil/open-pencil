import { expect, test } from 'bun:test'

import { readFixtureArrayBuffer } from '#core-tests/helpers/fig/fixtures'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor/create'
import { FigmaAPI } from '#core/figma-api'
import { exportFigFile, parseFigFile } from '#core/io'
import { populateFigPage, readerDiagnostics } from '#core/kiwi/fig/session/document-state'
import { getComponents } from '#core/tools/read/components'

function boundIcons(graph: SceneGraph) {
  return [...graph.getAllNodes()].filter((node) => node.name === 'Icon_2')
}

function visibilityVariable(graph: SceneGraph) {
  const variable = [...graph.variables.values()].find((value) => value.name === 'visible_1')
  if (!variable) throw new Error('Missing visibility variable')
  const collection = graph.variableCollections.get(variable.collectionId)
  if (!collection) throw new Error('Missing visibility collection')
  return { variable, collection }
}

test('a Figma IS_TRUTHY binding survives lazy page loading and repeated component discovery', async () => {
  const graph = await parseFigFile(readFixtureArrayBuffer('boolean-visibility.fig'), {
    populate: 'none'
  })
  expect(boundIcons(graph)).toHaveLength(0)
  const page = graph.getPages()[0]
  if (!page) throw new Error('Missing page')
  expect(populateFigPage(graph, page.id)).toBe(true)
  const figma = new FigmaAPI(graph)
  for (let index = 0; index < 2; index++) {
    expect(await getComponents.execute(figma, { name: 'Button' })).toMatchObject({
      count: 1,
      components: [{ name: 'Button', type: 'COMPONENT' }]
    })
  }
  expect(readerDiagnostics(graph)).toEqual([])
  expect([...graph.getAllNodes()].filter((node) => node.type === 'INSTANCE')).toHaveLength(2)
  expect(boundIcons(graph)).toHaveLength(3)
  const { variable } = visibilityVariable(graph)
  for (const icon of boundIcons(graph)) {
    expect(icon.boundVariables.visible).toBe(variable.id)
    expect(icon.visible).toBe(false)
  }
})

test('Boolean visibility updates the definition and both instances, with undo and save/reopen', async () => {
  let graph = await parseFigFile(readFixtureArrayBuffer('boolean-visibility.fig'))
  const editor = createEditor({ graph })
  try {
    const { variable, collection } = visibilityVariable(graph)
    const otherVisibility = [...graph.getAllNodes()]
      .filter((node) => node.name === 'Icon' || node.name === 'Label')
      .map((node) => [node.id, node.visible])
    editor.updateVariableValue(variable.id, collection.defaultModeId, true)
    expect(boundIcons(graph).map((node) => node.visible)).toEqual([true, true, true])
    editor.undo.undo()
    expect(boundIcons(graph).map((node) => node.visible)).toEqual([false, false, false])
    editor.undo.redo()
    expect(boundIcons(graph).map((node) => node.visible)).toEqual([true, true, true])
    expect(
      [...graph.getAllNodes()]
        .filter((node) => node.name === 'Icon' || node.name === 'Label')
        .map((node) => [node.id, node.visible])
    ).toEqual(otherVisibility)

    for (let cycle = 0; cycle < 2; cycle++) {
      graph = await parseFigFile((await exportFigFile(graph)).slice().buffer)
      const restoredVariable = visibilityVariable(graph).variable
      expect(boundIcons(graph)).toHaveLength(3)
      for (const icon of boundIcons(graph)) {
        expect(icon.visible).toBe(true)
        expect(icon.boundVariables.visible).toBe(restoredVariable.id)
      }
    }
    const restored = createEditor({ graph })
    try {
      const { variable: value, collection: modes } = visibilityVariable(graph)
      restored.updateVariableValue(value.id, modes.defaultModeId, false)
      expect(boundIcons(graph).map((node) => node.visible)).toEqual([false, false, false])
    } finally {
      restored.dispose()
    }
  } finally {
    editor.dispose()
  }
})

test('an instance-specific Boolean mode survives save/reopen independently of its definition', async () => {
  const graph = await parseFigFile(readFixtureArrayBuffer('boolean-visibility.fig'))
  const editor = createEditor({ graph })
  try {
    const { variable, collection } = visibilityVariable(graph)
    graph.addMode(collection.id, 'shown', 'Shown')
    editor.updateVariableValue(variable.id, 'shown', true)
    const instance = [...graph.getAllNodes()].find((node) => node.type === 'INSTANCE')
    if (!instance) throw new Error('Missing instance')
    editor.updateNodeWithUndo(instance.id, { variableModes: { [collection.id]: 'shown' } })
    expect(
      boundIcons(graph)
        .map((node) => node.visible)
        .sort()
    ).toEqual([false, false, true])
    const restored = await parseFigFile((await exportFigFile(graph)).slice().buffer)
    expect(
      boundIcons(restored)
        .map((node) => node.visible)
        .sort()
    ).toEqual([false, false, true])
    expect(boundIcons(restored).every((node) => node.boundVariables.visible)).toBe(true)
    const restoredEditor = createEditor({ graph: restored })
    try {
      const shownIcon = boundIcons(restored).find((node) => node.visible)
      if (!shownIcon?.parentId) throw new Error('Missing instance with the shown mode')
      restoredEditor.updateNodeWithUndo(shownIcon.parentId, { variableModes: {} })
      expect(boundIcons(restored).map((node) => node.visible)).toEqual([false, false, false])
      const cleared = await parseFigFile((await exportFigFile(restored)).slice().buffer)
      expect(boundIcons(cleared).map((node) => node.visible)).toEqual([false, false, false])
    } finally {
      restoredEditor.dispose()
    }
  } finally {
    editor.dispose()
  }
})
