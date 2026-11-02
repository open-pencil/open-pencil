import { beforeAll, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { getInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'

import { registerTestFont } from '#tests/helpers/fonts/bundled'

beforeAll(() => registerTestFont())

for (const text of ['User edit', '']) {
  test(`preserves API instance text edit ${JSON.stringify(text)} across save/reload`, async () => {
    await initCodec()
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const component = api.createComponent()
    const label = api.createText()
    label.characters = 'Default'
    component.appendChild(label)
    const edited = component.createInstance()
    edited.name = 'Edited'
    const inherited = component.createInstance()
    inherited.name = 'Inherited'
    edited.children[0].characters = text
    const raw = graph.getNode(edited.id)
    if (!raw) throw new Error('Missing instance')
    expect(
      getInstanceOverride(raw.instanceOverrides, edited.id, edited.children[0].id, 'text')
    ).toBe(true)
    label.characters = 'Component edit'
    graph.syncInstances(component.id)
    expect(edited.children[0].characters).toBe(text)
    expect(inherited.children[0].characters).toBe('Component edit')

    const bytes = await exportFigFile(graph)
    const restored = await parseFigFile(bytes.buffer as ArrayBuffer)
    for (const [name, expected] of [
      ['Edited', text],
      ['Inherited', 'Component edit']
    ]) {
      const instance = [...restored.getAllNodes()].find(
        (node) => node.type === 'INSTANCE' && node.name === name
      )
      if (!instance) throw new Error(`Missing ${name}`)
      expect(restored.getChildren(instance.id)[0]?.text).toBe(expected)
    }
  })
}
