import { beforeAll, expect, test } from 'bun:test'

import { styleRunsWithPatch, textStyleChanges } from '#core/text/character-style'

import { createEditor } from '@open-pencil/core'
import { fontManager, faceForStyle, textStyleName } from '@open-pencil/core/text'

beforeAll(async () => {
  await fontManager.familyFaces('Inter')
})

function textNode(fields: Parameters<ReturnType<typeof createEditor>['graph']['createNode']>[2]) {
  const editor = createEditor()
  const node = editor.graph.createNode('TEXT', editor.state.currentPageId, {
    text: 'Hello world',
    ...fields
  })
  return { editor, node }
}

test('finds a face by its family’s own name for it, whatever its spelling', () => {
  // Our Inter 4 joins the names Figma's Inter 3 spaces.
  expect(faceForStyle('Inter', 'Semi Bold')).toEqual({ weight: 600, italic: false, style: 'SemiBold' })
  expect(faceForStyle('Inter', 'italic')).toEqual({ weight: 400, italic: true, style: 'Italic' })
  // A name the family does not hold stays as asked, so a file keeps it.
  expect(faceForStyle('Nowhere Sans', 'Book')).toEqual({ weight: 400, italic: false, style: 'Book' })
})

test('names a text by the name it was given, else by its font’s name for its weight', () => {
  const { editor, node } = textNode({ fontFamily: 'Avenir', fontStyle: 'Book', fontWeight: 400 })
  try {
    expect(textStyleName(node)).toBe('Book')
    editor.graph.updateNode(node.id, { fontStyle: null })
    expect(textStyleName(node)).toBe('Regular')
    editor.graph.updateNode(node.id, { fontFamily: 'Inter', italic: true })
    expect(textStyleName(node)).toBe('Italic')
  } finally {
    editor.dispose()
  }
})

test('a new weight, slant, or family drops the name, and undo brings it back', () => {
  const { editor, node } = textNode({ fontFamily: 'Avenir', fontStyle: 'Book' })
  try {
    // Setting what the text already has keeps the name the file gave it.
    editor.updateNodeWithUndo(node.id, { fontFamily: 'Avenir', fontWeight: 400, italic: false })
    expect(node.fontStyle).toBe('Book')
    editor.updateNodeWithUndo(node.id, { fontWeight: 700 })
    expect(node.fontStyle).toBeNull()
    editor.undoAction()
    expect([node.fontWeight, node.fontStyle]).toEqual([400, 'Book'])
    editor.updateNodeWithUndo(node.id, { italic: true })
    expect(node.fontStyle).toBeNull()
    editor.updateNodeWithUndo(node.id, { fontFamily: 'Inter', fontStyle: 'Bold', fontWeight: 700 })
    expect(node.fontStyle).toBe('Bold')
  } finally {
    editor.dispose()
  }
})

test('a range in a new weight takes no name, and a new weight for all of it clears the ranges’', () => {
  const { editor, node } = textNode({ fontFamily: 'Avenir', fontStyle: 'Book' })
  try {
    const runs = styleRunsWithPatch(node, 6, 11, { fontWeight: 700 })
    expect(runs).toEqual([{ start: 6, length: 5, style: { fontWeight: 700, fontStyle: null } }])
    const named = styleRunsWithPatch(node, 6, 11, { fontWeight: 300, fontStyle: 'Light' })
    editor.graph.updateNode(node.id, { styleRuns: named })
    expect(textStyleChanges(node, { fontWeight: 900 }).styleRuns).toEqual([])
  } finally {
    editor.dispose()
  }
})

test('of two faces of one name, finds the one in the slant asked for', () => {
  // An upright and an italic variable file can each name an instance "Bold".
  fontManager.setHostFontCatalog([
    {
      family: 'Two Slants',
      faces: [
        { style: 'Bold', weight: 700, italic: false },
        { style: 'Bold', weight: 700, italic: true }
      ]
    }
  ])
  try {
    expect(faceForStyle('Two Slants', 'Bold', true)).toMatchObject({ italic: true })
    expect(faceForStyle('Two Slants', 'Bold', false)).toMatchObject({ italic: false })
  } finally {
    fontManager.setHostFontCatalog([])
  }
})
