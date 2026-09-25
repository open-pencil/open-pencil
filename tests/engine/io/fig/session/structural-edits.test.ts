import { expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { createFigDocumentSession } from '@open-pencil/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

for (const mutation of ['delete', 'reorder', 'add'] as const) {
  test(`later loads preserve live ${mutation} of component children`, async () => {
    await initCodec()
    const source = new SceneGraph()
    const first = source.getPages()[0]
    const second = source.addPage('Second')
    const component = source.createNode('COMPONENT', first.id)
    source.createNode('RECTANGLE', component.id, { name: 'A' })
    source.createNode('RECTANGLE', component.id, { name: 'B' })
    source.createInstance(component.id, second.id)
    const bytes = await exportFigFile(source)
    const session = createFigDocumentSession(bytes.buffer as ArrayBuffer)
    session.loadPage(session.pages[0].id)
    const live = [...session.graph.getAllNodes()].find((node) => node.type === 'COMPONENT')
    if (!live) throw new Error('Missing component')
    if (mutation === 'delete') session.graph.deleteNode(live.childIds[0])
    else if (mutation === 'reorder') session.graph.insertChildAt(live.childIds[1], live.id, 0)
    else session.graph.createNode('ELLIPSE', live.id, { name: 'C' })
    const before = structuredClone([...session.graph.nodes])
    session.loadPage(session.pages[1].id)
    expect(session.loadedPageIds.has(session.pages[1].id)).toBe(true)
    const after = session.graph.getNode(live.id)
    if (mutation === 'delete') expect(after?.childIds).toHaveLength(1)
    else if (mutation === 'add') {
      expect(after?.childIds).toHaveLength(3)
      const placed = session.graph
        .getAllNodes()
        .find(
          (node) => node.type === 'INSTANCE' && node.parentId === session.graph.getPages()[1].id
        )
      expect(placed && session.graph.getChildren(placed.id).map((node) => node.name)).toEqual([
        'A',
        'B',
        'C'
      ])
    } else expect(after?.childIds).toEqual(before.find(([id]) => id === live.id)?.[1].childIds)
  })
}
