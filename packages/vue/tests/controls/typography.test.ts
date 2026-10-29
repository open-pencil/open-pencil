import { afterAll, beforeAll, expect, test } from 'bun:test'

import { computed, effectScope, nextTick, shallowRef } from 'vue'

import { createEditor } from '@open-pencil/core'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { DEFAULT_WEB_FONT_PROVIDER_SETTINGS, fontManager } from '@open-pencil/core/text'
import type { SceneNode } from '@open-pencil/scene-graph'

import { createTypographyActions } from '#vue/controls/typography/actions'
import { createTypographyAxes } from '#vue/controls/typography/axes'
import { useFamilyFaces } from '#vue/controls/typography/faces'

// The faces Figma lists for these families (desktop 126), given as installed fonts so no test
// asks a web provider.
const LORA = [
  'Regular',
  'Medium',
  'SemiBold',
  'Bold',
  'Italic',
  'Medium Italic',
  'SemiBold Italic',
  'Bold Italic'
]
const OSWALD = ['ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold']
const CATALOG = [
  { family: 'Lora', styles: LORA },
  { family: 'Oswald', styles: OSWALD }
]

beforeAll(() => {
  fontManager.setOnlineFontProviders({})
  fontManager.setHostFontCatalog(CATALOG)
})

afterAll(() => {
  fontManager.setHostFontCatalog([])
  fontManager.setOnlineFontProviders(DEFAULT_WEB_FONT_PROVIDER_SETTINGS)
})

/** Two text layers, the typography actions over a selection, and a font load that waits. */
function setup() {
  const editor = createEditor()
  const page = editor.state.currentPageId
  const first = editor.graph.createNode('TEXT', page, { name: 'First', text: 'a' })
  const second = editor.graph.createNode('TEXT', page, { name: 'Second', text: 'b' })
  const selection = shallowRef<SceneNode[]>([first])
  let resolveLoading: (() => void) | undefined
  const loading = new Promise<void>((resolve) => {
    resolveLoading = resolve
  })
  const finishLoading = () => resolveLoading?.()
  const actions = createTypographyActions({
    editor,
    nodes: computed(() => selection.value),
    activeFormatting: computed(() => []),
    supports: () => true,
    options: { fontLoader: { load: () => loading } }
  })
  return { editor, first, second, selection, actions, finishLoading }
}

test('a weight waits for its face, then changes the layers selected when it was chosen', async () => {
  const { first, second, selection, actions, finishLoading } = setup()
  const applied = actions.setWeight(700)
  expect(first.fontWeight).toBe(400)
  selection.value = [second]
  finishLoading()
  await applied
  expect(first.fontWeight).toBe(700)
  expect(second.fontWeight).toBe(400)
})

test('a later choice wins over an earlier one whose face loads after it', async () => {
  const editor = createEditor()
  const text = editor.graph.createNode('TEXT', editor.state.currentPageId, { text: 'a' })
  const loads = new Map<string, () => void>()
  const actions = createTypographyActions({
    editor,
    nodes: computed(() => [text]),
    activeFormatting: computed(() => []),
    supports: () => true,
    options: {
      fontLoader: {
        load: (family) =>
          new Promise<void>((resolve) => {
            loads.set(family, resolve)
          })
      }
    }
  })
  /** Resolves a family's load once the change has asked for it, after reading its faces. */
  const finish = async (family: string) => {
    for (let tick = 0; tick < 50 && !loads.has(family); tick++) await Promise.resolve()
    loads.get(family)?.()
  }
  const slow = actions.setFamily('Roboto')
  const fast = actions.setFamily('Lora')
  await finish('Lora')
  await fast
  await finish('Roboto')
  await slow
  expect(text.fontFamily).toBe('Lora')
})

test('a family chosen while loading skips layers deleted in the meantime', async () => {
  const { editor, first, second, selection, actions, finishLoading } = setup()
  selection.value = [first, second]
  const applied = actions.setFamily('Roboto')
  editor.graph.deleteNode(first.id)
  finishLoading()
  await applied
  expect(editor.graph.getNode(second.id)?.fontFamily).toBe('Roboto')
  expect(editor.graph.getNode(first.id)).toBeUndefined()
})

/** Text layers in Inter at these styles, with typography actions and face lists over them. */
function styled(...faces: { fontWeight: number; italic?: boolean; fontFamily?: string }[]) {
  const editor = createEditor()
  const page = editor.state.currentPageId
  const texts = faces.map((face) =>
    editor.graph.createNode('TEXT', page, { text: 'a', fontFamily: 'Inter', ...face })
  )
  const nodes = computed(() => texts)
  const scope = effectScope()
  const lists = scope.run(() => useFamilyFaces(nodes))
  if (!lists) throw new Error('Expected family faces')
  const { weights, supports } = lists
  const actions = createTypographyActions({
    editor,
    nodes,
    activeFormatting: computed(() => []),
    supports,
    options: {}
  })
  return { texts, weights, actions, stop: () => scope.stop() }
}

test('a family switch keeps a face the family has, or takes the nearest weight, as in Figma', async () => {
  const { texts, actions } = styled(
    { fontWeight: 100 },
    { fontWeight: 900 },
    { fontWeight: 500, italic: true },
    { fontWeight: 900, italic: true }
  )
  await actions.setFamily('Lora')
  expect(texts.map((text) => [text.fontFamily, text.fontWeight, text.italic])).toEqual([
    ['Lora', 400, false],
    ['Lora', 700, false],
    ['Lora', 500, true],
    ['Lora', 700, true]
  ])
})

test('the weight list offers only the weights the family has', async () => {
  const { weights } = styled({ fontWeight: 400, fontFamily: 'Oswald' })
  await fontManager.familyFaces('Oswald')
  await nextTick()
  expect(weights.value.map((weight) => weight.value)).toEqual([200, 300, 400, 500, 600, 700])
})

test('italic does nothing on a family without italics, and bold goes to Bold', async () => {
  const { texts, actions } = styled({ fontWeight: 400, fontFamily: 'Oswald' })
  await fontManager.familyFaces('Oswald')
  actions.toggleItalic()
  await Promise.resolve()
  expect(texts[0].italic).toBe(false)
  actions.toggleBold()
  for (let tick = 0; tick < 5; tick++) await Promise.resolve()
  expect(texts[0].fontWeight).toBe(700)
})

test('the weight list follows a font catalog that arrives after the first lookup', async () => {
  const { weights, stop } = styled({ fontWeight: 400, fontFamily: 'Late Sans' })
  await fontManager.familyFaces('Late Sans')
  await nextTick()
  expect(weights.value).toHaveLength(9)
  fontManager.setHostFontCatalog([...CATALOG, { family: 'Late Sans', styles: ['Regular', 'Bold'] }])
  await fontManager.familyFaces('Late Sans')
  await nextTick()
  expect(weights.value.map((weight) => weight.value)).toEqual([400, 700])
  stop()
  fontManager.setHostFontCatalog(CATALOG)
})

/** A text layer in the bundled variable Inter, which has weight and optical size axes. */
async function variableText(fontSize = 24) {
  await fontManager.loadFont('Inter', 'Regular')
  const editor = createEditor()
  const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
    text: 'a',
    fontFamily: 'Inter',
    fontSize
  })
  const scope = effectScope()
  const axes = scope.run(() => createTypographyAxes(editor, computed(() => [text])))
  if (!axes) throw new Error('Expected the axes')
  return { editor, text, axes, stop: () => scope.stop() }
}

test('lists the variable font’s axes at the values the text is drawn at', async () => {
  const { axes, stop } = await variableText()
  const values = Object.fromEntries(axes.axes.value.map((axis) => [axis.tag, axis.value]))
  // Regular is weight 400, and the optical size follows the font size.
  expect(values).toMatchObject({ wght: 400, opsz: 24 })
  expect(axes.opticalSizeAuto.value).toBe(true)
  stop()
})

test('an axis set by hand is one undo step, and an optical size set by hand stops following', async () => {
  const { editor, text, axes, stop } = await variableText()
  axes.previewAxis('wght', 520)
  axes.previewAxis('wght', 560)
  axes.setAxis('wght', 560)
  axes.setAxis('opsz', 16)
  expect(text.fontVariations).toEqual([
    { axis: 'wght', value: 560 },
    { axis: 'opsz', value: 16 }
  ])
  expect(text.opticalSizeFromFontSize).toBe(false)
  editor.undo.undo()
  editor.undo.undo()
  expect(text.fontVariations).toEqual([])
  expect(text.opticalSizeFromFontSize).toBe(true)
  stop()
})

test('turning automatic optical size off holds the size it is drawn at', async () => {
  const { text, axes, stop } = await variableText(20)
  axes.setOpticalSizeAuto(false)
  expect(text.fontVariations).toEqual([{ axis: 'opsz', value: 20 }])
  axes.setOpticalSizeAuto(true)
  expect(text.fontVariations).toEqual([])
  stop()
})

test('a named weight draws at its own axes, keeping an optical size set by hand', async () => {
  const { editor, text, stop } = await variableText()
  editor.graph.updateNode(text.id, {
    fontVariations: [
      { axis: 'wght', value: 560 },
      { axis: 'opsz', value: 16 }
    ],
    opticalSizeFromFontSize: false
  })
  const actions = createTypographyActions({
    editor,
    nodes: computed(() => [text]),
    activeFormatting: computed(() => []),
    supports: () => true,
    options: {}
  })
  await actions.setWeight(700)
  expect(text.fontWeight).toBe(700)
  expect(text.fontVariations).toEqual([{ axis: 'opsz', value: 16 }])
  stop()
})

test('a cancelled axis edit puts back the axes it previewed', async () => {
  const { text, axes, stop } = await variableText()
  axes.previewAxis('opsz', 18)
  expect(text.opticalSizeFromFontSize).toBe(false)
  axes.cancelAxis()
  expect(text.fontVariations).toEqual([])
  expect(text.opticalSizeFromFontSize).toBe(true)
  stop()
})

test('an axis set while text is edited styles the selected characters, and undoes', async () => {
  await fontManager.loadFont('Inter', 'Regular')
  const ck = await initCanvasKit()
  const surface = ck.MakeSurface(200, 200)
  if (!surface) throw new Error('Expected a surface')
  const renderer = new SkiaRenderer(ck, surface)
  const editor = createEditor()
  editor.setCanvasKit(ck, renderer)
  await renderer.loadFonts()
  const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
    text: 'Hello world',
    fontFamily: 'Inter',
    width: 200,
    height: 20
  })
  editor.startTextEditing(text.id)
  const state = editor.textEditor?.state
  if (!state) throw new Error('Expected a text editor')
  state.selectionAnchor = 6
  state.cursor = 11
  const scope = effectScope()
  const axes = scope.run(() => createTypographyAxes(editor, computed(() => [text])))
  if (!axes) throw new Error('Expected the axes')
  const node = () => editor.graph.getNode(text.id)
  try {
    axes.previewAxis('wght', 500)
    axes.setAxis('wght', 600)
    expect(node()?.fontVariations).toEqual([])
    expect(node()?.styleRuns).toEqual([
      { start: 6, length: 5, style: { fontVariations: [{ axis: 'wght', value: 600 }] } }
    ])
    editor.undoAction()
    expect(node()?.styleRuns).toEqual([])
    // Whether optical size follows the font size is the selected characters' own, as in Figma.
    axes.setOpticalSizeAuto(false)
    expect(node()?.opticalSizeFromFontSize).toBe(true)
    expect(node()?.styleRuns).toEqual([
      {
        start: 6,
        length: 5,
        style: { opticalSizeFromFontSize: false, fontVariations: [{ axis: 'opsz', value: 14 }] }
      }
    ])
    editor.undoAction()
    expect(node()?.styleRuns).toEqual([])

    // A typed optical size goes to the selected characters too, and stays when the edit ends.
    axes.setAxis('opsz', 20)
    const typed = {
      start: 6,
      length: 5,
      style: { fontVariations: [{ axis: 'opsz', value: 20 }], opticalSizeFromFontSize: false }
    }
    expect(node()?.styleRuns).toEqual([typed])
    expect(node()?.opticalSizeFromFontSize).toBe(true)
    expect(node()?.fontVariations).toEqual([])
    editor.commitTextEdit()
    expect(editor.state.editingTextId).toBeNull()
    expect(node()?.styleRuns).toEqual([typed])
  } finally {
    scope.stop()
    editor.dispose()
    renderer.destroy()
  }
})
