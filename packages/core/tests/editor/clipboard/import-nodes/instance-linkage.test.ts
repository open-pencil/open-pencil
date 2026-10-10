import { describe, expect, it } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { importClipboardNodes } from '@open-pencil/core'
import type { NodeChange } from '@open-pencil/core'
import { instanceLayerId, SceneGraph } from '@open-pencil/scene-graph'

describe('importClipboardNodes: instance children', () => {
  it('expands pasted instance children so a later component sync does not duplicate them', () => {
    const graph = new SceneGraph()
    const page = graph.addPage('Test')
    const pageId = page.id

    // Component with one FRAME child, plus an INSTANCE referencing it whose child is
    // renamed through a saved name override, the way Figma records it. The reader
    // expands the child from the component and links it, so the rename cannot defeat
    // a later sync.
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
        symbolData: {
          symbolID: { sessionID: 1, localID: 10 },
          symbolOverrides: [
            { guidPath: { guids: [{ sessionID: 1, localID: 11 }] }, name: 'Header v2' }
          ]
        }
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

    // The expanded child carries the override and its component child's id.
    const instChild = getNodeOrThrow(graph, instance.childIds[0])
    expect(instChild.name).toBe('Header v2')
    expect(instChild.id).toBe(instanceLayerId(instance.id, [compChild.id]))

    // A later component edit must sync props, not duplicate children.
    graph.updateNode(compChild.id, { height: 50 })
    graph.syncInstances(component.id)

    expect(instance.childIds).toHaveLength(1)
    expect(instChild.height).toBe(50)
  })
})
