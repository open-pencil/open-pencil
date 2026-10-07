import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import {
  applyLintFixes,
  createLinter,
  graphFixTarget,
  safeFixes,
  type LintMessage
} from '@open-pencil/core/lint'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { getNodeOrThrow } from '../helpers/assert'

const BLUE = { r: 0.23, g: 0.51, b: 0.96, a: 1 }
const RED = { r: 0.9, g: 0.1, b: 0.1, a: 1 }

function solid(color: typeof BLUE): SceneNode['fills'] {
  return [{ type: 'SOLID', visible: true, opacity: 1, color }]
}

function lint(graph: SceneGraph, rule: string): LintMessage[] {
  return createLinter({ rules: [rule], config: { rules: { [rule]: 'warning' } } }).lintGraph(graph)
    .messages
}

function addBlueVariable(graph: SceneGraph) {
  graph.addCollection({
    id: 'colors',
    name: 'Colors',
    modes: [{ modeId: 'light', name: 'Light' }],
    defaultModeId: 'light',
    variableIds: []
  })
  graph.addVariable({
    id: 'blue',
    name: 'Colors/Blue/500',
    type: 'COLOR',
    collectionId: 'colors',
    valuesByMode: { light: BLUE },
    description: '',
    hiddenFromPublishing: false
  })
}

describe('safe fixes', () => {
  test('bind a matching color variable and resolve the finding', () => {
    const graph = new SceneGraph()
    addBlueVariable(graph)
    const card = graph.createNode('RECTANGLE', graph.getPages()[0].id, { fills: solid(BLUE) })

    const messages = lint(graph, 'no-hardcoded-colors')
    expect(messages[0]?.fix).toEqual({
      kind: 'bind-variable',
      path: 'fills/0/color',
      variableId: 'blue',
      variableName: 'Colors/Blue/500'
    })

    expect(applyLintFixes(graphFixTarget(graph), safeFixes(messages))).toBe(1)
    expect(getNodeOrThrow(graph, card.id).boundVariables['fills/0/color']).toBe('blue')
    expect(lint(graph, 'no-hardcoded-colors')).toEqual([])
  })

  test('skip a binding whose paint changed since the lint run', () => {
    const graph = new SceneGraph()
    addBlueVariable(graph)
    const card = graph.createNode('RECTANGLE', graph.getPages()[0].id, { fills: solid(BLUE) })
    const messages = lint(graph, 'no-hardcoded-colors')

    graph.updateNode(card.id, { fills: solid(RED) })

    expect(applyLintFixes(graphFixTarget(graph), safeFixes(messages))).toBe(0)
    expect(getNodeOrThrow(graph, card.id).boundVariables['fills/0/color']).toBeUndefined()
  })

  test('round only geometry that layout does not recompute', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const free = graph.createNode('RECTANGLE', pageId, { x: 10.4, y: 3, width: 20.6, height: 8 })
    const row = graph.createNode('FRAME', pageId, { layoutMode: 'HORIZONTAL' })
    const item = graph.createNode('RECTANGLE', row.id, { x: 4.5, y: 0, width: 12.3, height: 8 })
    const filler = graph.createNode('RECTANGLE', row.id, {
      width: 40.4,
      height: 8.5,
      layoutGrow: 1
    })
    const label = graph.createNode('TEXT', pageId, {
      x: 2.2,
      width: 40.5,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })

    const fixes = new Map(lint(graph, 'pixel-perfect').map((m) => [m.nodeId, m.fix]))

    expect(fixes.get(free.id)).toEqual({ kind: 'set', changes: { x: 10, width: 21 } })
    expect(fixes.get(item.id)).toEqual({ kind: 'set', changes: { width: 12 } })
    expect(fixes.get(filler.id)).toEqual({ kind: 'set', changes: { height: 9 } })
    expect(fixes.get(label.id)).toEqual({ kind: 'set', changes: { x: 2 } })
  })

  test('leave vector artwork and the parts of a group for review', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const logo = graph.createNode('GROUP', pageId, { x: 40, y: 40, width: 30, height: 30 })
    const part = graph.createNode('ELLIPSE', logo.id, { x: 5.12, width: 20, height: 20 })
    const icon = graph.createNode('VECTOR', pageId, { x: 0.5, width: 16, height: 16 })

    const messages = lint(graph, 'pixel-perfect')

    expect(messages.map((m) => m.nodeId).toSorted()).toEqual([part.id, icon.id].toSorted())
    expect(messages.every((m) => m.fix === undefined)).toBe(true)
  })
})

describe('suggestions', () => {
  test('snap radius to the nearest scale value, or full radius for a pill', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const card = graph.createNode('RECTANGLE', pageId, {
      width: 200,
      height: 100,
      cornerRadius: 10
    })
    const pill = graph.createNode('RECTANGLE', pageId, { width: 80, height: 28, cornerRadius: 14 })

    const suggestions = new Map(
      lint(graph, 'consistent-radius').map((m) => [m.nodeId, m.suggestions])
    )

    expect(suggestions.get(card.id)).toEqual([{ kind: 'set', changes: { cornerRadius: 12 } }])
    expect(suggestions.get(pill.id)).toEqual([{ kind: 'set', changes: { cornerRadius: 9999 } }])
  })

  test('are not safe fixes and merge per layer when applied', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
      layoutMode: 'VERTICAL',
      itemSpacing: 7,
      paddingTop: 13
    })
    const messages = lint(graph, 'consistent-spacing')
    expect(safeFixes(messages)).toEqual([])

    const updates: Array<Partial<SceneNode>> = []
    const target = graphFixTarget(graph)
    const applied = applyLintFixes(
      {
        ...target,
        updateNode: (id, changes) => {
          updates.push(changes)
          target.updateNode(id, changes)
        }
      },
      messages.flatMap((m) => (m.suggestions ?? []).map((fix) => ({ nodeId: m.nodeId, fix })))
    )

    expect(applied).toBe(2)
    expect(updates).toEqual([{ itemSpacing: 8, paddingTop: 12 }])
    expect(getNodeOrThrow(graph, frame.id)).toMatchObject({ itemSpacing: 8, paddingTop: 12 })
  })
})

describe('editor.applyLintFixes', () => {
  test('applies fixes as one undo step', () => {
    const editor = createEditor()
    addBlueVariable(editor.graph)
    const pageId = editor.graph.getPages()[0].id
    const card = editor.graph.createNode('RECTANGLE', pageId, {
      x: 0.5,
      width: 10,
      height: 10,
      fills: solid(BLUE)
    })
    const messages = createLinter({
      rules: ['no-hardcoded-colors', 'pixel-perfect'],
      config: { rules: { 'no-hardcoded-colors': 'warning', 'pixel-perfect': 'warning' } }
    }).lintGraph(editor.graph).messages

    expect(editor.applyLintFixes(safeFixes(messages))).toBe(2)
    expect(getNodeOrThrow(editor.graph, card.id).x).toBe(1)

    editor.undoAction()

    const restored = getNodeOrThrow(editor.graph, card.id)
    expect(restored.x).toBe(0.5)
    expect(restored.boundVariables['fills/0/color']).toBeUndefined()
  })
})

function suggestionRequests(messages: readonly LintMessage[]) {
  return messages.flatMap((m) => (m.suggestions ?? []).map((fix) => ({ nodeId: m.nodeId, fix })))
}

describe('structure suggestions', () => {
  test('convert a group to a frame in place, keeping its layers and look', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const group = graph.createNode('GROUP', pageId, { x: 40, y: 20, width: 30, height: 30 })
    const dot = graph.createNode('ELLIPSE', group.id, { width: 10, height: 10 })

    const messages = lint(graph, 'no-groups')
    expect(messages[0]?.suggestions).toEqual([{ kind: 'convert-to-frame' }])
    expect(safeFixes(messages)).toEqual([])

    expect(applyLintFixes(graphFixTarget(graph), suggestionRequests(messages))).toBe(1)
    const frame = getNodeOrThrow(graph, group.id)
    expect(frame).toMatchObject({ type: 'FRAME', x: 40, y: 20, width: 30, height: 30 })
    expect(frame.childIds).toEqual([dot.id])
    expect(frame.fills).toEqual([])
    expect(frame.clipsContent).toBe(false)
    expect(lint(graph, 'no-groups')).toEqual([])
  })

  test('delete hidden layers once, together with hidden layers inside them', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const panel = graph.createNode('FRAME', pageId, { visible: false })
    const inner = graph.createNode('RECTANGLE', panel.id, { visible: false })
    const shown = graph.createNode('RECTANGLE', pageId)

    const messages = lint(graph, 'no-hidden-layers')
    expect(messages.map((m) => m.suggestions)).toEqual([[{ kind: 'delete' }], [{ kind: 'delete' }]])

    expect(applyLintFixes(graphFixTarget(graph), suggestionRequests(messages))).toBe(2)
    expect(graph.getNode(panel.id)).toBeUndefined()
    expect(graph.getNode(inner.id)).toBeUndefined()
    expect(graph.getNode(shown.id)).toBeDefined()
  })

  test('keep a layer shown again since the check', () => {
    const graph = new SceneGraph()
    const layer = graph.createNode('RECTANGLE', graph.getPages()[0].id, { visible: false })
    const messages = lint(graph, 'no-hidden-layers')

    graph.updateNode(layer.id, { visible: true })

    expect(applyLintFixes(graphFixTarget(graph), suggestionRequests(messages))).toBe(0)
    expect(graph.getNode(layer.id)).toBeDefined()
  })

  test('leave locked layers and the structure of components and instances alone', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const lockedGroup = graph.createNode('GROUP', pageId, { locked: true })
    const lockedHidden = graph.createNode('RECTANGLE', pageId, { visible: false, locked: true })
    const button = graph.createNode('COMPONENT', pageId)
    const icon = graph.createNode('GROUP', button.id)
    const badge = graph.createNode('RECTANGLE', button.id, { visible: false })
    const instance = graph.createNode('INSTANCE', pageId, { componentId: button.id })
    const copy = graph.createNode('RECTANGLE', instance.id, { visible: false })

    const messages = [...lint(graph, 'no-groups'), ...lint(graph, 'no-hidden-layers')]
    // The linter does not look inside instances, so the copy is only checked when applying.
    const reported = [lockedGroup, lockedHidden, icon, badge].map((node) => node.id)
    expect(reported.every((id) => messages.some((m) => m.nodeId === id))).toBe(true)
    expect(messages.every((m) => m.suggestions === undefined)).toBe(true)

    // Requests built elsewhere are checked against the graph as well.
    const requests = [
      { nodeId: lockedGroup.id, fix: { kind: 'convert-to-frame' } as const },
      { nodeId: icon.id, fix: { kind: 'convert-to-frame' } as const },
      { nodeId: lockedHidden.id, fix: { kind: 'delete' } as const },
      { nodeId: copy.id, fix: { kind: 'delete' } as const }
    ]
    expect(applyLintFixes(graphFixTarget(graph), requests)).toBe(0)
    expect(getNodeOrThrow(graph, icon.id).type).toBe('GROUP')
    expect(graph.getNode(copy.id)).toBeDefined()
  })
})

describe('editor structure fixes', () => {
  test('convert and delete as one undo step that restores layers and selection', () => {
    const editor = createEditor()
    const pageId = editor.graph.getPages()[0].id
    const group = editor.graph.createNode('GROUP', pageId, { width: 30, height: 30 })
    editor.graph.createNode('ELLIPSE', group.id, { width: 10, height: 10 })
    const hidden = editor.graph.createNode('RECTANGLE', pageId, { visible: false })
    editor.select([hidden.id, group.id])

    const messages = createLinter({
      rules: ['no-groups', 'no-hidden-layers'],
      config: { rules: { 'no-groups': 'warning', 'no-hidden-layers': 'warning' } }
    }).lintGraph(editor.graph).messages

    expect(editor.applyLintFixes(suggestionRequests(messages))).toBe(2)
    expect(getNodeOrThrow(editor.graph, group.id).type).toBe('FRAME')
    expect(editor.graph.getNode(hidden.id)).toBeUndefined()
    expect([...editor.state.selectedIds]).toEqual([group.id])

    editor.undoAction()

    expect(getNodeOrThrow(editor.graph, group.id).type).toBe('GROUP')
    expect(getNodeOrThrow(editor.graph, hidden.id).visible).toBe(false)
    expect(new Set(editor.state.selectedIds)).toEqual(new Set([hidden.id, group.id]))

    editor.redoAction()

    expect(getNodeOrThrow(editor.graph, group.id).type).toBe('FRAME')
    expect(editor.graph.getNode(hidden.id)).toBeUndefined()
  })
})
