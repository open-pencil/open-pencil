import { expect, setDefaultTimeout, test } from 'bun:test'

import { exportFigFile, parseFigFile, readFigFile } from '@open-pencil/core/io/formats/fig'
import { headlessRenderer } from '@open-pencil/core/io/formats/raster'
import { computeAllLayouts, installTextMeasurer } from '@open-pencil/core/layout'
import { prepareGraphFonts } from '@open-pencil/core/text'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { runsHeavyTests } from '@open-pencil/test-support/heavy'
import { readFixtureArrayBuffer } from '@open-pencil/test-support/paths'

import { populateAllFigPages } from '#core/io/formats/fig'

setDefaultTimeout(60_000)

test('a hug instance keeps the height its own text laid it out to when reopened', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const [page] = graph.getPages()
  const component = graph.createNode('COMPONENT', page.id, {
    name: 'Tip',
    width: 320,
    height: 60,
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    paddingTop: 20,
    paddingBottom: 20
  })
  graph.createNode('TEXT', component.id, {
    name: 'Body',
    text: 'One line.',
    width: 280,
    height: 20,
    textAutoResize: 'HEIGHT'
  })
  const instance = expectDefined(graph.createInstance(component.id, page.id), 'instance')
  const body = expectDefined(graph.getChildren(instance.id)[0], 'instance body')
  // Four lines of text, and the hug frame laid out around them.
  graph.updateNode(body.id, {
    text: 'Four lines of text, as the layout measured them.',
    height: 80
  })
  graph.updateNode(instance.id, { height: 120 })

  const bytes = await exportFigFile(graph)
  const reopened = await readFigFile(new File([bytes.slice()], 'Tip.fig'))
  populateAllFigPages(reopened)
  const reopenedInstance = [...reopened.getAllNodes()].find((node) => node.type === 'INSTANCE')
  expect(reopenedInstance?.height).toBe(120)
  expect(reopened.getChildren(expectDefined(reopenedInstance, 'instance').id)[0]?.height).toBe(80)
})

test.if(runsHeavyTests)(
  'scaled instance text is laid out for its overridden string, as Figma shows it',
  async () => {
    const graph = await parseFigFile(readFixtureArrayBuffer('gold-preview.fig'))
    // The file saves no size for this copy, only the text "Category" over the component's "Copy".
    const copy = expectDefined(graph.getNode('0:1273'), 'scaled instance text')
    const renderer = await headlessRenderer()
    const uninstall = installTextMeasurer((node, maxWidth) =>
      renderer.measureTextNode(node, maxWidth)
    )
    try {
      await prepareGraphFonts(
        graph,
        graph.getPages(true).map((page) => page.id)
      )
      graph.applyDerivedLayoutDuring(() => computeAllLayouts(graph))
      // Figma 126 shows I1:3503;4188:18912;4186:34767 at 56×18.
      expect({ text: copy.text, width: copy.width, height: copy.height }).toEqual({
        text: 'Category',
        width: 56,
        height: 18
      })
    } finally {
      uninstall()
    }
  }
)
