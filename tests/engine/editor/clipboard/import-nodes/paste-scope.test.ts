import { describe, expect, it } from 'bun:test'

import { importClipboardNodes } from '@open-pencil/core'
import type { NodeChange } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('importClipboardNodes: paste linkage scoping', () => {
  // This suite proves scoped paste linkage is load-bearing. Test 1 locks the
  // empty-set early return (paste with zero instances skips linkage entirely);
  // it passes under scoped, whole-graph-with-guard, and no-linkage, so it does
  // not by itself prove scoping — it discriminates unconditional whole-graph
  // linkage (no empty-set guard). Test 2 is the true scoping discriminator
  // (whole-graph corrupts the pre-existing Badge). See 05 debunking / 09 §19.
  it('does not re-link pre-existing instances when pasting content without instances (empty-set guard)', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Test')

    // Pre-existing component A with child 'Item 1', and instance instA with a
    // user-added extra child 'Badge' (componentId null) at index 0. This paste
    // carries zero instances, so pastedInstanceIds is empty and linkage is
    // skipped via the size>0 guard — the assertion below locks that guard.
    const comp = graph.createNode('COMPONENT', page.id, { name: 'A', width: 200, height: 60 })
    const compItem1 = graph.createNode('FRAME', comp.id, { name: 'Item 1', width: 100, height: 30 })
    const inst = graph.createNode('INSTANCE', page.id, {
      name: 'A Inst',
      componentId: comp.id,
      width: 200,
      height: 60
    })
    const badge = graph.createNode('FRAME', inst.id, {
      name: 'Badge',
      width: 20,
      height: 20,
      componentId: null
    })
    const instItem1 = graph.createNode('FRAME', inst.id, {
      name: 'Item 1',
      width: 100,
      height: 30,
      componentId: null
    })
    // badge at index 0, instItem1 at index 1 — badge sits at the positional slot
    // where a whole-graph linkage would have stamped it with compItem1.id.

    // Paste an unrelated rectangle (no instances) — exercises the empty-set path.
    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 3, localID: 30 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'RECTANGLE',
        name: 'Rect',
        size: { x: 50, y: 50 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      }
    ] as NodeChange[]

    importClipboardNodes(nodeChanges, graph, page.id)

    // Pre-existing instance untouched by the paste: badge still unlinked, still
    // at its original position. With an unconditional whole-graph linkage (no
    // size guard) this would have stamped badge with compItem1.id positionally
    // and a later sync would rename/overwrite it. With the empty-set guard the
    // paste is a no-op for linkage.
    expect(badge.componentId).toBeNull()
    expect(inst.childIds[0]).toBe(badge.id)
    expect(inst.childIds[1]).toBe(instItem1.id)

    // A later sync links instItem1 by name+type (fallback) and leaves badge alone.
    graph.syncInstances(comp.id)
    expect(badge.name).toBe('Badge')
    expect(badge.componentId).toBeNull()
    expect(instItem1.componentId).toBe(compItem1.id)
    expect(inst.childIds.length).toBe(2) // no duplication
    expect(inst.childIds[0]).toBe(instItem1.id) // mapped sorts first
    expect(inst.childIds[1]).toBe(badge.id) // unmapped extra sorts last
  })

  it('links pasted instances but not pre-existing instances in the same paste', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Test')

    // Pre-existing component + instance with a user-added extra child that must
    // survive the paste untouched.
    const preComp = graph.createNode('COMPONENT', page.id, {
      name: 'Pre',
      width: 200,
      height: 60
    })
    graph.createNode('FRAME', preComp.id, { name: 'Slot', width: 100, height: 30 })
    const preInst = graph.createNode('INSTANCE', page.id, {
      name: 'Pre Inst',
      componentId: preComp.id,
      width: 200,
      height: 60
    })
    const preExtra = graph.createNode('FRAME', preInst.id, {
      name: 'Badge',
      width: 20,
      height: 20,
      componentId: null
    })
    const preSlot = graph.createNode('FRAME', preInst.id, {
      name: 'Slot',
      width: 100,
      height: 30,
      componentId: null
    })

    // Paste a component 'Card' (FRAME child 'Header') plus an INSTANCE of it with a
    // serialized renamed child 'Header v2' — the pasted instance MUST be linked.
    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 4, localID: 40 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'SYMBOL',
        name: 'Card',
        size: { x: 200, y: 60 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 4, localID: 41 },
        parentIndex: { guid: { sessionID: 4, localID: 40 }, position: '!' },
        type: 'FRAME',
        name: 'Header',
        size: { x: 200, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 4, localID: 42 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'INSTANCE',
        name: 'Card',
        size: { x: 200, y: 60 },
        transform: { m00: 1, m01: 0, m02: 300, m10: 0, m11: 1, m12: 0 },
        symbolData: { symbolID: { sessionID: 4, localID: 40 } }
      },
      {
        guid: { sessionID: 4, localID: 43 },
        parentIndex: { guid: { sessionID: 4, localID: 42 }, position: '!' },
        type: 'FRAME',
        name: 'Header v2',
        size: { x: 200, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, page.id)
    expect(created).toHaveLength(2)

    // Pasted instance IS linked (positional + type, name-independent).
    const pastedInst = getNodeByType(graph, created, 'INSTANCE')
    const pastedComp = getNodeByType(graph, created, 'COMPONENT')
    if (!pastedInst || !pastedComp) throw new Error('pasted instance/component missing')
    expect(pastedInst.componentId).toBe(pastedComp.id)
    const pastedChild = graph.getChildren(pastedInst.id)[0]
    const pastedCompChild = graph.getChildren(pastedComp.id)[0]
    expect(pastedChild?.name).toBe('Header v2')
    expect(pastedChild?.componentId).toBe(pastedCompChild?.id)

    // Pre-existing instance is NOT re-linked by the same paste.
    expect(preExtra.componentId).toBeNull()
    expect(preInst.childIds[0]).toBe(preExtra.id)
    expect(preInst.childIds[1]).toBe(preSlot.id)
    expect(preSlot.componentId).toBeNull()
  })
})

function getNodeByType(
  graph: SceneGraph,
  created: string[],
  type: 'INSTANCE' | 'COMPONENT'
): ReturnType<SceneGraph['getNode']> {
  for (const id of created) {
    const node = graph.getNode(id)
    if (node?.type === type) return node
  }
  return undefined
}
