import { describe, expect, test } from 'bun:test'

import { linkImportedInstanceChildren } from '@open-pencil/fig/node-change'
import { SceneGraph, recordInstanceOverride } from '@open-pencil/scene-graph'

describe('instance synchronization child deduplication', () => {
  test('syncInstances on instance with imported children without componentId does not duplicate children', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Page')

    // Component with 1 FRAME child
    const component = graph.createNode('COMPONENT', page.id, { name: 'Card' })
    const compChild = graph.createNode('FRAME', component.id, {
      name: 'Header',
      width: 200,
      height: 50
    })

    // Simulate an instance imported from .fig:
    // The instance exists, its child exists with name 'Header', type 'FRAME',
    // but its componentId is null/empty because it was imported from Figma.
    const instance = graph.createNode('INSTANCE', page.id, {
      name: 'Card Instance',
      componentId: component.id
    })
    const instChild = graph.createNode('FRAME', instance.id, {
      name: 'Header',
      width: 200,
      height: 50,
      componentId: null
    })

    expect(instance.childIds.length).toBe(1)
    expect(instance.childIds[0]).toBe(instChild.id)

    // Mutate the component child and synchronize
    graph.updateNode(compChild.id, { height: 60 })
    graph.syncInstances(component.id)

    // In unpatched code: instance.childIds.length becomes 2 because Header was re-cloned!
    expect(instance.childIds.length).toBe(1)
    expect(instance.childIds[0]).toBe(instChild.id)
    expect(instChild.height).toBe(60)
  })

  test('syncInstances handles nested imported subtrees without duplicating nested children', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Page')

    // Component hierarchy: Sidebar -> StatusFooter -> StatusRow
    const sidebar = graph.createNode('COMPONENT', page.id, {
      name: 'Sidebar',
      width: 240,
      height: 800
    })
    const statusFooter = graph.createNode('FRAME', sidebar.id, {
      name: 'Status Footer',
      width: 240,
      height: 40
    })
    const statusRow = graph.createNode('FRAME', statusFooter.id, {
      name: 'Status Row',
      width: 200,
      height: 24
    })

    // Instance hierarchy as imported from Figma (componentId is null on frames)
    const sidebarInst = graph.createNode('INSTANCE', page.id, {
      name: 'Sidebar Instance',
      componentId: sidebar.id
    })
    const statusFooterInst = graph.createNode('FRAME', sidebarInst.id, {
      name: 'Status Footer',
      width: 240,
      height: 40,
      componentId: null
    })
    const statusRowInst = graph.createNode('FRAME', statusFooterInst.id, {
      name: 'Status Row',
      width: 200,
      height: 24,
      componentId: null
    })

    expect(sidebarInst.childIds.length).toBe(1)
    expect(statusFooterInst.childIds.length).toBe(1)

    // Mutate statusRow inside the component
    graph.updateNode(statusRow.id, { height: 28, opacity: 0.8 })
    graph.syncInstances(sidebar.id)

    expect(sidebarInst.childIds.length).toBe(1)
    expect(sidebarInst.childIds[0]).toBe(statusFooterInst.id)
    expect(statusFooterInst.childIds.length).toBe(1)
    expect(statusFooterInst.childIds[0]).toBe(statusRowInst.id)
    expect(statusRowInst.height).toBe(28)
    expect(statusRowInst.opacity).toBe(0.8)
  })

  test('syncInstances preserves explicit instance overrides while updating non-overridden properties', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Page')

    const buttonComp = graph.createNode('COMPONENT', page.id, {
      name: 'Button',
      width: 100,
      height: 40
    })
    const labelComp = graph.createNode('TEXT', buttonComp.id, {
      name: 'Label',
      text: 'Submit',
      fontSize: 14,
      width: 80,
      height: 20
    })

    const buttonInst = graph.createNode('INSTANCE', page.id, {
      name: 'Button Instance',
      componentId: buttonComp.id
    })
    const labelInst = graph.createNode('TEXT', buttonInst.id, {
      name: 'Label',
      text: 'Custom Text', // override
      fontSize: 14,
      width: 80,
      height: 20,
      componentId: null
    })

    // Record override on text
    recordInstanceOverride(graph, labelInst.id, ['text'])

    // Mutate fontSize and text on component
    graph.updateNode(labelComp.id, { fontSize: 16, text: 'Click Here' })
    graph.syncInstances(buttonComp.id)

    expect(buttonInst.childIds.length).toBe(1)
    expect(labelInst.text).toBe('Custom Text') // preserved override
    expect(labelInst.fontSize).toBe(16) // synced from component
  })

  test('syncInstances adds newly added component children while keeping existing ones', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Page')

    const comp = graph.createNode('COMPONENT', page.id, { name: 'Menu' })
    const _item1 = graph.createNode('FRAME', comp.id, { name: 'Item 1' })

    const inst = graph.createNode('INSTANCE', page.id, {
      name: 'Menu Instance',
      componentId: comp.id
    })
    const instItem1 = graph.createNode('FRAME', inst.id, {
      name: 'Item 1',
      componentId: null
    })

    // Now add a second child to the component
    const _item2 = graph.createNode('FRAME', comp.id, { name: 'Item 2', height: 32 })
    graph.syncInstances(comp.id)

    expect(inst.childIds.length).toBe(2)
    expect(inst.childIds[0]).toBe(instItem1.id) // original child preserved
    const instItem2 = graph.getNode(inst.childIds[1])
    expect(instItem2?.name).toBe('Item 2')
    expect(instItem2?.height).toBe(32)
  })
})

describe('instance synchronization regressions from review triage', () => {
  // V1: matchFallbackChildren backward iteration inverts same-name/type siblings.
  test('duplicate same-name/type siblings preserve FIFO mapping during fallback sync', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Page')

    const comp = graph.createNode('COMPONENT', page.id, { name: 'List', width: 200, height: 60 })
    graph.createNode('FRAME', comp.id, { name: 'Row', width: 100, height: 30 })
    graph.createNode('FRAME', comp.id, { name: 'Row', width: 200, height: 30 })

    const inst = graph.createNode('INSTANCE', page.id, {
      name: 'List Inst',
      componentId: comp.id,
      width: 200,
      height: 60
    })
    const iA = graph.createNode('FRAME', inst.id, {
      name: 'Row',
      width: 50,
      height: 30,
      componentId: null
    })
    const iB = graph.createNode('FRAME', inst.id, {
      name: 'Row',
      width: 60,
      height: 30,
      componentId: null
    })

    graph.syncInstances(comp.id)

    expect(iA.width).toBe(100)
    expect(iB.width).toBe(200)
    expect(inst.childIds[0]).toBe(iA.id)
    expect(inst.childIds[1]).toBe(iB.id)
  })

  test('duplicate same-name siblings preserve overrides on the correct child', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Page')

    const comp = graph.createNode('COMPONENT', page.id, { name: 'Rows', width: 200, height: 60 })
    graph.createNode('TEXT', comp.id, {
      name: 'Label',
      text: 'A',
      fontSize: 14,
      width: 80,
      height: 20
    })
    graph.createNode('TEXT', comp.id, {
      name: 'Label',
      text: 'B',
      fontSize: 14,
      width: 80,
      height: 20
    })

    const inst = graph.createNode('INSTANCE', page.id, {
      name: 'Rows Inst',
      componentId: comp.id,
      width: 200,
      height: 60
    })
    const labelA = graph.createNode('TEXT', inst.id, {
      name: 'Label',
      text: 'override-A',
      fontSize: 14,
      width: 80,
      height: 20,
      componentId: null
    })
    const labelB = graph.createNode('TEXT', inst.id, {
      name: 'Label',
      text: 'override-B',
      fontSize: 14,
      width: 80,
      height: 20,
      componentId: null
    })

    recordInstanceOverride(graph, labelA.id, ['text'])

    const compLabels = comp.childIds
      .map((id) => graph.getNode(id))
      .filter((n): n is NonNullable<typeof n> => n !== undefined)
    graph.updateNode(compLabels[0].id, { text: 'A-changed' })
    graph.updateNode(compLabels[1].id, { text: 'B-changed' })

    graph.syncInstances(comp.id)

    expect(labelA.text).toBe('override-A')
    expect(labelB.text).toBe('B-changed')
  })

  // V2+V3: extra unmatched instance child is not co-opted by positional or type-only fallback.
  test('extra unmatched instance child is not co-opted or renamed by fallback matching', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Page')

    const comp = graph.createNode('COMPONENT', page.id, { name: 'Menu', width: 200, height: 60 })
    graph.createNode('FRAME', comp.id, { name: 'Item 1', width: 100, height: 30 })

    const inst = graph.createNode('INSTANCE', page.id, {
      name: 'Menu Inst',
      componentId: comp.id,
      width: 200,
      height: 60
    })
    const instItem1 = graph.createNode('FRAME', inst.id, {
      name: 'Item 1',
      width: 100,
      height: 30,
      componentId: null
    })
    const extra = graph.createNode('FRAME', inst.id, {
      name: 'Badge',
      width: 20,
      height: 20,
      componentId: null
    })

    graph.createNode('FRAME', comp.id, { name: 'Item 2', width: 100, height: 32 })

    graph.syncInstances(comp.id)

    expect(extra.name).toBe('Badge')
    expect(extra.width).toBe(20)
    expect(extra.height).toBe(20)
    expect(inst.childIds.length).toBe(3)
    expect(inst.childIds[0]).toBe(instItem1.id)
    expect(inst.childIds).toContain(extra.id)
  })

  // Sort tie-break contract: mapped children sort in component order, unmapped extras
  // sort to the END (not the front). Locks the deliberate behavior change where the
  // comparator sends unmapped children (no componentId resolving to a comp child) to
  // the end instead of the front.
  test('unmapped extra children sort to the end after sync, mapped children keep component order', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Page')

    const comp = graph.createNode('COMPONENT', page.id, { name: 'Menu', width: 200, height: 60 })
    graph.createNode('FRAME', comp.id, { name: 'Item 1', width: 100, height: 30 })
    const compItem2 = graph.createNode('FRAME', comp.id, { name: 'Item 2', width: 100, height: 32 })

    const inst = graph.createNode('INSTANCE', page.id, {
      name: 'Menu Inst',
      componentId: comp.id,
      width: 200,
      height: 60
    })
    const instItem1 = graph.createNode('FRAME', inst.id, {
      name: 'Item 1',
      width: 100,
      height: 30,
      componentId: null
    })
    const extra = graph.createNode('FRAME', inst.id, {
      name: 'Badge',
      width: 20,
      height: 20,
      componentId: null
    })

    graph.syncInstances(comp.id)

    expect(inst.childIds.length).toBe(3)
    // Mapped children in component child order first...
    expect(inst.childIds[0]).toBe(instItem1.id)
    const instItem2 = graph.getNode(inst.childIds[1])
    expect(instItem2?.name).toBe('Item 2')
    expect(instItem2?.componentId).toBe(compItem2.id)
    // ...unmapped extra LAST — not yanked to the front on every sync.
    expect(inst.childIds[2]).toBe(extra.id)
  })

  // V5: self-referential component does not cause unbounded recursion / OOM.
  test('self-referential component does not hang or OOM on syncInstances', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Page')

    const comp = graph.createNode('COMPONENT', page.id, { name: 'Self', width: 100, height: 50 })
    graph.createNode('INSTANCE', comp.id, {
      name: 'Self Inst',
      componentId: comp.id,
      width: 100,
      height: 50
    })

    graph.syncInstances(comp.id)

    expect(graph.countDescendants(comp.id)).toBeLessThan(50)
  })

  test('syncInstances on component with instance whose componentId is an ancestor is bounded', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Page')

    const outer = graph.createNode('COMPONENT', page.id, { name: 'Outer', width: 200, height: 100 })
    const inner = graph.createNode('COMPONENT', outer.id, { name: 'Inner', width: 100, height: 50 })
    graph.createNode('INSTANCE', inner.id, {
      name: 'Outer Inst',
      componentId: outer.id,
      width: 200,
      height: 100
    })

    graph.syncInstances(outer.id)
    graph.syncInstances(inner.id)

    expect(graph.countDescendants(outer.id)).toBeLessThan(100)
  })

  // V7: graph-scoped syncingComponents. GENUINE reentrancy test — unlike the old
  // two-sequential-calls version (which passed even with NO guard), this fires the
  // reentrancy guard from inside a sync via the node:created event (emitted when
  // syncChildren Pass 3 clones a missing component child), and proves a second graph
  // with the same componentId can sync while the first is mid-sync — the exact
  // property a module-global Set breaks.
  test('reentrant syncInstances is a no-op, and a second graph with the same component ID syncs mid-sync', () => {
    const graph1 = new SceneGraph()
    const page1 = graph1.getPages()[0]
    if (!page1) throw new Error('page1 missing')
    graph1.createNodeWithId('comp-x', 'COMPONENT', page1.id, { name: 'C', width: 100, height: 50 })
    // Component child so Pass 3 clones it into inst-x — the clone fires node:created
    // mid-sync, which is where the reentrancy is exercised from.
    graph1.createNodeWithId('comp-row', 'FRAME', 'comp-x', { name: 'Row', width: 100, height: 10 })
    graph1.createNodeWithId('inst-x', 'INSTANCE', page1.id, {
      name: 'I',
      componentId: 'comp-x',
      width: 100,
      height: 50
    })

    const graph2 = new SceneGraph()
    const page2 = graph2.getPages()[0]
    if (!page2) throw new Error('page2 missing')
    graph2.createNodeWithId('comp-x', 'COMPONENT', page2.id, { name: 'C', width: 80, height: 40 })
    graph2.createNodeWithId('inst-x', 'INSTANCE', page2.id, {
      name: 'I',
      componentId: 'comp-x',
      width: 100,
      height: 50
    })

    let firedDuringSync = 0
    let graph2SyncedDuringSync = false

    // Arm AFTER both graphs exist, so the handler only fires for nodes created
    // during graph1's sync (the Pass 3 clone).
    const unbind = graph1.onNodeEvents({
      created: () => {
        // Re-entrant sync of the SAME graph+component must be safe: the guard makes
        // it a no-op, and even a hypothetical non-guarded re-entry must stay
        // idempotent (the clone already carries componentId, so Pass 1 matches it
        // and nothing is re-cloned). Call it to prove neither path corrupts state.
        graph1.syncInstances('comp-x')

        // Cross-graph sync with the SAME componentId must proceed (WeakMap scoping).
        graph2.syncInstances('comp-x')
        firedDuringSync++
        if (graph2.getNode('inst-x')?.width === 80) graph2SyncedDuringSync = true
      }
    })

    try {
      graph1.syncInstances('comp-x')
    } finally {
      unbind()
    }

    // The handler fired at least once during the sync (reentrancy actually exercised —
    // this is what makes the test non-vacuous).
    expect(firedDuringSync).toBeGreaterThan(0)
    // The re-entrant graph1 sync left exactly one clone of comp-row (no corruption).
    expect(graph1.getNode('inst-x')?.childIds.length).toBe(1)
    // graph2's instance synced while graph1's sync was in progress — a module-global
    // Set would have blocked this ('comp-x' already marked in-flight). This is the
    // discriminating assertion: the old sequential-calls test passed even with a
    // module-global Set; this one does not.
    expect(graph2SyncedDuringSync).toBe(true)
    expect(graph2.getNode('inst-x')?.width).toBe(80)
    // The outer sync still completed correctly: inst1 synced its component's width.
    expect(graph1.getNode('inst-x')?.width).toBe(100)
  })

  // V4: import-linkage does not stamp sub-instance descendants with proxy componentIds.
  test('linkImportedInstanceChildren does not recurse across INSTANCE boundaries', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Page')

    const compB = graph.createNode('COMPONENT', page.id, { name: 'B', width: 100, height: 50 })
    const compBChild = graph.createNode('FRAME', compB.id, { name: 'G', width: 80, height: 30 })

    const compA = graph.createNode('COMPONENT', page.id, { name: 'A', width: 200, height: 100 })
    const compA_F = graph.createNode('FRAME', compA.id, { name: 'F', width: 200, height: 100 })
    const compA_N = graph.createNode('INSTANCE', compA_F.id, {
      name: 'N',
      componentId: compB.id,
      width: 100,
      height: 50
    })
    const compA_N_Child = graph.createNode('FRAME', compA_N.id, {
      name: 'G',
      width: 80,
      height: 30,
      componentId: null
    })

    const instA = graph.createNode('INSTANCE', page.id, {
      name: 'A Inst',
      componentId: compA.id,
      width: 200,
      height: 100
    })
    const instA_F = graph.createNode('FRAME', instA.id, {
      name: 'F',
      width: 200,
      height: 100,
      componentId: null
    })
    const instA_N = graph.createNode('INSTANCE', instA_F.id, {
      name: 'N',
      componentId: compB.id,
      width: 100,
      height: 50
    })
    const instA_N_Child = graph.createNode('FRAME', instA_N.id, {
      name: 'G',
      width: 80,
      height: 30,
      componentId: null
    })

    linkImportedInstanceChildren(graph)

    expect(instA_N_Child.componentId).toBe(compBChild.id)
    expect(instA_N_Child.componentId).not.toBe(compA_N_Child.id)
  })

  test('syncInstances on sub-instance main component works after linkImportedInstanceChildren', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Page')

    const compB = graph.createNode('COMPONENT', page.id, { name: 'B', width: 100, height: 50 })
    const compBChild = graph.createNode('FRAME', compB.id, { name: 'G', width: 80, height: 30 })

    const compA = graph.createNode('COMPONENT', page.id, { name: 'A', width: 200, height: 100 })
    const compA_F = graph.createNode('FRAME', compA.id, { name: 'F', width: 200, height: 100 })
    graph.createNode('INSTANCE', compA_F.id, {
      name: 'N',
      componentId: compB.id,
      width: 100,
      height: 50
    })

    const instA = graph.createNode('INSTANCE', page.id, {
      name: 'A Inst',
      componentId: compA.id,
      width: 200,
      height: 100
    })
    const instA_F = graph.createNode('FRAME', instA.id, {
      name: 'F',
      width: 200,
      height: 100,
      componentId: null
    })
    const instA_N = graph.createNode('INSTANCE', instA_F.id, {
      name: 'N',
      componentId: compB.id,
      width: 100,
      height: 50
    })
    const instA_N_Child = graph.createNode('FRAME', instA_N.id, {
      name: 'G',
      width: 80,
      height: 30,
      componentId: null
    })

    linkImportedInstanceChildren(graph)

    graph.updateNode(compBChild.id, { height: 40 })
    graph.syncInstances(compB.id)

    expect(instA_N_Child.height).toBe(40)
  })
})
