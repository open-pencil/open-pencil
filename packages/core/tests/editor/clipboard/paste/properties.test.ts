import { describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { createEditor, type Editor } from '@open-pencil/core'
import { colorToFill } from '@open-pencil/scene-graph/color'

import { withResolvableLinks } from '#core/editor/clipboard/paste/properties'

const LINK = { type: 'URL', value: 'https://example.com/' } as const
const RED = colorToFill('#ff0000')
const GREEN = colorToFill('#00ff00')

function setup() {
  const editor = createEditor()
  const pageId = editor.graph.getPages()[0].id
  const source = editor.graph.createNode('RECTANGLE', pageId, {
    name: 'Source',
    width: 100,
    height: 40,
    rotation: 15,
    fills: [RED],
    strokes: [{ ...colorToFill('#0000ff'), weight: 3, align: 'INSIDE' }],
    borderTopWeight: 5,
    independentStrokeWeights: true,
    cornerRadius: 8,
    opacity: 0.5
  })
  const target = editor.graph.createNode('RECTANGLE', pageId, {
    name: 'Target',
    x: 200,
    width: 60,
    height: 60,
    fills: [GREEN]
  })
  return { editor, pageId, source, target }
}

async function copyProperties(editor: Editor, ids: string[]) {
  editor.select(ids)
  const payload = await editor.prepareCopy({ properties: true })
  if (!payload.snapshot) throw new Error('Copy properties wrote no snapshot')
  return { html: payload.html, snapshot: payload.snapshot }
}

const fillOf = (editor: Editor, id: string) => getNodeOrThrow(editor.graph, id).fills[0]?.color

describe('paste properties', () => {
  test('moves the look of the copied layer without its geometry, rotation, or name', async () => {
    const { editor, source, target } = setup()
    const { snapshot } = await copyProperties(editor, [source.id])
    editor.select([target.id])
    expect(await editor.pastePropertiesFromSnapshot(snapshot)).toBe(1)

    const pasted = getNodeOrThrow(editor.graph, target.id)
    expect(pasted.fills[0]?.color).toEqual(RED.color)
    expect(pasted.strokes).toHaveLength(1)
    expect([pasted.borderTopWeight, pasted.independentStrokeWeights]).toEqual([5, true])
    expect([pasted.cornerRadius, pasted.opacity]).toEqual([8, 0.5])
    expect([pasted.name, pasted.width, pasted.height, pasted.x, pasted.rotation]).toEqual([
      'Target',
      60,
      60,
      200,
      0
    ])
  })

  test('reads a copy of the layers from the Figma clipboard format too', async () => {
    const { editor, source, target } = setup()
    const { html } = await copyProperties(editor, [source.id])
    editor.select([target.id])
    expect(await editor.pastePropertiesFromHTML(html)).toBe(1)
    expect(fillOf(editor, target.id)).toEqual(RED.color)
  })

  test('Paste skips a Copy properties payload, as Figma does', async () => {
    const { editor, pageId, source } = setup()
    const { html, snapshot } = await copyProperties(editor, [source.id])
    const count = () => editor.graph.getChildren(pageId).length
    const before = count()
    await editor.pasteSnapshot(snapshot)
    await editor.pasteFromHTML(html)
    expect(count()).toBe(before)
  })

  test('pastes onto every selected layer, locked ones too, in one undo step', async () => {
    const { editor, pageId, source, target } = setup()
    const locked = editor.graph.createNode('ELLIPSE', pageId, { fills: [GREEN], locked: true })
    const { snapshot } = await copyProperties(editor, [source.id])
    editor.select([target.id, locked.id])
    expect(await editor.pastePropertiesFromSnapshot(snapshot)).toBe(2)
    expect(fillOf(editor, locked.id)).toEqual(RED.color)

    editor.undoAction()
    expect([fillOf(editor, target.id), fillOf(editor, locked.id)]).toEqual([
      GREEN.color,
      GREEN.color
    ])
    editor.redoAction()
    expect(fillOf(editor, locked.id)).toEqual(RED.color)
  })

  test('a copy of several layers pastes nothing and leaves no undo step', async () => {
    const { editor, pageId, source, target } = setup()
    const other = editor.graph.createNode('ELLIPSE', pageId, { fills: [RED] })
    const { snapshot } = await copyProperties(editor, [source.id, other.id])
    editor.select([target.id])
    expect(await editor.pastePropertiesFromSnapshot(snapshot)).toBe(0)
    expect(fillOf(editor, target.id)).toEqual(GREEN.color)
    expect(editor.undo.canUndo).toBe(false)
  })

  test('auto layout and layout grids move only from one frame to another', async () => {
    const { editor, pageId, target } = setup()
    const frame = editor.graph.createNode('FRAME', pageId, {
      layoutMode: 'HORIZONTAL',
      itemSpacing: 14,
      paddingLeft: 9,
      fills: [RED]
    })
    const other = editor.graph.createNode('FRAME', pageId, { width: 120, height: 90 })
    const { snapshot } = await copyProperties(editor, [frame.id])
    editor.select([other.id, target.id])
    await editor.pastePropertiesFromSnapshot(snapshot)
    const pastedFrame = getNodeOrThrow(editor.graph, other.id)
    expect([pastedFrame.layoutMode, pastedFrame.itemSpacing, pastedFrame.paddingLeft]).toEqual([
      'HORIZONTAL',
      14,
      9
    ])
    expect(getNodeOrThrow(editor.graph, target.id).layoutMode).toBe('NONE')
    expect(fillOf(editor, target.id)).toEqual(RED.color)
  })

  test('variable bindings of the pasted fields replace the target’s and keep the rest', async () => {
    const { editor, source, target } = setup()
    const tokens = editor.graph.createCollection('Tokens')
    const color = (name: string, hex: string) =>
      editor.graph.createVariable(name, 'COLOR', tokens.id, colorToFill(hex).color).id
    const size = (name: string) => editor.graph.createVariable(name, 'FLOAT', tokens.id, 40).id
    const [brand, old, width, height] = [
      color('Brand', '#ff0000'),
      color('Old', '#00ff00'),
      size('Width'),
      size('Height')
    ]
    editor.graph.updateNode(source.id, { boundVariables: { 'fills/0/color': brand, width } })
    editor.graph.updateNode(target.id, { boundVariables: { 'fills/0/color': old, height } })
    const { snapshot } = await copyProperties(editor, [source.id])
    editor.select([target.id])
    await editor.pastePropertiesFromSnapshot(snapshot)
    expect(getNodeOrThrow(editor.graph, target.id).boundVariables).toEqual({
      'fills/0/color': brand,
      height
    })
  })

  test('a layer from another document keeps its values but drops links it cannot resolve', () => {
    const { editor, source } = setup()
    const foreign = {
      ...getNodeOrThrow(editor.graph, source.id),
      fillStyleId: 'missing-style',
      boundVariables: { opacity: 'missing-variable' }
    }
    const resolved = withResolvableLinks(foreign, editor.graph)
    expect([resolved.fillStyleId, resolved.boundVariables]).toEqual([null, {}])
    expect(resolved.fills[0]?.color).toEqual(RED.color)
  })
})

describe('paste properties on text', () => {
  function textSetup() {
    const editor = createEditor()
    const pageId = editor.graph.getPages()[0].id
    const styled = editor.graph.createNode('TEXT', pageId, {
      text: 'Styled',
      fontFamily: 'Inter',
      fontSize: 32,
      fontWeight: 700,
      paragraphSpacing: 10,
      fills: [RED]
    })
    const plain = editor.graph.createNode('TEXT', pageId, {
      text: 'Plain text',
      fontSize: 12,
      styleRuns: [
        { start: 0, length: 5, style: { fontSize: 40, hyperlink: LINK } },
        { start: 5, length: 5, style: { fills: [GREEN], fillStyleId: 'style-a' } }
      ]
    })
    const shape = editor.graph.createNode('RECTANGLE', pageId, { cornerRadius: 4 })
    return { editor, pageId, styled, plain, shape }
  }

  test('a text style covers every character run and keeps their links', async () => {
    const { editor, styled, plain } = textSetup()
    const { snapshot } = await copyProperties(editor, [styled.id])
    editor.select([plain.id])
    await editor.pastePropertiesFromSnapshot(snapshot)

    const pasted = getNodeOrThrow(editor.graph, plain.id)
    expect([pasted.fontSize, pasted.fontWeight, pasted.paragraphSpacing]).toEqual([32, 700, 10])
    expect(pasted.fills[0]?.color).toEqual(RED.color)
    expect(pasted.styleRuns).toEqual([{ start: 0, length: 5, style: { hyperlink: LINK } }])
  })

  test('mixed character styles of the copied text are not pasted', async () => {
    const { editor, pageId, plain } = textSetup()
    const target = editor.graph.createNode('TEXT', pageId, {
      text: 'Target',
      fontSize: 14,
      fills: [colorToFill('#0000ff')]
    })
    const { snapshot } = await copyProperties(editor, [plain.id])
    editor.select([target.id])
    await editor.pastePropertiesFromSnapshot(snapshot)
    const pasted = getNodeOrThrow(editor.graph, target.id)
    expect(pasted.fontSize).toBe(14)
    expect(pasted.fills[0]?.color).toEqual(colorToFill('#0000ff').color)
  })

  test('a shape gives text its paints but no corner radius, and text keeps a shape’s radius', async () => {
    const { editor, styled, plain, shape } = textSetup()
    editor.graph.updateNode(shape.id, { fills: [colorToFill('#0000ff')] })
    const fromShape = await copyProperties(editor, [shape.id])
    editor.select([plain.id])
    await editor.pastePropertiesFromSnapshot(fromShape.snapshot)
    const text = getNodeOrThrow(editor.graph, plain.id)
    expect(text.fills[0]?.color).toEqual(colorToFill('#0000ff').color)
    expect([text.fontSize, text.cornerRadius]).toEqual([12, 0])

    const fromText = await copyProperties(editor, [styled.id])
    editor.select([shape.id])
    await editor.pastePropertiesFromSnapshot(fromText.snapshot)
    const pastedShape = getNodeOrThrow(editor.graph, shape.id)
    expect(pastedShape.fills[0]?.color).toEqual(RED.color)
    expect([pastedShape.cornerRadius, pastedShape.fontSize]).toEqual([4, shape.fontSize])
  })
})
