import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { createDefaultSourceMetadata } from '@open-pencil/scene-graph/node-defaults'

const percent = (value: number) => ({ value, unit: 'PERCENT' }) as const

test('undoing a variable bound on a text style brings back its percent spacing on its texts', () => {
  const editor = createEditor()
  const { graph } = editor
  const page = graph.getPages()[0].id
  const collection = graph.createCollection('Scale')
  const spacing = graph.createVariable('Spacing', 'FLOAT', collection.id, 5)
  const style = graph.createNodeWithId('style:body', 'TEXT', page, {
    name: 'Body',
    sharedStyleType: 'TEXT',
    internalOnly: true,
    fontSize: 20,
    letterSpacing: percent(10),
    source: { ...createDefaultSourceMetadata(), id: 'style:body' }
  })
  const text = graph.createNode('TEXT', page, {
    text: 'Label',
    fontSize: 20,
    letterSpacing: percent(10),
    textStyleId: 'style:body'
  })

  editor.bindVariable(style.id, 'letterSpacing', spacing.id)
  expect(text.letterSpacing).toEqual({ value: 5, unit: 'PIXELS' })

  editor.undo.undo()

  expect(style.letterSpacing).toEqual(percent(10))
  expect(text).toMatchObject({ letterSpacing: percent(10), textStyleId: 'style:body' })
})
