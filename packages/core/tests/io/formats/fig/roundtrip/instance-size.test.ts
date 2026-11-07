import { expect, setDefaultTimeout, test } from 'bun:test'

import { FigmaAPI, flushPendingLayout } from '@open-pencil/core/figma-api'
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
  'an unrelated move keeps scaled instance text size when saving with a thumbnail',
  async () => {
    const graph = await parseFigFile(readFixtureArrayBuffer('gold-preview.fig'))
    graph.applyDerivedLayoutDuring(() => computeAllLayouts(graph))
    const original = expectDefined(graph.getNode('0:1273'), 'scaled instance text')
    const size = { width: original.width, height: original.height }
    const renderer = await headlessRenderer()
    const uninstall = installTextMeasurer((node, maxWidth) =>
      renderer.measureTextNode(node, maxWidth)
    )
    try {
      await prepareGraphFonts(
        graph,
        graph.getPages(true).map((page) => page.id)
      )
      const figma = new FigmaAPI(graph)
      figma.setRenderer(renderer)
      const target = figma.getNodeById('1:3461')
      if (!target || target.type !== 'FRAME') throw new Error('Missing frame target')
      target.x += 37
      flushPendingLayout(graph)
      const exported = await exportFigFile(graph, { renderHeadlessThumbnail: true })
      const reopened = await parseFigFile(exported.slice().buffer)
      const restored = expectDefined(reopened.getNode('0:1273'), 'reopened scaled instance text')
      expect(reopened.getNode('1:3461')?.x).toBe(37)
      expect({ width: restored.width, height: restored.height }).toEqual(size)
    } finally {
      uninstall()
    }
  }
)

test.if(runsHeavyTests)(
  'new instances in an imported document still measure their text',
  async () => {
    const graph = await parseFigFile(readFixtureArrayBuffer('gold-preview.fig'))
    const page = expectDefined(graph.getPages()[0], 'page')
    const component = graph.createNode('COMPONENT', page.id, {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      width: 100,
      height: 100
    })
    graph.createNode('TEXT', component.id, {
      text: 'Category',
      width: 100,
      height: 100,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    const instance = expectDefined(graph.createInstance(component.id, page.id), 'new instance')
    const copy = expectDefined(graph.getChildren(instance.id)[0], 'new instance text')
    expect(copy.source.orderKey).toBeNull()
    expect(copy.source.editedFields).toEqual([])
    const uninstall = installTextMeasurer(() => ({ width: 32, height: 18 }))
    try {
      computeAllLayouts(graph, instance.id)
      expect(copy.width).toBe(32)
      expect(copy.height).toBe(18)
    } finally {
      uninstall()
    }
  }
)
