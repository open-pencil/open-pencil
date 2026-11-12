import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { expectDefined } from '@open-pencil/test-support/assert'

/** A frame with a rectangle whose bound fill had its opacity edited, and a frame set to Dark. */
function setup() {
  const editor = createEditor()
  const { graph } = editor
  const collection = graph.createCollection('Theme')
  const light = collection.defaultModeId
  const dark = expectDefined(graph.createMode(collection.id, 'Dark'), 'dark mode')
  const tone = graph.createVariable('Tone', 'COLOR', collection.id)
  tone.valuesByMode[light] = { r: 1, g: 0, b: 0, a: 1 }
  tone.valuesByMode[dark] = { r: 0, g: 0, b: 1, a: 1 }
  const page = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', page, { name: 'Frame', width: 200, height: 200 })
  const darkFrame = graph.createNode('FRAME', page, {
    name: 'Dark',
    x: 300,
    width: 200,
    height: 200,
    variableModes: { [collection.id]: dark }
  })
  const rect = graph.createNode('RECTANGLE', frame.id, {
    name: 'Swatch',
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
  })
  editor.bindVariable(rect.id, 'fills/0/color', tone.id)
  const [fill] = expectDefined(graph.getNode(rect.id)).fills
  editor.updateNodeWithUndo(rect.id, { fills: [{ ...fill, opacity: 0.4 }] })
  const read = (id: string) => {
    const [paint] = expectDefined(graph.getNode(id)).fills
    return [paint.color.r, paint.color.g, paint.color.b, paint.opacity].join(',')
  }
  // A value changing only in Dark refreshes nothing that resolves Light.
  const touchDark = () => editor.updateVariableValue(tone.id, dark, { r: 0, g: 1, b: 1, a: 1 })
  return { editor, frame, darkFrame, rect, read, touchDark }
}

async function paste(editor: ReturnType<typeof setup>['editor'], sourceId: string, into: string) {
  editor.select([sourceId])
  const { snapshot } = await editor.prepareCopy()
  editor.select([into])
  await editor.pasteSnapshot(expectDefined(snapshot, 'snapshot'))
  // Paste selects what it created.
  const [pasted] = editor.state.selectedIds
  return expectDefined(pasted, 'pasted layer')
}

// Figma desktop 126 (scratch/pr-oracle/1879 paste-probe): a copy keeps the edited paint, and one
// moved into another mode takes the variable's color there.
test('a pasted bound paint keeps its edit until its variable gives it another color', async () => {
  const { editor, frame, rect, read, touchDark } = setup()
  const pasted = await paste(editor, rect.id, frame.id)
  expect(read(pasted)).toBe('1,0,0,0.4')
  touchDark()
  expect(read(pasted)).toBe('1,0,0,0.4')
})

test('a bound paint pasted into a frame set to another mode takes its color there', async () => {
  const { editor, darkFrame, rect, read } = setup()
  const pasted = await paste(editor, rect.id, darkFrame.id)
  expect(read(pasted)).toBe('0,0,1,1')
})
