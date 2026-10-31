import { pick } from 'es-toolkit/object'
import { deflateSync } from 'fflate'
import { toUint8Array } from 'js-base64'

import { computeAllLayouts, computeLayout } from '@open-pencil/core/layout'
import { materializeDocument, writeFigArchive } from '@open-pencil/fig'
import {
  createNodeChangesMessage,
  encodeMessage,
  getSchemaBytes,
  initCodec,
  type NodeChange
} from '@open-pencil/kiwi/fig/codec'
import { type SceneNode, SceneGraph } from '@open-pencil/scene-graph'
import { rescaleNodeTree } from '@open-pencil/scene-graph/scaling'
import { reconcileVariableBindings } from '@open-pencil/scene-graph/variables'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import bindingFixture from '#tests/fixtures/nested-binding-ownership-records.json' with { type: 'json' }
import fixture from '#tests/fixtures/nested-layout-scale.json' with { type: 'json' }
import { readScenePixels } from '#tests/helpers/canvas/pixels'
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
    fixture.blobs.map((value) => toUint8Array(value)),
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

test('nested visibility assignments keep the outer icon visible after synchronization', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const definitions = [
    { id: 'visible', name: 'Visible', type: 'BOOLEAN' as const, defaultValue: 'false' }
  ]
  const inner = graph.createNode('COMPONENT', page.id, {
    width: 40,
    height: 40,
    componentPropertyDefinitions: definitions,
    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.7, b: 0.3, a: 1 }, visible: true, opacity: 1 }]
  })
  graph.createNode('RECTANGLE', inner.id, {
    width: 40,
    height: 40,
    visible: false,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }],
    componentPropertyReferences: [{ propertyId: 'visible', field: 'VISIBLE' }]
  })
  const outer = graph.createNode('COMPONENT', page.id, {
    width: 40,
    height: 40,
    componentPropertyDefinitions: definitions
  })
  graph.createInstance(inner.id, outer.id, {
    componentPropertyReferences: [{ propertyId: 'visible', field: 'VISIBLE' }],
    componentPropertyAssignments: { visible: 'false' }
  })
  const instance = graph.createInstance(outer.id, page.id, {
    componentPropertyAssignments: { visible: 'true' }
  })
  if (!instance) throw new Error('Missing nested instance')
  graph.syncInstances(outer.id)
  const icon = graph.getChildren(instance.id)[0]
  expect(icon.visible).toBe(true)
  expect(graph.getChildren(icon.id)[0].visible).toBe(false)
  await renderTrees([renderTree(graph, instance.id)])
  await editor.canvas.waitForRender()
  const [[r, g, b]] = await readScenePixels(editor.page, [{ x: 240, y: 240 }])
  expect(g).toBeGreaterThan(Math.max(r, b))
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot(
    'nested-visibility-scope.png'
  )
})

test('a content-sized copy keeps its center while component edits still propagate', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const component = graph.createNode('COMPONENT', page, {
    width: 100,
    height: 80,
    fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9, a: 1 }, visible: true, opacity: 1 }]
  })
  const source = graph.createNode('FRAME', component.id, {
    x: 10,
    y: 20,
    width: 80,
    height: 40,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    horizontalConstraint: 'CENTER',
    verticalConstraint: 'CENTER',
    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.7, b: 0.3, a: 1 }, visible: true, opacity: 1 }]
  })
  const instance = graph.createInstance(component.id, page)
  if (!instance) throw new Error('Missing content-sized instance')
  const copy = graph.getChildren(instance.id)[0]
  graph.updateNode(copy.id, { x: 10, y: 20, width: 40, height: 20 })
  graph.updateNode(source.id, { opacity: 0.75 })
  graph.syncInstances(component.id)
  expect([copy.x, copy.y, copy.width, copy.height]).toEqual([30, 30, 40, 20])
  expect(copy.opacity).toBe(0.75)
  await renderTrees([renderTree(graph, instance.id)])
  await editor.canvas.waitForRender()
  const [[r, g, b]] = await readScenePixels(editor.page, [{ x: 420, y: 360 }])
  expect(g).toBeGreaterThan(Math.max(r, b))
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('content-size-anchor.png')
})

test('layout keeps a rotated imported Hug panel inside its instance', async () => {
  const guid = (localID: number) => ({ sessionID: 1, localID })
  const { graph, sources } = materializeDocument(
    [
      { guid: guid(0), type: 'DOCUMENT' },
      { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
      {
        guid: guid(2),
        type: 'SYMBOL',
        parentIndex: { guid: guid(1), position: '!' },
        size: { x: 100, y: 80 },
        stackMode: 'VERTICAL',
        stackPrimarySizing: 'FIXED',
        stackCounterSizing: 'FIXED'
      },
      {
        guid: guid(3),
        type: 'FRAME',
        parentIndex: { guid: guid(2), position: '!' },
        size: { x: 80, y: 40 },
        stackMode: 'VERTICAL',
        stackPrimarySizing: 'RESIZE_TO_FIT',
        transform: { m00: -1, m01: 0, m02: 80, m10: 0, m11: -1, m12: 40 },
        fillPaints: [{ type: 'SOLID', color: { r: 0.1, g: 0.7, b: 0.3, a: 1 } }]
      },
      {
        guid: guid(4),
        type: 'INSTANCE',
        parentIndex: { guid: guid(1), position: '"' },
        size: { x: 100, y: 80 },
        symbolData: { symbolID: guid(2) }
      }
    ] as NodeChange[],
    [],
    { derivedBounds: true }
  )
  const instance = sources.get('1:4')
  if (!instance) throw new Error('Missing rotated panel instance')
  computeAllLayouts(graph)
  const panel = graph.getChildren(instance)[0]
  expect(panel.x).toBeCloseTo(0)
  expect(panel.y).toBeCloseTo(0)
  expect(panel.rotation).toBe(180)
  await renderTrees([renderTree(graph, instance)])
  await editor.canvas.waitForRender()
  const [[r, g, b]] = await readScenePixels(editor.page, [{ x: 240, y: 240 }])
  expect(g).toBeGreaterThan(Math.max(r, b))
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('rotated-imported-hug.png')
})

test('a bound root swap renders its replacement paint rather than its old cache', async () => {
  const guid = (localID: number) => ({ sessionID: 1, localID })
  const paint = (r: number, g: number): NonNullable<NodeChange['fillPaints']> => [
    { type: 'SOLID', color: { r, g, b: 0, a: 1 }, opacity: 1, visible: true }
  ]
  const records: NodeChange[] = [
    { guid: guid(0), type: 'DOCUMENT' },
    { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
    {
      guid: guid(2),
      type: 'SYMBOL',
      parentIndex: { guid: guid(1), position: '!' },
      size: { x: 40, y: 40 },
      fillPaints: paint(1, 0)
    },
    {
      guid: guid(3),
      type: 'SYMBOL',
      parentIndex: { guid: guid(1), position: '"' },
      size: { x: 40, y: 40 },
      fillPaints: paint(0, 1)
    },
    {
      guid: guid(4),
      type: 'SYMBOL',
      parentIndex: { guid: guid(1), position: '#' },
      size: { x: 40, y: 40 },
      componentPropDefs: [
        { id: guid(90), type: 'INSTANCE_SWAP', initialValue: { guidValue: guid(2) } }
      ]
    },
    {
      guid: guid(5),
      type: 'INSTANCE',
      parentIndex: { guid: guid(4), position: '!' },
      size: { x: 40, y: 40 },
      fillPaints: paint(1, 0),
      symbolData: { symbolID: guid(2) },
      parameterConsumptionMap: {
        entries: [
          {
            variableField: 'OVERRIDDEN_SYMBOL_ID',
            variableData: {
              value: { propRefValue: { defId: guid(90) } },
              dataType: 'PROP_REF',
              resolvedDataType: 'SYMBOL_ID'
            }
          }
        ]
      }
    },
    {
      guid: guid(6),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '!' },
      size: { x: 40, y: 40 },
      symbolData: { symbolID: guid(4) },
      componentPropAssignments: [{ defID: guid(90), value: { guidValue: guid(3) } }]
    }
  ]
  const { graph, sources } = materializeDocument(records, [], { derivedBounds: true })
  const instance = sources.get('1:6')
  if (!instance) throw new Error('Missing paint-swap instance')
  expect(graph.getChildren(instance)[0].fills[0].color.g).toBe(1)
  await renderTrees([renderTree(graph, instance)])
  await editor.canvas.waitForRender()
  const [[r, g, b]] = await readScenePixels(editor.page, [{ x: 240, y: 240 }])
  expect(g).toBeGreaterThan(Math.max(r, b))
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('bound-swap-root-paint.png')
  await initCodec()
  const bytes = writeFigArchive({
    schemaDeflated: deflateSync(getSchemaBytes()),
    kiwiData: encodeMessage(createNodeChangesMessage(0, 0, records)),
    thumbnailPNG: new Uint8Array(),
    metaJSON: '{}'
  })
  const workerPaint = await editor.page.evaluate(
    async (saved) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      await store.openFigFile(new File([new Uint8Array(saved)], 'Bound-swap.fig'))
      const root = store.graph
        .getChildren(store.state.currentPageId)
        .find(
          (node) =>
            node.type === 'INSTANCE' && node.componentPropertyAssignments['1:90'] !== undefined
        )
      if (!root) throw new Error('Imported bound instance unavailable')
      return store.graph.getChildren(root.id)[0].fills[0].color
    },
    [...bytes]
  )
  expect(workerPaint.g).toBe(1)
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    store.pan(-store.state.panX, -store.state.panY)
    store.setZoomAroundPoint(1, 0, 0)
  })
})

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
    bindingFixture.blobs.map((value) => toUint8Array(value)),
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
  reconcileVariableBindings(graph)
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
    bindingFixture.blobs.map((value) => toUint8Array(value)),
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
      bindingFixture.blobs.map((value) => toUint8Array(value)),
      { derivedBounds: true }
    )
    const rootId = sources.get('293733:8'),
      component = sources.get('1:2')
    if (!rootId || !component) throw new Error('Missing captured sources')
    const nested = graph.getChildren(rootId)[0]
    graph.bindVariable(rootId, 'paddingRight', '293742:7')
    graph.bindVariable(nested.id, 'paddingRight', '293742:7')
    reconcileVariableBindings(graph)
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
