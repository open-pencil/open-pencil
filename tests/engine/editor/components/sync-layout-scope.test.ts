import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createComponentSyncScheduler } from '#core/editor/component-sync'
import { computeAllLayouts } from '#core/layout'

function createGraph() {
  const graph = new SceneGraph()
  const componentPage = graph.getPages()[0]
  const instancePage = graph.addPage('Instances')
  const unrelatedPage = graph.addPage('Unrelated')

  const component = graph.createNode('COMPONENT', componentPage.id, {
    name: 'Button',
    width: 200,
    height: 40,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    itemSpacing: 8,
    paddingLeft: 16
  })
  const label = graph.createNode('TEXT', component.id, { name: 'Label', text: 'Label', x: 0, y: 0 })
  const instance = graph.createInstance(component.id, instancePage.id, { x: 0, y: 0 })
  const unrelated = graph.createNode('FRAME', unrelatedPage.id, {
    name: 'Dashboard',
    width: 300,
    height: 200,
    layoutMode: 'VERTICAL',
    itemSpacing: 4
  })
  graph.createNode('TEXT', unrelated.id, { name: 'Title', text: 'Title', x: 0, y: 0 })

  return {
    graph,
    componentPage,
    instancePage,
    unrelatedPage,
    component,
    label,
    instance,
    unrelated
  }
}

describe('component sync layout scope', () => {
  test('recomputes only the pages that changed, including cross-page instances', async () => {
    const { graph, componentPage, instancePage, unrelatedPage, label } = createGraph()
    const scopes: (string | undefined)[] = []
    const { scheduleComponentSync } = createComponentSyncScheduler(
      () => graph,
      () => undefined,
      (innerGraph, scopeId) => {
        scopes.push(scopeId)
        computeAllLayouts(innerGraph, scopeId)
      }
    )

    graph.updateNode(label.id, { text: 'Renamed label' })
    scheduleComponentSync(label.id)

    await Promise.resolve()
    expect([...scopes].sort()).toEqual([componentPage.id, instancePage.id].sort())
    expect(scopes).not.toContain(unrelatedPage.id)
    expect(scopes).not.toContain(undefined)
  })

  test('an edit outside any component does no layout work', async () => {
    const { graph, unrelated } = createGraph()
    const scopes: (string | undefined)[] = []
    const { scheduleComponentSync } = createComponentSyncScheduler(
      () => graph,
      () => undefined,
      (innerGraph, scopeId) => {
        scopes.push(scopeId)
        computeAllLayouts(innerGraph, scopeId)
      }
    )

    graph.updateNode(unrelated.id, { width: 400 })
    scheduleComponentSync(unrelated.id)

    await Promise.resolve()
    expect(scopes).toEqual([])
  })

  test('a cross-page instance still receives the component layout', async () => {
    const { graph, instance, component } = createGraph()
    const { scheduleComponentSync } = createComponentSyncScheduler(
      () => graph,
      () => undefined,
      computeAllLayouts
    )

    // Widen the component's padding, which moves its label; the instance must follow.
    const label = graph.getChildren(component.id)[0]
    if (!label) throw new Error('Expected a component child')
    graph.updateNode(label.id, { text: 'A much longer label' })
    scheduleComponentSync(label.id)

    await Promise.resolve()
    const instanceLabel = graph.getChildren(instance.id)[0]
    const componentLabel = graph.getChildren(component.id)[0]
    expect(instanceLabel).toBeDefined()
    expect(instanceLabel?.x).toBe(componentLabel?.x)
    expect(instanceLabel?.width).toBe(componentLabel?.width)
  })
})
