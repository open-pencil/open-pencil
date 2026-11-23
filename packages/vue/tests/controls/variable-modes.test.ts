import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'

import { defineComponent, h, reactive } from 'vue'

import { createDefaultEditorState, createEditor, type Editor } from '@open-pencil/core'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { collectionsBoundIn } from '@open-pencil/scene-graph/variables'
import { createDeferred } from '@open-pencil/std/async'
import { DEADLINE_MS, withDeadline } from '@open-pencil/std/timing'
import { createTestRenderer, hostNode } from '@open-pencil/test-support/vue/renderer'
import { MIXED } from '@open-pencil/vue/controls/node-props'
import {
  collectionLabels,
  setVariableMode,
  useVariableModes,
  variableModeChoices
} from '@open-pencil/vue/controls/variable-modes'

import { provideEditor } from '#vue/editor/context'
import { setLocale } from '#vue/i18n/locale'
import { messageStores } from '#vue/i18n/messages'

const RED = { r: 1, g: 0, b: 0, a: 1 }

function expectDefined<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Expected ${label}`)
  return value
}

/**
 * A Theme collection with Light and Dark modes, a single-mode Density collection, a frame whose
 * fill is bound to Theme with a bound child inside it, and a plain frame.
 */
function setup() {
  const graph = new SceneGraph()
  const editor = createEditor({ graph })
  const page = expectDefined(graph.getPages()[0], 'first page').id
  const theme = graph.createCollection('Theme')
  const light = theme.defaultModeId
  theme.modes[0].name = 'Light'
  const dark = expectDefined(graph.createMode(theme.id, 'Dark'), 'Dark')
  const surface = graph.createVariable('Surface', 'COLOR', theme.id, RED)
  const density = graph.createCollection('Density')
  graph.createVariable('Gap', 'FLOAT', density.id, 8)
  const bound = { boundVariables: { 'fills/0/color': surface.id } }
  const outer = graph.createNode('FRAME', page, { name: 'Outer', ...bound })
  const inner = graph.createNode('FRAME', outer.id, {
    name: 'Inner',
    ...bound
  })
  const plain = graph.createNode('FRAME', page, { name: 'Plain' })
  const node = (id: string): SceneNode => expectDefined(graph.getNode(id), id)
  return {
    editor,
    graph,
    page,
    theme,
    light,
    dark,
    density,
    outer,
    inner,
    plain,
    node
  }
}

describe('variable mode choices', () => {
  test('offer a frame every collection with more than one mode, before anything in it binds one', () => {
    const { editor, theme, outer, plain, node } = setup()
    expect(variableModeChoices(editor, [node(outer.id)]).map((c) => c.collectionId)).toEqual([
      theme.id
    ])
    expect(variableModeChoices(editor, [node(plain.id)]).map((c) => c.collectionId)).toEqual([
      theme.id
    ])
  })

  test('offer a layer that holds no others only the collections it uses', () => {
    const { editor, graph, theme, page, node } = setup()
    const surface = theme.variableIds[0] ?? ''
    const bound = graph.createNode('RECTANGLE', page, {
      boundVariables: { 'fills/0/color': surface }
    })
    const unbound = graph.createNode('RECTANGLE', page)
    expect(variableModeChoices(editor, [node(bound.id)]).map((c) => c.collectionId)).toEqual([
      theme.id
    ])
    expect(variableModeChoices(editor, [node(unbound.id)])).toEqual([])
  })

  test('offer a deleted collection only where its variables are still bound', () => {
    const { editor, graph, theme, page, outer, plain, node } = setup()
    graph.addCollection({ ...theme, deleted: true })
    const offered = (id: string) =>
      variableModeChoices(editor, [node(id)]).map((c) => c.collectionId)
    expect(offered(outer.id)).toEqual([theme.id])
    expect(offered(page)).toEqual([theme.id])
    expect(offered(plain.id)).toEqual([])
  })

  test('offer every collection with more than one mode for a page', () => {
    const { editor, theme, page, node } = setup()
    expect(variableModeChoices(editor, [node(page)]).map((c) => c.collectionId)).toEqual([theme.id])
  })

  test('show Auto with the inherited mode, the set mode, or MIXED', () => {
    const { editor, theme, light, dark, outer, inner, node } = setup()
    const [auto] = variableModeChoices(editor, [node(inner.id)])
    expect(auto?.value).toBeNull()
    expect(auto?.inherited).toEqual({ modeId: light, name: 'Light' })

    setVariableMode(editor, [node(outer.id)], theme.id, dark)
    const [inherited] = variableModeChoices(editor, [node(inner.id)])
    expect(inherited?.inherited).toEqual({ modeId: dark, name: 'Dark' })
    expect(variableModeChoices(editor, [node(outer.id)])[0]?.value).toBe(dark)
    expect(variableModeChoices(editor, [node(outer.id), node(inner.id)])[0]?.value).toBe(MIXED)
  })
})

describe('library copies in variable mode choices', () => {
  function libraryCopies() {
    const context = setup()
    const { graph, theme } = context
    Object.assign(theme, { key: 'theme-a', version: '1:1' })
    const empty = { ...structuredClone(theme), id: 'theme-b', key: 'theme-b', variableIds: [] }
    graph.addCollection(empty)
    return { ...context, empty }
  }

  const numbered = ({ name, number }: { name: string; number: string }) => `${name} #${number}`

  test('number same-named collections across the file, in collection order', () => {
    const { graph, theme, density, empty } = libraryCopies()
    expect(collectionLabels(graph, numbered)).toEqual(
      new Map([
        [theme.id, 'Theme #1'],
        [density.id, 'Density'],
        [empty.id, 'Theme #2']
      ])
    )
  })

  test('number only namesakes listed together, each by its place in the file', () => {
    const { graph, density, empty } = libraryCopies()
    const third = graph.createCollection('Theme')
    expect(collectionLabels(graph, numbered, [empty.id, density.id])).toEqual(
      new Map([
        [density.id, 'Density'],
        [empty.id, 'Theme']
      ])
    )
    expect(collectionLabels(graph, numbered, [third.id, empty.id])).toEqual(
      new Map([
        [empty.id, 'Theme #2'],
        [third.id, 'Theme #3']
      ])
    )
  })

  test('leave out a library copy without variables that no target sets a mode in', () => {
    const { editor, page, theme, node } = libraryCopies()
    expect(variableModeChoices(editor, [node(page)]).map((c) => [c.collectionId, c.label])).toEqual(
      [[theme.id, 'Theme']]
    )
  })

  test('list it, numbered apart from its namesake, where a target sets a mode in it', () => {
    const { editor, graph, theme, empty, dark, plain, node } = libraryCopies()
    graph.updateNode(plain.id, { variableModes: { [empty.id]: dark } })
    expect(
      variableModeChoices(editor, [node(plain.id)]).map((c) => [c.collectionId, c.label, c.name])
    ).toEqual([
      [theme.id, 'Theme (1)', 'Theme'],
      [empty.id, 'Theme (2)', 'Theme']
    ])
  })

  test('list the collections a layer that holds no others sets a mode in, so it can clear them', () => {
    const { editor, graph, page, theme, empty, dark, node } = libraryCopies()
    const rectangle = graph.createNode('RECTANGLE', page, {
      variableModes: { [theme.id]: dark, [empty.id]: dark }
    })
    const targets = [node(rectangle.id)]
    expect(variableModeChoices(editor, targets).map((c) => [c.collectionId, c.value])).toEqual([
      [theme.id, dark],
      [empty.id, dark]
    ])
    setVariableMode(editor, targets, empty.id, null)
    expect(variableModeChoices(editor, [node(rectangle.id)]).map((c) => c.collectionId)).toEqual([
      theme.id
    ])
  })

  test('keep a local collection without variables', () => {
    const { editor, graph, page, theme, node } = setup()
    const local = graph.createCollection('Spacing')
    graph.createMode(local.id, 'Wide')
    expect(variableModeChoices(editor, [node(page)]).map((c) => c.collectionId)).toEqual([
      theme.id,
      local.id
    ])
  })
})

describe('variable mode labels in a mounted control', () => {
  let unmount: (() => void) | undefined

  /** `@nanostores/vue` follows a store only where `window` exists, as in the app. */
  let windowDescriptor: PropertyDescriptor | undefined

  beforeAll(() => {
    windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true })
  })

  afterAll(() => {
    if (windowDescriptor) {
      Object.defineProperty(globalThis, 'window', windowDescriptor)
    } else {
      Reflect.deleteProperty(globalThis, 'window')
    }
  })

  afterEach(() => {
    unmount?.()
    setLocale('en')
  })

  function mountModes(editor: Editor) {
    let modes: ReturnType<typeof useVariableModes> | undefined
    const Control = defineComponent({
      setup() {
        modes = useVariableModes()
        return () => h('div')
      }
    })
    const app = createTestRenderer().createApp(
      defineComponent({
        setup() {
          provideEditor(editor)
          return () => h(Control)
        }
      })
    )
    app.mount(hostNode())
    unmount = () => app.unmount()
    if (!modes) throw new Error('Expected the variable modes')
    return modes
  }

  async function switchLocale(code: 'ja') {
    const before = messageStores['variables/panel'].get()
    const loaded = createDeferred<undefined>()
    const stop = messageStores['variables/panel'].listen((messages) => {
      if (messages !== before) {
        loaded.resolve(undefined)
      }
    })
    try {
      setLocale(code)
      await withDeadline(DEADLINE_MS.probe, () => loaded.promise)
    } finally {
      stop()
    }
  }

  test('follow the language and the file’s collections', async () => {
    const { graph, page, theme } = setup()
    const editor = createEditor({ graph, state: reactive(createDefaultEditorState(page)) })
    const copy = graph.createCollection('Theme')
    graph.createMode(copy.id, 'Dark')
    const { choices } = mountModes(editor)
    const labels = () => choices.value.map((choice) => choice.label)
    expect(labels()).toEqual(['Theme (1)', 'Theme (2)'])

    await switchLocale('ja')
    expect(labels()).toEqual(['Theme（1）', 'Theme（2）'])

    editor.renameCollection(copy.id, 'Brand')
    expect(labels()).toEqual(['Theme', 'Brand'])

    editor.renameCollection(theme.id, 'Brand')
    expect(labels()).toEqual(['Brand（1）', 'Brand（2）'])
  })
})

describe('setting a variable mode', () => {
  test('sets it on every target in one undo step, and the layers inside resolve it', () => {
    const { editor, graph, theme, dark, outer, inner, node } = setup()
    setVariableMode(editor, [node(outer.id)], theme.id, dark)
    expect(node(outer.id).variableModes).toEqual({ [theme.id]: dark })
    expect(graph.getNodeVariableModeId(inner.id, theme.id)).toBe(dark)

    editor.undoAction()
    expect(node(outer.id).variableModes).toEqual({})
  })

  test('clearing it restores the inherited mode and keeps other collections', () => {
    const { editor, graph, theme, density, light, dark, outer, node } = setup()
    const densityMode = density.defaultModeId
    graph.updateNode(outer.id, {
      variableModes: { [density.id]: densityMode }
    })
    setVariableMode(editor, [node(outer.id)], theme.id, dark)
    setVariableMode(editor, [node(outer.id)], theme.id, null)
    expect(node(outer.id).variableModes).toEqual({ [density.id]: densityMode })
    expect(graph.getNodeVariableModeId(outer.id, theme.id)).toBe(light)
  })
})

describe('collectionsBoundIn', () => {
  test('includes the collections that bound variables alias', () => {
    const { graph, theme, outer } = setup()
    const brand = graph.createCollection('Brand')
    const accent = graph.createVariable('Accent', 'COLOR', brand.id, RED)
    const surface = expectDefined(graph.variables.get(theme.variableIds[0] ?? ''), 'Surface')
    surface.valuesByMode[theme.defaultModeId] = { aliasId: accent.id }
    expect(collectionsBoundIn(graph, [outer.id])).toEqual(new Set([theme.id, brand.id]))
  })
})
