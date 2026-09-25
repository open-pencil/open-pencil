import { interpretInstance } from '@open-pencil/fig/instance-overrides'
import { nodeChangeToProps } from '@open-pencil/fig/node-change'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import fixture from '#tests/fixtures/styled-saved-glyphs.json' with { type: 'json' }

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('occurrence override renders new text rather than inherited source glyphs', async () => {
  const guid = (localID: number) => ({ sessionID: 1, localID })
  const source: NodeChange[] = [
    { guid: guid(1), type: 'SYMBOL' },
    {
      guid: guid(2),
      type: 'TEXT',
      parentIndex: { guid: guid(1), position: '!' },
      textData: { characters: fixture.text },
      fontName: { family: 'Inter', style: 'Regular' },
      fontSize: 40,
      size: { x: 450, y: 60 },
      textAutoResize: 'WIDTH_AND_HEIGHT',
      derivedTextData: {
        glyphs: fixture.derivedTextGlyphs.map((glyph, index) => ({
          commandsBlob: index,
          position: { x: glyph.x, y: glyph.y },
          fontSize: glyph.fontSize,
          firstCharacter: glyph.firstCharacter
        }))
      }
    },
    {
      guid: guid(3),
      type: 'INSTANCE',
      symbolData: {
        symbolID: guid(1),
        symbolOverrides: [{ guidPath: { guids: [guid(2)] }, textData: { characters: 'Toolbars' } }]
      }
    } as NodeChange
  ]
  const occurrence = interpretInstance(source, '1:3')
  const props = nodeChangeToProps(
    occurrence.children[0].properties,
    fixture.derivedTextGlyphs.map((glyph) => new Uint8Array(glyph.commandsBlob))
  )
  expect(props.derivedTextGlyphs).toHaveLength(0)
  await editor.page.evaluate((props) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    const { nodeType, ...values } = props
    if (nodeType !== 'TEXT') throw new Error('Expected text')
    store.graph.createNode(nodeType, store.state.currentPageId, {
      ...values,
      x: 80,
      y: 100,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 }]
    })
    store.requestRender()
  }, props)
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot(
    'occurrence-text-override.png'
  )
})
