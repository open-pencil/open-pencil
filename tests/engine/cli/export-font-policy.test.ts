import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { FONT_POLICIES, applyExportFontPolicy, exportFontRoots } from '#cli/export-font-policy'

function graphWithMissingFont(): { graph: SceneGraph; pageId: string } {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  graph.createNode('TEXT', page.id, {
    text: 'Hello',
    fontFamily: 'Definitely Missing Font',
    fontWeight: 400
  })
  return { graph, pageId: page.id }
}

test('font policy roots match node, page, and document export scopes', () => {
  expect(exportFontRoots('node', 'page', ['page', 'page-2'], true)).toEqual(['node'])
  expect(exportFontRoots(undefined, 'page', ['page', 'page-2'], false)).toEqual(['page'])
  expect(exportFontRoots(undefined, 'page', ['page', 'page-2'], true)).toEqual(['page', 'page-2'])
})

test('font policy values stay bounded', () => {
  expect([...FONT_POLICIES].sort()).toEqual(['allow', 'strict', 'warn'])
})

test('allow policy skips font preparation', async () => {
  const { graph, pageId } = graphWithMissingFont()
  await expect(applyExportFontPolicy(graph, [pageId], 'PNG', 'allow')).resolves.toBeUndefined()
})
