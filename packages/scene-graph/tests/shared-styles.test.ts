import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { styleDetachmentChanges } from '@open-pencil/scene-graph/shared-styles'

function styledText() {
  const graph = new SceneGraph()
  return graph.createNode('TEXT', graph.getPages()[0].id, {
    text: 'Label',
    textStyleId: 'style:text',
    fillStyleId: 'style:fill'
  })
}

// Live-verified in Figma: a text style gives the whole text its paragraph spacing, paragraph
// indent, and list spacing, and setting one on a styled text leaves the style.
describe('an edit to a text style field', () => {
  test.each(['paragraphSpacing', 'paragraphIndent', 'listSpacing'] as const)(
    'of %s leaves the text style and keeps the fill style',
    (field) => {
      expect(styleDetachmentChanges(styledText(), { [field]: 3 })).toEqual({
        [field]: 3,
        textStyleId: null
      })
    }
  )

  test('that names the style too keeps it', () => {
    const changes = { fontSize: 20, textStyleId: 'style:other' }
    expect(styleDetachmentChanges(styledText(), changes)).toEqual(changes)
  })
})
