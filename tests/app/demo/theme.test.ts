import { describe, expect, spyOn, test } from 'bun:test'

import { nextTick, ref } from 'vue'

import { SceneGraph } from '@lawha/scene-graph'

import { applyTourTheme, followAppTheme } from '@/app/demo/theme'
import { createEditorStore } from '@/app/editor/session'

const DARK_PAGE = { r: 0.05, g: 0.05, b: 0.07, a: 1 }
const LIGHT_PAGE = { r: 0.93, g: 0.93, b: 0.95, a: 1 }

/** A tour's two collections, and a collection of the user's own with the same mode names. */
function tour() {
  const store = createEditorStore()
  const graph = store.graph
  const collection = (name: string) => {
    const created = graph.createCollection(name)
    const dark = created.defaultModeId
    graph.renameMode(created.id, dark, 'Dark')
    const light = `${created.id}-light`
    graph.addMode(created.id, light, 'Light', dark)
    return { id: created.id, dark, light }
  }
  const theme = collection('Theme')
  const chrome = collection('App chrome')
  const brand = collection('Brand')
  const page = graph.createVariable('Page', 'COLOR', theme.id, DARK_PAGE)
  page.valuesByMode[theme.light] = LIGHT_PAGE
  return { store, graph, theme, chrome, brand }
}

const activeMode = (graph: ReturnType<typeof tour>['graph'], collectionId: string) =>
  graph.getNodeVariableModeId(graph.getPages()[0].id, collectionId)

describe('the tour in the app theme', () => {
  test('reads both tour collections in the theme’s mode and paints the page', () => {
    const { store, graph, theme, chrome, brand } = tour()
    applyTourTheme(store, 'light')
    expect(activeMode(graph, theme.id)).toBe(theme.light)
    expect(activeMode(graph, chrome.id)).toBe(chrome.light)
    expect(activeMode(graph, brand.id)).toBe(brand.dark)
    expect(store.state.pageColor).toMatchObject(LIGHT_PAGE)

    applyTourTheme(store, 'dark')
    expect(activeMode(graph, theme.id)).toBe(theme.dark)
    expect(store.state.pageColor).toMatchObject(DARK_PAGE)
  })

  test('opens with nothing to save and nothing to undo', () => {
    const { store } = tour()
    const before = store.hasUnsavedChanges()
    applyTourTheme(store, 'light')
    expect(store.hasUnsavedChanges()).toBe(before)
    expect(store.undo.canUndo).toBe(false)
  })

  test('follows the theme until the tab shows another document', async () => {
    const { store, graph, theme } = tour()
    const appTheme = ref<'dark' | 'light'>('dark')
    followAppTheme(store, appTheme)
    expect(activeMode(graph, theme.id)).toBe(theme.dark)
    appTheme.value = 'light'
    await nextTick()
    expect(activeMode(graph, theme.id)).toBe(theme.light)

    // Another document with a collection of the same name is not the tour.
    const other = new SceneGraph()
    const collection = other.createCollection('Theme')
    other.renameMode(collection.id, collection.defaultModeId, 'Dark')
    store.replaceGraph(other)
    const setMode = spyOn(store, 'setActiveMode')
    appTheme.value = 'dark'
    await nextTick()
    expect(setMode).not.toHaveBeenCalled()
  })
})
