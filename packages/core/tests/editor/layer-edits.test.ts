import { describe, expect, test } from 'bun:test'

import {
  createEditor,
  executeAtomicTool,
  FixedLayersError,
  MoveOnlyLayersError,
  ReadOnlyDocumentError,
  resolveEditorProfile
} from '@open-pencil/core'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { getNodeOrThrow } from '@open-pencil/test-support/assert'

import { MOVE_ACTIONS, PATH_EDIT_ACTIONS, POSITION_ACTIONS } from '#core/editor/read-only/actions'

/** An editor with one open path, a line from (0, 0) to (100, 0), whose layers the host keeps. */
function setup() {
  const editor = createEditor()
  const path = editor.graph.createNode('VECTOR', editor.state.currentPageId, {
    name: 'Path',
    width: 100,
    height: 1,
    vectorNetwork: {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    }
  })
  editor.select([path.id])
  editor.setHostRestrictions({ layerEdits: 'none' })
  return { editor, path }
}

describe('layers the host keeps as they are', () => {
  test('every path edit action is an editor action', () => {
    const { editor } = setup()
    const actions = new Set(
      Object.entries(Object.getOwnPropertyDescriptors(editor))
        .filter(([, descriptor]) => typeof descriptor.value === 'function')
        .map(([name]) => name)
    )
    expect([...PATH_EDIT_ACTIONS].filter((name) => !actions.has(name))).toEqual([])
  })

  test('refuses changes to layers and leaves them as they were', () => {
    const { editor, path } = setup()

    expect(() => editor.setOpacity(0.5)).toThrow(FixedLayersError)
    expect(() => editor.nudgeSelected(10, 0)).toThrow(FixedLayersError)
    expect(() => editor.deleteSelected()).toThrow(FixedLayersError)
    expect(() => editor.duplicateSelected()).toThrow(FixedLayersError)
    expect(() => editor.addPage('Second')).toThrow(FixedLayersError)

    expect(getNodeOrThrow(editor.graph, path.id)).toMatchObject({ x: 0, opacity: 1 })
    expect(editor.graph.getChildren(editor.state.currentPageId)).toHaveLength(1)
  })

  test('still reshapes the path in vector edit mode, and undoes it', () => {
    const { editor, path } = setup()
    editor.enterNodeEditMode(path.id)
    editor.nodeEditSetHandle(0, 'tangentStart', { x: 30, y: 40 })
    editor.exitNodeEditMode(true)
    const tangent = () => getNodeOrThrow(editor.graph, path.id).vectorNetwork?.segments[0]
    expect(tangent()?.tangentStart).toEqual({ x: 30, y: 40 })

    // The first undo opens the path again, as in Figma; the next takes back the change.
    editor.undoAction()
    editor.undoAction()
    expect(tangent()?.tangentStart).toEqual({ x: 0, y: 0 })
  })

  test('agents cannot edit through atomic tools', () => {
    const { editor, path } = setup()
    const setOpacity = ALL_TOOLS.find((tool) => tool.name === 'set_opacity')
    if (!setOpacity) throw new Error('set_opacity is missing')
    expect(() =>
      executeAtomicTool(editor, new FigmaAPI(editor.graph), setOpacity, { id: path.id, value: 0.5 })
    ).toThrow(FixedLayersError)
  })

  test('a read-only document keeps its layers too, and edits them again once the host allows', () => {
    const editor = createEditor()
    editor.setReadOnly(true)
    expect(resolveEditorProfile(editor.state).layerEdits).toBe('none')
    editor.setReadOnly(false)

    const { editor: kept, path } = setup()
    kept.setHostRestrictions({ layerEdits: 'all' })
    kept.setOpacity(0.5)
    expect(getNodeOrThrow(kept.graph, path.id).opacity).toBe(0.5)
  })
})

describe('history while layers are kept', () => {
  test('undo and redo stop at the changes made before layers were fixed', () => {
    const editor = createEditor()
    const rect = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      width: 40,
      height: 40
    })
    editor.select([rect.id])
    editor.setOpacity(0.5)
    editor.setOpacity(0.25)
    editor.undoAction()
    editor.setHostRestrictions({ layerEdits: 'none' })

    expect(() => editor.undoAction()).toThrow(FixedLayersError)
    expect(() => editor.redoAction()).toThrow(FixedLayersError)
    expect(() => editor.undo.undo()).toThrow(FixedLayersError)
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(0.5)

    editor.setHostRestrictions({ layerEdits: 'all' })
    editor.undoAction()
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(1)
  })

  test('undo and redo still step through what was done since', () => {
    const { editor, path } = setup()
    editor.enterNodeEditMode(path.id)
    editor.nodeEditSetHandle(0, 'tangentStart', { x: 30, y: 40 })
    editor.exitNodeEditMode(true)
    const tangent = () => getNodeOrThrow(editor.graph, path.id).vectorNetwork?.segments[0]

    editor.undoAction()
    editor.undoAction()
    expect(tangent()?.tangentStart).toEqual({ x: 0, y: 0 })
    expect(() => editor.undoAction()).not.toThrow()
    editor.redoAction()
    editor.redoAction()
    expect(tangent()?.tangentStart).toEqual({ x: 30, y: 40 })
  })

  test('fixing layers ends a nudge in progress', () => {
    const editor = createEditor()
    const rect = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      width: 40,
      height: 40
    })
    editor.select([rect.id])
    editor.nudgeSelected(5, 0)
    editor.setHostRestrictions({ layerEdits: 'none' })
    expect(getNodeOrThrow(editor.graph, rect.id).x).toBe(5)
    expect(() => editor.undoAction()).toThrow(FixedLayersError)
  })
})

/** Two squares the host lets the person only move. */
function movable() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const a = editor.graph.createNode('RECTANGLE', pageId, { x: 0, width: 40, height: 40 })
  const b = editor.graph.createNode('RECTANGLE', pageId, { x: 20, width: 40, height: 40 })
  editor.select([a.id])
  editor.setHostRestrictions({ layerEdits: 'move' })
  return { editor, a, b }
}

describe('layers the host lets only move', () => {
  test('every move and position action is an editor action', () => {
    const { editor } = movable()
    const actions = new Set(
      Object.entries(Object.getOwnPropertyDescriptors(editor))
        .filter(([, descriptor]) => typeof descriptor.value === 'function')
        .map(([name]) => name)
    )
    expect([...MOVE_ACTIONS, ...POSITION_ACTIONS].filter((name) => !actions.has(name))).toEqual([])
  })

  test('moves layers, and refuses every other change', () => {
    const { editor, a } = movable()
    editor.nudgeSelected(5, 0)
    editor.updateNode(a.id, { y: 7 })
    expect(getNodeOrThrow(editor.graph, a.id)).toMatchObject({ x: 5, y: 7 })

    expect(() => editor.updateNode(a.id, { x: 9, width: 80 })).toThrow(MoveOnlyLayersError)
    expect(() => editor.setOpacity(0.5)).toThrow(MoveOnlyLayersError)
    expect(() => editor.deleteSelected()).toThrow(MoveOnlyLayersError)
    expect(() => editor.duplicateSelected()).toThrow(MoveOnlyLayersError)
    expect(() => editor.enterNodeEditMode(a.id)).toThrow(MoveOnlyLayersError)
    expect(getNodeOrThrow(editor.graph, a.id)).toMatchObject({ x: 5, width: 40, opacity: 1 })
    expect(resolveEditorProfile(editor.state).layerEdits).toBe('move')
  })

  test("runs the host's own edits, which undo takes back, but not in a read-only document", () => {
    const { editor, a, b } = movable()
    editor.select([a.id, b.id])
    editor.asHost(() => editor.booleanOperationSelected('UNION'))
    const [union] = editor.graph.getChildren(editor.state.currentPageId)
    expect(union?.type).toBe('BOOLEAN_OPERATION')

    editor.undoAction()
    expect(editor.graph.getChildren(editor.state.currentPageId).map((node) => node.id)).toEqual([
      a.id,
      b.id
    ])

    editor.setReadOnly(true)
    expect(() => editor.asHost(() => editor.setOpacity(0.5))).toThrow(ReadOnlyDocumentError)
  })

  test('runs only synchronous host edits, and swallows what the promise does after', async () => {
    const { editor } = movable()
    let rejected = false
    const onRejection = () => {
      rejected = true
    }
    process.on('unhandledRejection', onRejection)
    const ran = () =>
      editor.asHost(async () => {
        await Promise.resolve()
        editor.setOpacity(0.5)
      })
    expect(ran).toThrow(TypeError)
    await new Promise((resolve) => {
      setTimeout(resolve, 10)
    })
    process.off('unhandledRejection', onRejection)
    expect(rejected).toBe(false)
  })

  test('undo stops at the changes made before layers could only move', () => {
    const editor = createEditor()
    const rect = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      width: 40,
      height: 40
    })
    editor.select([rect.id])
    editor.setOpacity(0.5)
    editor.setHostRestrictions({ layerEdits: 'move' })
    editor.nudgeSelected(5, 0)

    editor.undoAction()
    expect(getNodeOrThrow(editor.graph, rect.id).x).toBe(0)
    expect(() => editor.undoAction()).toThrow(MoveOnlyLayersError)
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(0.5)
  })
})
