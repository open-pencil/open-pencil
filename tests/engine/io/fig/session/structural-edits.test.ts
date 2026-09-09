import { expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { createFigDocumentSession } from '@open-pencil/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

for (const mutation of ['delete', 'reorder'] as const) {
  test(`later loads reject ${mutation} of component children without changing the graph`, async () => {
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
    else session.graph.insertChildAt(live.childIds[1], live.id, 0)
    const before = structuredClone([...session.graph.nodes])
    expect(() => session.loadPage(session.pages[1].id)).toThrow('structural reconciliation')
    expect([...session.graph.nodes]).toEqual(before)
    expect(session.loadedPageIds.has(session.pages[1].id)).toBe(false)
  })
}
