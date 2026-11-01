import { beforeAll, describe, expect, test } from 'bun:test'

import { registerTestFont } from '#core-tests/helpers/figma-api'

import { createEditor, executeAtomicTool, type DocumentChange } from '@open-pencil/core'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { OpenPencilAPI } from '@open-pencil/core/openpencil-api'
import { ALL_TOOLS, type ToolDef } from '@open-pencil/core/tools'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { captureGraphCheckpoint } from '@open-pencil/scene-graph/checkpoint'

import { diffFields } from '#core/editor/history/diff'
import { isAtomicTool } from '#core/tools/schema'

beforeAll(() => registerTestFont())

/**
 * The contract of `executeAtomicTool`: it records a layer or variable only if the graph reports
 * it, so a tool that writes without reporting would leave an undo step that misses the write. A
 * full-graph diff (`captureGraphCheckpoint`, O(document), tests only) is the oracle.
 */

interface Targets {
  /** Auto-layout row holding `rect` and `text`. */
  frame: string
  rect: string
  text: string
  /**
   * A layer whose position, rotation and constraints the tools may change: inside an instance
   * those cannot be overridden (the tools refuse), so there it is the instance itself.
   */
  placed: string
}

function build() {
  const editor = createEditor()
  const graph = editor.graph
  const figma = new FigmaAPI(graph)
  const current = graph.getPages()[0]
  const other = graph.addPage('Other')
  expect(figma.currentPageId).toBe(current.id)
  graph.createNode('RECTANGLE', current.id, { name: 'Current page rectangle' })

  const collection = figma.variables.createVariableCollection('Tokens')
  const color = figma.variables.createVariable('Brand', collection, 'COLOR')
  color.setValueForMode(collection.defaultModeId, { r: 1, g: 0, b: 0, a: 1 })
  const size = figma.variables.createVariable('Size', collection, 'FLOAT')
  size.setValueForMode(collection.defaultModeId, 8)

  const row = (parentId: string, name: string): Targets => {
    const frame = graph.createNode('FRAME', parentId, {
      name,
      width: 200,
      height: 100,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 4
    })
    const rect = graph.createNode('RECTANGLE', frame.id, {
      name: `${name} rect`,
      width: 40,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const text = graph.createNode('TEXT', frame.id, {
      name: `${name} text`,
      text: 'Hello world',
      fontSize: 14,
      width: 80,
      height: 20
    })
    return { frame: frame.id, rect: rect.id, text: text.id, placed: rect.id }
  }
  const plain = row(other.id, 'Plain')

  const component = graph.createNode('COMPONENT', other.id, { name: 'Card' })
  const inner = row(component.id, 'Inner')
  const instance = graph.createInstance(component.id, other.id)
  if (!instance) throw new Error('Missing instance')
  const [frame] = graph.getChildren(instance.id)
  const [rect, text] = graph.getChildren(frame.id)
  const inInstance: Targets = { frame: frame.id, rect: rect.id, text: text.id, placed: instance.id }
  expect(graph.pageOf(inInstance.rect)).toBe(other.id)
  expect(inInstance.rect).not.toBe(inner.rect)

  // Bound layers, for the variable tools; the binding on an instance layer is its own.
  const api = new OpenPencilAPI(figma)
  for (const targets of [plain, inInstance]) {
    api.bindVariable(targets.rect, 'fills/0/color', color)
    api.bindVariable(targets.rect, 'opacity', size)
  }
  // Undo lays layers out again, so the document starts laid out, as an open one is.
  for (const page of graph.getPages()) editor.runLayoutForNode(page.id)
  return {
    editor,
    figma,
    graph,
    variables: { color: color.id, size: size.id, mode: collection.defaultModeId },
    targets: { plain, 'in an instance': inInstance }
  }
}

type Fixture = ReturnType<typeof build>

/** Arguments of each atomic tool for a set of targets; the key set must be all atomic tools. */
const ARGS: Record<string, (t: Targets, f: Fixture) => Record<string, unknown>> = {
  bind_variable: (t, f) => ({
    node_id: t.rect,
    field: 'cornerRadius',
    variable_id: f.variables.size
  }),
  set_variable: (_t, f) => ({ id: f.variables.color, mode: f.variables.mode, value: '#00ff00' }),
  unbind_variable: (t) => ({ node_id: t.rect, field: 'opacity' }),
  set_text: (t) => ({ id: t.text, text: 'Changed text' }),
  set_font: (t) => ({ id: t.text, family: 'Inter', style: 'Regular', size: 20 }),
  set_font_range: (t) => ({ id: t.text, start: 0, end: 5, size: 22, color: '#ff0000' }),
  set_text_resize: (t) => ({ id: t.text, mode: 'HEIGHT' }),
  set_text_properties: (t) => ({
    id: t.text,
    align_horizontal: 'CENTER',
    align_vertical: 'BOTTOM',
    auto_resize: 'NONE',
    direction: 'RTL',
    text_decoration: 'UNDERLINE'
  }),
  set_rotation: (t) => ({ id: t.placed, angle: 30 }),
  set_opacity: (t) => ({ id: t.rect, value: 0.5 }),
  set_radius: (t) => ({ id: t.rect, radius: 6, top_left: 2 }),
  set_minmax: (t) => ({ id: t.rect, min_width: 10, max_width: 90, min_height: 5, max_height: 80 }),
  set_visible: (t) => ({ id: t.rect, value: false }),
  set_blend: (t) => ({ id: t.rect, mode: 'MULTIPLY' }),
  set_locked: (t) => ({ id: t.rect, value: true }),
  set_stroke_align: (t) => ({ id: t.rect, align: 'OUTSIDE' }),
  set_fill: (t) => ({ id: t.rect, color: '#00ff00' }),
  set_stroke: (t) => ({ id: t.rect, color: '#112233', weight: 2, align: 'CENTER' }),
  set_layout: (t) => ({
    id: t.frame,
    direction: 'VERTICAL',
    spacing: 12,
    padding: 8,
    align: 'CENTER',
    counter_align: 'MAX'
  }),
  set_constraints: (t) => ({ id: t.placed, horizontal: 'STRETCH', vertical: 'CENTER' }),
  set_layout_child: (t) => ({
    id: t.rect,
    sizing_horizontal: 'FILL',
    sizing_vertical: 'FIXED',
    grow: 1,
    align_self: 'STRETCH'
  }),
  update_node: (t) => ({
    id: t.placed,
    x: 5,
    y: 6,
    width: 60,
    height: 30,
    opacity: 0.4,
    corner_radius: 3,
    visible: false,
    name: 'Renamed'
  }),
  set_effects: (t) => ({ id: t.rect, type: 'DROP_SHADOW', color: '#000000', radius: 6 })
}

const atomicTools: ToolDef[] = ALL_TOOLS.filter(isAtomicTool)

/** Ids whose fields, or variables whose record, differ from the checkpoint. */
function changedSince(graph: SceneGraph, before: ReturnType<typeof captureGraphCheckpoint>) {
  const nodes = [...before.nodes].flatMap(([id, previous]) => {
    const current = graph.getNode(id)
    return !current || diffFields(id, previous, current) ? [id] : []
  })
  const variables = [...before.variables].flatMap(([id, previous]) => {
    const current = graph.variables.get(id)
    return !current || diffFields(id, previous, current) ? [id] : []
  })
  return { nodes, variables }
}

describe('atomic tool contract', () => {
  test('every atomic tool has arguments, and only atomic tools do', () => {
    expect(Object.keys(ARGS).toSorted()).toEqual(atomicTools.map((def) => def.name).toSorted())
  })

  const cases = atomicTools.flatMap((def) =>
    (['plain', 'in an instance'] as const).map((kind) => [def.name, kind] as const)
  )

  test.each(cases)('%s on a layer on another page: %s', (name, kind) => {
    const def = atomicTools.find((candidate) => candidate.name === name)
    const args = ARGS[name]
    if (!def || !args) throw new Error(`No arguments for ${name}`)
    const fixture = build()
    const { editor, figma, graph } = fixture
    const targets = fixture.targets[kind]
    const before = captureGraphCheckpoint(graph)
    let change: DocumentChange | undefined
    const result = executeAtomicTool(editor, figma, def, args(targets, fixture), {
      onRecorded: (recorded) => {
        change = recorded
      }
    })
    expect(result).not.toHaveProperty('error')
    if (!change) throw new Error('Nothing was recorded')

    const changed = changedSince(graph, before)
    // The tool must do something, or the contract proves nothing.
    expect(changed.nodes.length + changed.variables.length).toBeGreaterThan(0)
    const updated = new Set(change.updated.map((update) => update.id))
    const variables = new Set(change.variables.map((record) => record.id))
    expect(changed.nodes.filter((id) => !updated.has(id))).toEqual([])
    expect(changed.variables.filter((id) => !variables.has(id))).toEqual([])

    editor.undo.undo()
    expect(graph.nodes.size).toBe(before.nodes.size)
    expect(graph.variables.size).toBe(before.variables.size)
    expect(changedSince(graph, before)).toEqual({ nodes: [], variables: [] })
  })
})
