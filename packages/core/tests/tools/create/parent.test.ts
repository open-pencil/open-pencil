import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { ALL_TOOLS, type ToolDef } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

const io = new IORegistry(BUILTIN_IO_FORMATS)

/** Mutating tools that build or move layers under a `parent_id`. */
const parentTools = ALL_TOOLS.filter(
  (def) => def.mutates && 'parent_id' in (def.input as { entries: object }).entries
)

interface Fixture {
  figma: FigmaAPI
  /** A layer of the instance that comes from its component. */
  locked: string
  /** The instance's copy of a slot frame, whose content the instance owns. */
  slot: string
  /** A layer on the page, for tools that move one. */
  loose: string
}

type ArgsFor = (parent: string, f: Fixture) => Record<string, unknown>

/** Each tool's arguments for `parent`; the key set must be every tool that takes a parent. */
const ARGS: Partial<Record<string, ArgsFor>> = {
  create_shape: (parent) => ({
    type: 'RECTANGLE',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    parent_id: parent
  }),
  create_vector: (parent) => ({ x: 0, y: 0, path: 'M0 0 L10 10', parent_id: parent }),
  create_slice: (parent) => ({ x: 0, y: 0, width: 10, height: 10, parent_id: parent }),
  reparent_node: (parent, f) => ({ id: f.loose, parent_id: parent }),
  render: (parent) => ({ jsx: '<Frame w={20} h={20} bg="#f00" />', parent_id: parent }),
  import_svg: (parent) => ({
    svg: '<svg width="10" height="10"><rect width="10" height="10"/></svg>',
    parent_id: parent
  }),
  import_mermaid: (parent) => ({ mermaid: 'graph TD; A-->B', parent_id: parent }),
  insert_icon: (parent) => ({ name: 'lucide:heart', parent_id: parent }),
  insert_library_component: (parent) => ({
    library_id: 'library',
    asset_key: 'asset',
    parent_id: parent
  })
}

/** Tools that need more than the document to succeed, such as a library catalog. */
const NEEDS_SERVICES = new Set(['insert_library_component'])

const cases = parentTools.flatMap((def) => {
  const args = ARGS[def.name]
  return args ? [[def.name, def, args] as const] : []
})

function build(): Fixture {
  const figma = new FigmaAPI(new SceneGraph())
  const component = figma.createComponent()
  const body = figma.createFrame()
  component.appendChild(body)
  body.appendChild(figma.createRectangle())
  const slot = figma.createFrame()
  component.appendChild(slot)
  const createSlot = ALL_TOOLS.find((def) => def.name === 'create_slot')
  if (!createSlot) throw new Error('No create_slot tool')
  createSlot.execute(figma, { id: slot.id })
  const instance = component.createInstance()
  const [lockedCopy, slotCopy] = instance.children
  return { figma, locked: lockedCopy.id, slot: slotCopy.id, loose: figma.createRectangle().id }
}

async function run(def: ToolDef, figma: FigmaAPI, args: Record<string, unknown>) {
  try {
    const result: unknown = await def.execute(figma, args)
    const error = result && typeof result === 'object' && 'error' in result ? result.error : null
    if (error === null) return { error: null }
    return { error: typeof error === 'string' ? error : JSON.stringify(error) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

describe('tools that take a parent', () => {
  test('every tool that takes a parent has arguments here', () => {
    expect(Object.keys(ARGS).toSorted()).toEqual(parentTools.map((def) => def.name).toSorted())
  })

  test.each(cases)(
    '%s refuses a parent inside an instance and leaves the document as it was',
    async (_name: string, def: ToolDef, args: ArgsFor) => {
      const fixture = build()
      const { graph } = fixture.figma
      const before = [...graph.nodes.keys()]
      const { error } = await run(def, fixture.figma, args(fixture.locked, fixture))
      expect(error).toContain('New parent is an instance or is inside of an instance')
      expect([...graph.nodes.keys()]).toEqual(before)
      expect(graph.getNode(fixture.loose)?.parentId).toBe(fixture.figma.currentPage.id)
      // Layers the component does not know would leave the instance unsaveable.
      await io.writeDocument('fig', graph)
    }
  )

  test.each(cases.filter(([name]) => !NEEDS_SERVICES.has(name)))(
    '%s adds to a slot of an instance, which stays saveable',
    async (_name: string, def: ToolDef, args: ArgsFor) => {
      const fixture = build()
      const { graph } = fixture.figma
      const { error } = await run(def, fixture.figma, args(fixture.slot, fixture))
      expect(error).toBeNull()
      expect(graph.getNode(fixture.slot)?.childIds.length).toBeGreaterThan(0)
      await io.writeDocument('fig', graph)
    }
  )
})
