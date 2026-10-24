import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor, isEmptyDocumentChange } from '@open-pencil/core'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'

const replaceWith = expectDefined(
  ALL_TOOLS.find((tool) => tool.name === 'node_replace_with'),
  'node_replace_with tool'
)

describe('node_replace_with', () => {
  test('a replacement that fails partway keeps the original layer and adds nothing', async () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const card = editor.graph.createNode('FRAME', pageId, { name: 'Card', width: 400, height: 300 })
    const photo = editor.graph.createNode('RECTANGLE', card.id, {
      name: 'Photo',
      x: 20,
      y: 30,
      width: 200,
      height: 100
    })
    const figma = new FigmaAPI(editor.graph)
    const nodesBefore = editor.graph.nodes.size
    const finish = editor.captureDocumentChange(pageId)

    const error = await Promise.resolve(
      replaceWith.execute(figma, {
        id: photo.id,
        jsx: '<Frame name="Badge" w={100} h={100}><Rect name="Backdrop" w={100} h={100} /><Icon name="Icon" /></Frame>'
      })
    ).then(
      () => {
        throw new Error('the replacement succeeded')
      },
      (error: unknown) => error
    )

    expect(error).toMatchObject({ message: expect.stringContaining('Invalid icon name "Icon"') })
    expect(editor.graph.getNode(card.id)?.childIds).toEqual([photo.id])
    expect(editor.graph.getNode(photo.id)).toMatchObject({ name: 'Photo', x: 20, y: 30 })
    expect(editor.graph.nodes.size).toBe(nodesBefore)
    expect(isEmptyDocumentChange(finish())).toBe(true)
  })
})
