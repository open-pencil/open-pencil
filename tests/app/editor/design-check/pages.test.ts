import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import type { DesignIssue } from '@/app/editor/design-check/issues'
import { createPageChecks, pageOf } from '@/app/editor/design-check/pages'

/** Lets every scheduled zero-delay check run. */
async function settle() {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

function issue(nodeId: string, pageId: string, severity: DesignIssue['severity']): DesignIssue {
  return {
    id: `rule:${nodeId}:0`,
    ruleId: 'rule',
    nodeId,
    pageId,
    severity,
    message: 'rule',
    nodeName: nodeId,
    nodePath: [nodeId]
  }
}

/** `pendingNames`: pages a large file has not loaded yet, by name. */
function setup(pendingNames: string[] = []) {
  const graph = new SceneGraph()
  const first = graph.getPages()[0]
  const second = graph.addPage('Second')
  const third = graph.addPage('Third')
  const checked: string[] = []
  const checks = createPageChecks({
    graph: () => graph,
    currentPageId: () => first.id,
    isPending: (pageId) => pendingNames.includes(graph.getNode(pageId)?.name ?? ''),
    isBusy: () => false,
    check: (pageId) => {
      checked.push(pageId)
      return [issue(`layer-on-${pageId}`, pageId, 'error')]
    },
    delays: { idle: 0, step: 0 }
  })
  return { graph, first, second, third, checked, checks }
}

describe('background page checks', () => {
  test('check every other loaded page once, and take the current page from the live check', async () => {
    const { first, second, third, checked, checks } = setup()

    checks.start()
    checks.report(first.id, [issue('live', first.id, 'warning')])
    await settle()

    expect(checked.toSorted()).toEqual([second.id, third.id].toSorted())
    expect(checks.counts.value.get(first.id)).toEqual({ error: 0, warning: 1, info: 0 })
    expect(checks.counts.value.get(second.id)).toEqual({ error: 1, warning: 0, info: 0 })
    expect(checks.queued.value).toEqual([])
    checks.stop()
  })

  test('check again only the page an edit touched', async () => {
    const { graph, second, third, checked, checks } = setup()
    checks.start()
    await settle()
    checked.length = 0

    const layer = graph.createNode('FRAME', third.id, { name: 'Card' })
    checks.invalidate(pageOf(graph, layer.id))
    await settle()

    expect(checked).toEqual([third.id])
    expect(checked).not.toContain(second.id)
    checks.stop()
  })

  test('leave pages a large file has not loaded unchecked', async () => {
    const { first, second, third, checked, checks } = setup(['Third'])

    checks.start()
    checks.report(first.id, [])
    await settle()

    expect(checked).toEqual([second.id])
    expect(checks.notLoaded.value).toEqual([third.id])
    expect(checks.queued.value).toEqual([])
    checks.stop()
  })
})

describe('pageOf', () => {
  test('finds the page of a nested layer, and a page is its own page', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id)
    const child = graph.createNode('RECTANGLE', frame.id)

    expect(pageOf(graph, child.id)).toBe(page.id)
    expect(pageOf(graph, page.id)).toBe(page.id)
    expect(pageOf(graph, null)).toBeNull()
  })

  test('returns no page for layers whose parents form a cycle', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const first = graph.createNode('FRAME', page.id)
    const second = graph.createNode('FRAME', first.id)
    graph.updateNode(first.id, { parentId: second.id })

    expect(pageOf(graph, second.id)).toBeNull()
  })
})
