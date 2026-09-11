import { describe, expect, it } from 'bun:test'

import { importClipboardNodes } from '@open-pencil/core'
import type { NodeChange } from '@open-pencil/core'
import { linkImportedInstanceChildren } from '@open-pencil/fig/node-change'
import { SceneGraph } from '@open-pencil/scene-graph'

import { getNodeOrThrow } from '#tests/helpers/assert'

describe('importClipboardNodes: instance child linkage', () => {
  it('links serialized instance children so a later component sync does not duplicate them', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Test')
    const pageId = page.id

    // Component with one FRAME child, plus an INSTANCE referencing it that carries a
    // SERIALIZED child (as Figma exports instances with their instantiated subtree).
    // The instance child is renamed ('Header v2') — exactly the case the sync-time
    // name+type fallback cannot match, so paste-time linkage is required.
    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      },
      {
        guid: { sessionID: 1, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'SYMBOL',
        name: 'Card',
        size: { x: 200, y: 60 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 1, localID: 11 },
        parentIndex: { guid: { sessionID: 1, localID: 10 }, position: '!' },
        type: 'FRAME',
        name: 'Header',
        size: { x: 200, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 2, localID: 20 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'INSTANCE',
        name: 'Card',
        size: { x: 200, y: 60 },
        transform: { m00: 1, m01: 0, m02: 300, m10: 0, m11: 1, m12: 0 },
        symbolData: { symbolID: { sessionID: 1, localID: 10 } }
      },
      {
        guid: { sessionID: 2, localID: 21 },
        parentIndex: { guid: { sessionID: 2, localID: 20 }, position: '!' },
        type: 'FRAME',
        name: 'Header v2',
        size: { x: 200, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      }
    ] as NodeChange[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(created).toHaveLength(2)

    const component = getNodeOrThrow(graph, created[0])
    expect(component.type).toBe('COMPONENT')
    const compChild = graph.getChildren(component.id)[0]
    expect(compChild?.name).toBe('Header')

    const instance = getNodeOrThrow(graph, created[1])
    expect(instance.type).toBe('INSTANCE')
    expect(instance.componentId).toBe(component.id)
    expect(instance.childIds).toHaveLength(1)

    // Paste-time linkage: the serialized instance child is stamped with its component
    // child's id — name-independent (positional + type), so renames do not defeat it.
    const instChild = getNodeOrThrow(graph, instance.childIds[0])
    expect(instChild.name).toBe('Header v2')
    expect(instChild.componentId).toBe(compChild.id)

    // A later component edit must sync props, not duplicate children.
    graph.updateNode(compChild.id, { height: 50 })
    graph.syncInstances(component.id)

    expect(instance.childIds).toHaveLength(1)
    expect(instChild.height).toBe(50)
  })

  it('does not mis-link an extra same-type child inserted before a renamed serialized child (overrideKey)', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Test')

    const comp = graph.createNode('COMPONENT', page.id, { name: 'Card' })
    const compHeader = graph.createNode('FRAME', comp.id, {
      name: 'Header',
      overrideKey: '1:100',
      width: 200,
      height: 40
    })

    const inst = graph.createNode('INSTANCE', page.id, {
      name: 'Card',
      componentId: comp.id
    })
    const extra = graph.createNode('FRAME', inst.id, {
      name: 'Badge',
      width: 60,
      height: 20,
      componentId: null
    })
    const renamed = graph.createNode('FRAME', inst.id, {
      name: 'Header v2',
      overrideKey: '1:100',
      width: 200,
      height: 40,
      componentId: null
    })

    expect(inst.childIds).toEqual([extra.id, renamed.id])

    linkImportedInstanceChildren(graph, new Set([inst.id]))

    expect(extra.componentId).toBeNull()
    expect(renamed.componentId).toBe(compHeader.id)

    graph.updateNode(compHeader.id, { height: 50 })
    graph.syncInstances(comp.id)

    expect(inst.childIds).toHaveLength(2)
    expect(graph.getNode(extra.id)?.name).toBe('Badge')
    expect(graph.getNode(extra.id)?.componentId).toBeNull()
    expect(graph.getNode(renamed.id)?.height).toBe(50)
    // Extra sorts to the end, mapped child first.
    expect(inst.childIds[0]).toBe(renamed.id)
    expect(inst.childIds[1]).toBe(extra.id)
  })

  it('leaves ambiguous positional children unmapped when cardinality differs', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Test')
    const component = graph.createNode('COMPONENT', page.id, { name: 'Card' })
    graph.createNode('FRAME', component.id, { name: 'Header' })
    const instance = graph.createNode('INSTANCE', page.id, {
      name: 'Card',
      componentId: component.id
    })
    const extra = graph.createNode('FRAME', instance.id, { name: 'Badge' })
    const serialized = graph.createNode('FRAME', instance.id, { name: 'Header v2' })

    linkImportedInstanceChildren(graph, new Set([instance.id]))

    expect(extra.componentId).toBeNull()
    expect(serialized.componentId).toBeNull()
    graph.syncInstances(component.id)
    expect(instance.childIds).toHaveLength(3)
    expect(instance.childIds).toEqual(expect.arrayContaining([extra.id, serialized.id]))
  })
})
