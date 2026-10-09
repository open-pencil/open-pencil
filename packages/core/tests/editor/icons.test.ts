import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { parseIconName, type IconProvider } from '@open-pencil/core/icons'
import { isIconModified, readIcon, SceneGraph } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { buildIconData } from '#core/icons/svg'

import { getNodeOrThrow } from '../helpers/assert'

const RED: Color = { r: 1, g: 0, b: 0, a: 1 }

const BODIES: Record<string, string> = {
  'test:square': '<path fill="currentColor" d="M2 2h20v20H2z"/>',
  'test:lines': '<path fill="none" stroke="currentColor" d="M4 4h16M4 12h16"/>'
}

/** Icons drawn from fixed bodies, so the commands run without the network. */
const provider: IconProvider = {
  search: async () => ({ icons: Object.keys(BODIES), total: 2, collections: {} }),
  collections: async () => [],
  browse: async () => Object.keys(BODIES),
  previews: async (names) =>
    new Map(names.flatMap((name) => (BODIES[name] ? [[name, `<svg>${BODIES[name]}</svg>`]] : []))),
  async icons(names, size) {
    const found = new Map()
    for (const name of names) {
      const parsed = parseIconName(name)
      const body = BODIES[name]
      if (parsed && body)
        found.set(name, buildIconData({ body }, parsed.prefix, parsed.iconName, 24, 24, size))
    }
    return found
  }
}

function setup() {
  const editor = createEditor({
    getViewportSize: () => ({ width: 1000, height: 800 }),
    icons: provider
  })
  editor.state.panX = 100
  editor.state.panY = 50
  editor.state.zoom = 2
  return editor
}

/** Inserts an icon that must be placed, as it is when the document stays the same. */
async function insert(editor: ReturnType<typeof setup>, name: string, color?: Color) {
  const id = await editor.insertIcon(name, color)
  if (!id) throw new Error(`Icon "${name}" was not inserted`)
  return id
}

describe('icon commands', () => {
  test('insert places the icon at the middle of the view, selected, in one undo step', async () => {
    const editor = setup()
    const id = await insert(editor, 'test:square')
    const frame = getNodeOrThrow(editor.graph, id)

    expect(frame).toMatchObject({ x: 188, y: 163, width: 24, height: 24 })
    expect(frame.parentId).toBe(editor.state.currentPageId)
    expect(readIcon(frame)).toMatchObject({ name: 'test:square' })
    expect(editor.state.selectedIds).toEqual(new Set([id]))

    editor.undo.undo()
    expect(editor.graph.getNode(id)).toBeUndefined()
    expect(editor.state.selectedIds).toEqual(new Set())

    editor.undo.redo()
    expect(readIcon(getNodeOrThrow(editor.graph, id))).toMatchObject({ name: 'test:square' })
    expect(editor.graph.getChildren(id)).toHaveLength(1)
  })

  test('insert places the icon inside the container being edited', async () => {
    const editor = setup()
    const containerId = editor.createShape('FRAME', 100, 100, 400, 400)
    editor.state.enteredContainerId = containerId
    const frame = getNodeOrThrow(editor.graph, await insert(editor, 'test:square'))

    expect(frame.parentId).toBe(containerId)
    expect(frame).toMatchObject({ x: 88, y: 63 })
  })

  test('insert rejects a name the provider lacks', async () => {
    const editor = setup()
    await expect(editor.insertIcon('test:missing')).rejects.toThrow('not found')
  })

  test('swap draws another glyph in place and undo brings the old one back', async () => {
    const editor = setup()
    const id = await insert(editor, 'test:square', RED)
    const before = editor.graph.getChildren(id).map((path) => path.id)

    await editor.swapIconGlyph(id, 'test:lines')
    const frame = getNodeOrThrow(editor.graph, id)
    expect(readIcon(frame)).toMatchObject({ name: 'test:lines' })
    expect(frame).toMatchObject({ x: 188, y: 163, name: 'lines' })
    expect(editor.graph.getChildren(id)[0]?.strokes[0]?.color).toEqual(RED)

    editor.undo.undo()
    expect(readIcon(getNodeOrThrow(editor.graph, id))).toMatchObject({ name: 'test:square' })
    expect(editor.graph.getChildren(id).map((path) => path.id)).toEqual(before)

    editor.undo.redo()
    expect(readIcon(getNodeOrThrow(editor.graph, id))).toMatchObject({ name: 'test:lines' })
  })

  test('swap keeps the icon at its place among its siblings', async () => {
    const editor = setup()
    const id = await insert(editor, 'test:square')
    const after = editor.createShape('RECTANGLE', 0, 0, 10, 10)
    const pageId = editor.state.currentPageId

    await editor.swapIconGlyph(id, 'test:lines')
    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, pageId).childIds).toEqual([id, after])
  })

  test('color recolors the tinted paths in one undo step', async () => {
    const editor = setup()
    const id = await insert(editor, 'test:square')
    const pathId = editor.graph.getChildren(id)[0]?.id ?? ''

    editor.setIconColor(id, RED)
    expect(getNodeOrThrow(editor.graph, pathId).fills[0]?.color).toEqual(RED)

    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, pathId).fills[0]?.color).toMatchObject({ r: 0, g: 0, b: 0 })
  })
})

describe('icon commands across a document change', () => {
  test('an icon still loading when the document is replaced is not inserted into the new one', async () => {
    let release: (() => void) | undefined
    const loaded = new Promise<void>((resolve) => {
      release = resolve
    })
    const slow: IconProvider = {
      ...provider,
      async icons(names, size) {
        await loaded
        return provider.icons(names, size)
      }
    }
    const editor = createEditor({ getViewportSize: () => ({ width: 1000, height: 800 }), icons: slow })
    const inserting = editor.insertIcon('test:square')
    const replacement = new SceneGraph()
    editor.replaceGraph(replacement)
    release?.()

    expect(await inserting).toBeNull()
    expect([...replacement.getAllNodes()].some((node) => readIcon(node))).toBe(false)
  })
})

describe('icon layer names', () => {
  test('a swap renames a layer named after its icon, old style or new, but keeps a given name', async () => {
    const editor = setup()
    const named = await insert(editor, 'test:square')
    const oldStyle = await insert(editor, 'test:square')
    const renamed = await insert(editor, 'test:square')
    editor.graph.updateNode(oldStyle, { name: 'Icon / test:square' })
    editor.graph.updateNode(renamed, { name: 'Close button' })

    for (const id of [named, oldStyle, renamed]) await editor.swapIconGlyph(id, 'test:lines')

    expect(getNodeOrThrow(editor.graph, named).name).toBe('lines')
    expect(getNodeOrThrow(editor.graph, oldStyle).name).toBe('lines')
    expect(getNodeOrThrow(editor.graph, renamed).name).toBe('Close button')
  })
})

describe('editing an icon', () => {
  test('reset draws the placed glyph again, in one undo step', async () => {
    const editor = setup()
    const id = await insert(editor, 'test:square', RED)
    editor.graph.createNode('RECTANGLE', id, { width: 4, height: 4 })
    expect(isIconModified(editor.graph, getNodeOrThrow(editor.graph, id))).toBe(true)

    await editor.resetIcon(id)
    expect(isIconModified(editor.graph, getNodeOrThrow(editor.graph, id))).toBe(false)
    expect(editor.graph.getChildren(id)).toHaveLength(1)
    expect(editor.graph.getChildren(id)[0]?.fills[0]?.color).toEqual(RED)

    editor.undo.undo()
    expect(editor.graph.getChildren(id)).toHaveLength(2)
  })

  test('detach makes the icon artwork, in one undo step', async () => {
    const editor = setup()
    const id = await insert(editor, 'test:square')
    editor.detachIcon(id)
    expect(readIcon(getNodeOrThrow(editor.graph, id))).toBeNull()

    editor.undo.undo()
    expect(readIcon(getNodeOrThrow(editor.graph, id))).toMatchObject({ name: 'test:square' })
  })
})
