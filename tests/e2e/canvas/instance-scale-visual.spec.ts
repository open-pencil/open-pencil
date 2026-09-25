import { pick } from 'es-toolkit/object'

import { computeAllLayouts, computeLayout } from '@open-pencil/core/layout'
import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import {
  reconcileNumericVariableBindings,
  rescaleNodeTree,
  type SceneNode,
  type SceneGraph
} from '@open-pencil/scene-graph'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import bindingFixture from '#tests/fixtures/nested-binding-ownership-records.json' with { type: 'json' }
import fixture from '#tests/fixtures/nested-layout-scale.json' with { type: 'json' }
import { absoluteConstraintRecords } from '#tests/helpers/fig/absolute-constraints'
import { inheritedNestedBindingRecords } from '#tests/helpers/fig/nested-binding'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const fields = [
  'type',
  'x',
  'y',
  'width',
  'height',
  'fills',
  'strokes',
  'strokeWeight',
  'cornerRadius',
  'opacity',
  'visible'
] as const
interface RenderNode {
  props: Pick<SceneNode, (typeof fields)[number]>
  children: RenderNode[]
}

function interpretedTree(phase: 'before' | 'edited'): RenderNode {
  const { graph, sources } = materializeDocument(
    [{ guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT' }, ...fixture[phase]] as NodeChange[],
    fixture.blobs.map((value) => new Uint8Array(Buffer.from(value, 'base64'))),
    { derivedBounds: true }
  )
  computeAllLayouts(graph)
  const rootId = sources.get(fixture.ids.instance)
  if (!rootId) throw new Error('Missing scaled instance')
  return renderTree(graph, rootId)
}

function renderTree(graph: SceneGraph, rootId: string): RenderNode {
  const visit = (id: string): RenderNode => {
    const node = graph.getNode(id)
    if (!node) throw new Error(`Missing node ${id}`)
    return {
      props: pick(node, fields),
      children: graph.getChildren(id).map((child) => visit(child.id))
    }
  }
  return visit(rootId)
}

async function renderTrees(trees: RenderNode[]) {
  await editor.page.evaluate((trees) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing editor')
    const visit = (tree: RenderNode, parentId: string) => {
      const { type, ...props } = tree.props
      const node = store.graph.createNode(type, parentId, props)
      for (const child of tree.children) visit(child, node.id)
    }
    for (const [index, tree] of trees.entries()) {
      tree.props.x = 20 + index * 60
      tree.props.y = 20
      visit(tree, store.state.currentPageId)
    }
    store.setZoomAroundPoint(6, 0, 0)
    store.requestRender()
  }, trees)
}

test('absolute constraints survive occurrence resizing', async () => {
  const { graph, sources } = materializeDocument(absoluteConstraintRecords())
  const id = sources.get('1:4')
  if (!id) throw new Error('Missing constrained instance')
  const child = graph.getChildren(id)[0]
  expect([child.x, child.y, child.width, child.height]).toEqual([180, 10, 10, 100])
  await renderTrees([renderTree(graph, id)])
  await editor.page.evaluate(() => window.openPencil?.getStore?.().setZoomAroundPoint(2, 0, 0))
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot(
    'absolute-constraint-resize.png'
  )
})

test('nested scale preserves before and edited padding after layout', async () => {
  await renderTrees([interpretedTree('before'), interpretedTree('edited')])
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('nested-layout-scale.png')
})

test('saved inherited expressions follow token edits without double scaling', async () => {
  const { graph, sources } = materializeDocument(
    inheritedNestedBindingRecords(),
    bindingFixture.blobs.map((value) => new Uint8Array(Buffer.from(value, 'base64'))),
    { derivedBounds: true }
  )
  const rootId = sources.get('293733:8')
  if (!rootId) throw new Error('Missing captured instance')
  const nested = graph.getChildren(rootId)[0]
  const variable = graph.variables.get(nested.boundVariables.paddingLeft)
  if (!variable) throw new Error('Missing inherited expression binding')
  computeLayout(graph, nested.id)
  computeLayout(graph, rootId)
  expect(nested.paddingLeft).toBe(5)
  const before = renderTree(graph, rootId)
  variable.valuesByMode[graph.getNodeVariableModeId(nested.id, variable.collectionId)] = 40
  reconcileNumericVariableBindings(graph)
  computeLayout(graph, nested.id)
  computeLayout(graph, rootId)
  expect(nested.paddingLeft).toBe(10)
  await renderTrees([before, renderTree(graph, rootId)])
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot(
    'expression-layout-scale.png'
  )
})

test('definition rescale updates existing occurrence geometry', async () => {
  const { graph, sources } = materializeDocument(
    inheritedNestedBindingRecords(),
    bindingFixture.blobs.map((value) => new Uint8Array(Buffer.from(value, 'base64'))),
    { derivedBounds: true }
  )
  const root = sources.get('293733:8'),
    outer = sources.get('1:4')
  if (!root || !outer) throw new Error('Missing captured sources')
  rescaleNodeTree(graph, root, 0.5)
  computeAllLayouts(graph)
  const before = renderTree(graph, root)
  rescaleNodeTree(graph, graph.getChildren(outer)[0].id, 2)
  graph.syncInstances(outer)
  computeAllLayouts(graph)
  const nested = graph.getChildren(root)[0]
  expect([graph.getNode(root)?.width, nested.width, nested.paddingLeft]).toEqual([22.5, 12.5, 5])
  await renderTrees([before, renderTree(graph, root)])
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot(
    'definition-layout-scale.png'
  )
})

for (const operation of ['component', 'rescale'] as const) {
  test(`${operation} edits preserve scaled geometry and authored bindings`, async () => {
    const { graph, sources } = materializeDocument(
      bindingFixture.nodeChanges as NodeChange[],
      bindingFixture.blobs.map((value) => new Uint8Array(Buffer.from(value, 'base64'))),
      { derivedBounds: true }
    )
    const rootId = sources.get('293733:8'),
      component = sources.get('1:2')
    if (!rootId || !component) throw new Error('Missing captured sources')
    const nested = graph.getChildren(rootId)[0]
    graph.bindVariable(rootId, 'paddingRight', '293742:7')
    graph.bindVariable(nested.id, 'paddingRight', '293742:7')
    reconcileNumericVariableBindings(graph)
    computeLayout(graph, nested.id)
    computeLayout(graph, rootId)
    const before = renderTree(graph, rootId)
    if (operation === 'component') {
      graph.updateNode(component, { paddingTop: 8 })
      graph.syncInstances(component)
    } else rescaleNodeTree(graph, rootId, 0.5)
    computeAllLayouts(graph)
    expect(nested.paddingTop).toBe(operation === 'component' ? 2 : 0.5)
    expect(nested.paddingRight).toBe(operation === 'component' ? 6 : 3)
    await renderTrees([before, renderTree(graph, rootId)])
    expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot(
      `${operation}-layout-scale.png`
    )
  })
}
