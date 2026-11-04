import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { buildFigmaClipboardHTML } from '@open-pencil/core/clipboard'
import { createEditor } from '@open-pencil/core/editor'
import { FigmaAPI, type FigmaRectangleNode } from '@open-pencil/core/figma-api'
import { initCodec } from '@open-pencil/kiwi/fig/codec'

/** A Size set whose variants show a dot bound to its Show dot boolean. */
async function dotSet() {
  await initCodec()
  const editor = createEditor()
  const figma = new FigmaAPI(editor.graph)
  const dots: FigmaRectangleNode[] = []
  const variants = ['Size=Small', 'Size=Large'].map((name, index) => {
    const component = figma.createComponent()
    component.name = name
    component.x = index * 100
    const dot = figma.createRectangle()
    dot.name = 'Dot'
    component.appendChild(dot)
    dots.push(dot)
    return component
  })
  const set = figma.combineAsVariants(variants, figma.currentPage)
  const key = set.addComponentProperty('Show dot', 'BOOLEAN', true)
  for (const dot of dots) dot.componentPropertyReferences = { visible: key }
  const dot = expectDefined(editor.graph.getNode(dots[1].id), 'dot')
  return { editor, dot }
}

test('a layer copied out of a component pastes on the page without its binding', async () => {
  const { editor, dot } = await dotSet()
  const html = expectDefined(await buildFigmaClipboardHTML([dot], editor.graph), 'html')

  const target = createEditor()
  await target.pasteFromHTML(html)
  const pasted = expectDefined(
    [...target.graph.getAllNodes()].find((node) => node.name === 'Dot'),
    'pasted dot'
  )
  expect(pasted.componentPropertyReferences).toEqual([])
})
