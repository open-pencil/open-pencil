import { describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import {
  createLibraryRevision,
  deserializeLibraryRevision,
  encodeStoredLibraryRevision,
  storedLibraryRevisionSchema
} from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'
import {
  getInstanceOverride,
  setInstanceOverride
} from '@open-pencil/scene-graph/instances/overrides'

describe('stored library revisions', () => {
  test('keep values shaped like the tags they are stored with', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const icon = graph.createNode('COMPONENT', page.id, { name: 'Icon', componentKey: 'icon' })
    const button = graph.createNode('COMPONENT', page.id, {
      name: 'Button',
      componentKey: 'button'
    })
    const instance = graph.createInstance(icon.id, button.id)
    if (!instance) throw new Error('Expected the icon instance')
    const values = [{ $bytes: 'AQID' }, { $openPencilType: 'openpencil/map', entries: [] }]
    for (const [index, value] of values.entries())
      setInstanceOverride(
        instance.instanceOverrides,
        instance.id,
        instance.id,
        `pluginData/${index}`,
        value
      )

    const revision = await createLibraryRevision({ libraryId: 'design-system', name: 'DS', graph })
    const stored = v.parse(
      v.pipe(v.string(), v.parseJson(), storedLibraryRevisionSchema),
      JSON.stringify(encodeStoredLibraryRevision(revision))
    )
    const restored = [...deserializeLibraryRevision(stored).graph.getAllNodes()].find(
      (node) => node.type === 'INSTANCE'
    )
    if (!restored) throw new Error('Expected the stored instance')

    expect(
      values.map((_, index) =>
        getInstanceOverride(
          restored.instanceOverrides,
          restored.id,
          restored.id,
          `pluginData/${index}`
        )
      )
    ).toEqual(values)
  })
})
