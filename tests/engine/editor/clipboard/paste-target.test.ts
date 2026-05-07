import { describe, expect, test } from 'bun:test'

import { createEditor, type EditorState } from '@open-pencil/core/editor'
import { SceneGraph } from '@open-pencil/core/scene-graph'

import { resolvePasteTarget } from '#core/editor/clipboard/paste-target'

function setup() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const editor = createEditor({ graph, skipInitialGraphSetup: true })
  return { graph, pageId, editor, state: editor.state }
}

function ctx(state: EditorState, graph: SceneGraph) {
  return {
    graph,
    state,
    undo: undefined,
    loadFont: async () => null,
    getViewportSize: () => ({ width: 800, height: 600 }),
    getCk: () => null,
    getRenderer: () => null,
    getTextEditor: () => null,
    requestRender: () => undefined,
    requestRepaint: () => undefined,
    emitEditorEvent: () => undefined,
    setSelectedIds: (ids: Set<string>) => {
      state.selectedIds = ids
    },
    setActiveTool: () => undefined,
    runLayoutForNode: () => undefined,
    subscribeToGraph: () => undefined
  } as never
}

describe('resolvePasteTarget', () => {
  test('returns current page when nothing is selected', () => {
    const { graph, pageId, state } = setup()
    state.selectedIds = new Set()
    expect(resolvePasteTarget(ctx(state, graph))).toBe(pageId)
  })

  test('returns current page when multiple nodes are selected', () => {
    const { graph, pageId, state } = setup()
    const a = graph.createNode('RECTANGLE', pageId, { name: 'A', width: 50, height: 50 })
    const b = graph.createNode('RECTANGLE', pageId, { name: 'B', width: 50, height: 50 })
    state.selectedIds = new Set([a.id, b.id])
    expect(resolvePasteTarget(ctx(state, graph))).toBe(pageId)
  })

  test('returns selected frame when a single frame is selected', () => {
    const { graph, pageId, state } = setup()
    const frame = graph.createNode('FRAME', pageId, { name: 'Container', width: 200, height: 200 })
    state.selectedIds = new Set([frame.id])
    expect(resolvePasteTarget(ctx(state, graph))).toBe(frame.id)
  })

  test('returns selected group when a single group is selected', () => {
    const { graph, pageId, state } = setup()
    const group = graph.createNode('GROUP', pageId, { name: 'Group', width: 200, height: 200 })
    state.selectedIds = new Set([group.id])
    expect(resolvePasteTarget(ctx(state, graph))).toBe(group.id)
  })

  test('returns selected component when a single component is selected', () => {
    const { graph, pageId, state } = setup()
    const comp = graph.createNode('COMPONENT', pageId, { name: 'Comp', width: 100, height: 100 })
    state.selectedIds = new Set([comp.id])
    expect(resolvePasteTarget(ctx(state, graph))).toBe(comp.id)
  })

  test('returns selected section when a single section is selected', () => {
    const { graph, pageId, state } = setup()
    const section = graph.createNode('SECTION', pageId, {
      name: 'Section',
      width: 400,
      height: 300
    })
    state.selectedIds = new Set([section.id])
    expect(resolvePasteTarget(ctx(state, graph))).toBe(section.id)
  })

  test('returns parent frame when a non-container child is selected', () => {
    const { graph, pageId, state } = setup()
    const frame = graph.createNode('FRAME', pageId, { name: 'Parent', width: 200, height: 200 })
    const rect = graph.createNode('RECTANGLE', frame.id, { name: 'Child', width: 50, height: 50 })
    state.selectedIds = new Set([rect.id])
    expect(resolvePasteTarget(ctx(state, graph))).toBe(frame.id)
  })

  test('returns page when a top-level rectangle is selected', () => {
    const { graph, pageId, state } = setup()
    const rect = graph.createNode('RECTANGLE', pageId, { name: 'TopRect', width: 50, height: 50 })
    state.selectedIds = new Set([rect.id])
    expect(resolvePasteTarget(ctx(state, graph))).toBe(pageId)
  })

  test('returns entered container when set', () => {
    const { graph, pageId, state } = setup()
    const frame = graph.createNode('FRAME', pageId, { name: 'Deep', width: 200, height: 200 })
    state.enteredContainerId = frame.id
    state.selectedIds = new Set()
    expect(resolvePasteTarget(ctx(state, graph))).toBe(frame.id)
  })

  test('entered container takes priority over selection', () => {
    const { graph, pageId, state } = setup()
    const frameA = graph.createNode('FRAME', pageId, { name: 'A', width: 200, height: 200 })
    const frameB = graph.createNode('FRAME', pageId, { name: 'B', width: 200, height: 200 })
    state.enteredContainerId = frameA.id
    state.selectedIds = new Set([frameB.id])
    expect(resolvePasteTarget(ctx(state, graph))).toBe(frameA.id)
  })
})
