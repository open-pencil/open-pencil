import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { parseIconName, type IconProvider } from '@open-pencil/core/icons'
import { SceneGraph } from '@open-pencil/scene-graph'
import { isIconModified, readIcon, type IconOptions } from '@open-pencil/scene-graph/icons'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { getNodeOrThrow } from '@open-pencil/test-support/assert'

import { buildIconData } from '#core/icons/artwork'
const RED: Color = { r: 1, g: 0, b: 0, a: 1 }

const BODIES: Record<string, string> = {
  'test:square': '<path fill="currentColor" d="M2 2h20v20H2z"/>',
  'test:lines': '<path fill="none" stroke="currentColor" d="M4 4h16M4 12h16"/>'
}

/**
 * Icons drawn from fixed bodies, so the commands run without the network; they record the options
 * asked for, as a set drawn from its own source does.
 */
const provider: IconProvider = {
  search: async () => ({ icons: Object.keys(BODIES), total: 2, collections: {} }),
  collections: async () => [],
  browse: async () => Object.keys(BODIES),
  previews: async (names) =>
    new Map(names.flatMap((name) => (BODIES[name] ? [[name, `<svg>${BODIES[name]}</svg>`]] : []))),
  async icons(names, size, options) {
    const found = new Map()
    for (const name of names) {
      const parsed = parseIconName(name)
      const body = BODIES[name]
      if (parsed && body)
        found.set(
          name,
          Object.assign(
            buildIconData({ body, width: 24, height: 24 }, parsed.prefix, parsed.iconName, size),
            options && { options: { ...options } }
          )
        )
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
      async icons(names, size, options) {
        await loaded
        return provider.icons(names, size, options)
      }
    }
    const editor = createEditor({
      getViewportSize: () => ({ width: 1000, height: 800 }),
      icons: slow
    })
    const inserting = editor.insertIcon('test:square')
    const replacement = new SceneGraph()
    editor.replaceGraph(replacement)
    release?.()

    expect(await inserting).toBeNull()
    expect([...replacement.getAllNodes()].some((node) => readIcon(node))).toBe(false)
  })
})

/**
 * An editor whose icons draw at once, except those `holds` names, which wait for `release`;
 * `started` settles once such an icon has begun loading.
 */
function setupHeld(holds: (names: readonly string[], options?: IconOptions) => boolean) {
  let release: () => void = () => undefined
  let begin: () => void = () => undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const started = new Promise<void>((resolve) => {
    begin = resolve
  })
  const editor = createEditor({
    getViewportSize: () => ({ width: 1000, height: 800 }),
    icons: {
      ...provider,
      async icons(names, size, options) {
        if (holds(names, options)) {
          begin()
          await held
        }
        return provider.icons(names, size, options)
      }
    }
  })
  return { editor, started, release: () => release() }
}

describe('icon redraws that finish late', () => {
  test('an option change and a swap made after it both apply, in order', async () => {
    const { editor, started, release } = setupHeld((_, options) => options?.weight === 'bold')
    const id = await insert(editor, 'test:square')
    const changing = editor.setIconOptions(id, { weight: 'bold' })
    const swapping = editor.swapIconGlyph(id, 'test:lines')
    await started
    release()
    await Promise.all([changing, swapping])
    expect(readIcon(getNodeOrThrow(editor.graph, id))).toMatchObject({
      name: 'test:lines',
      options: { weight: 'bold' }
    })
  })

  test('a swap and an option change made after it both apply, in order', async () => {
    const { editor, started, release } = setupHeld((names) => names.includes('test:lines'))
    const id = await insert(editor, 'test:square')
    const swapping = editor.swapIconGlyph(id, 'test:lines')
    const changing = editor.setIconOptions(id, { weight: 'bold' })
    await started
    release()
    await Promise.all([swapping, changing])
    expect(readIcon(getNodeOrThrow(editor.graph, id))).toMatchObject({
      name: 'test:lines',
      options: { weight: 'bold' }
    })
  })

  test('a redraw gives way to path edits made while its icon loads', async () => {
    const { editor, started, release } = setupHeld((_, options) => options?.weight === 'bold')
    const id = await insert(editor, 'test:square')
    const changing = editor.setIconOptions(id, { weight: 'bold' })
    // The edit lands while the redraw's icon loads, past the check made before loading.
    await started
    editor.graph.createNode('RECTANGLE', id, { width: 4, height: 4 })
    release()
    await changing
    expect(editor.graph.getChildren(id)).toHaveLength(2)
    expect(readIcon(getNodeOrThrow(editor.graph, id))?.options).toBeUndefined()
  })

  test('a redraw queued when the document is replaced is not applied to the new one', async () => {
    const { editor, started, release } = setupHeld((_, options) => options?.weight === 'bold')
    const id = await insert(editor, 'test:square')
    const frame = getNodeOrThrow(editor.graph, id)
    const first = editor.setIconOptions(id, { weight: 'bold' })
    const queued = editor.setIconOptions(id, { scale: 'large' })
    await started
    // A copy of the same file, whose icon keeps its ID and its paths, unedited.
    const replacement = new SceneGraph()
    replacement.createNodeWithId(id, 'FRAME', replacement.getPages()[0].id, {
      name: frame.name,
      width: frame.width,
      height: frame.height,
      pluginData: frame.pluginData
    })
    for (const path of editor.graph.getChildren(id))
      replacement.createNodeWithId(path.id, path.type, id, { ...path, childIds: [] })
    expect(isIconModified(replacement, getNodeOrThrow(replacement, id))).toBe(false)
    editor.replaceGraph(replacement)
    release()
    await Promise.all([first, queued])
    expect(readIcon(getNodeOrThrow(replacement, id))?.options).toBeUndefined()
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

  test('options draw the icon again with them, keeping its others and its color, in one undo step', async () => {
    const editor = setup()
    const id = await insert(editor, 'test:square', RED)
    await editor.setIconOptions(id, { weight: 'bold' })
    await editor.setIconOptions(id, { scale: 'large' })
    expect(readIcon(getNodeOrThrow(editor.graph, id))?.options).toEqual({
      weight: 'bold',
      scale: 'large'
    })
    expect(editor.graph.getChildren(id)[0]?.fills[0]?.color).toEqual(RED)

    editor.undo.undo()
    expect(readIcon(getNodeOrThrow(editor.graph, id))?.options).toEqual({ weight: 'bold' })
  })

  test('options the icon is already drawn with draw nothing and add no undo step', async () => {
    const editor = setup()
    const id = await insert(editor, 'test:square')
    await editor.setIconOptions(id, { weight: 'bold' })
    await editor.setIconOptions(id, { weight: 'bold' })
    editor.undo.undo()
    expect(readIcon(getNodeOrThrow(editor.graph, id))?.options).toBeUndefined()
  })

  test('options changed while the icon is still drawing both apply', async () => {
    const editor = setup()
    const id = await insert(editor, 'test:square')
    await Promise.all([
      editor.setIconOptions(id, { weight: 'bold' }),
      editor.setIconOptions(id, { scale: 'large' })
    ])
    expect(readIcon(getNodeOrThrow(editor.graph, id))?.options).toEqual({
      weight: 'bold',
      scale: 'large'
    })
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
