import { describe, expect, test } from 'bun:test'

import { createLibraryRevision, materializeLibraryAsset } from '@open-pencil/core/library'
import {
  emptyBehaviour,
  OPEN_PENCIL_PLUGIN_DATA,
  pluginDataEntry,
  readBehaviour,
  SceneGraph,
  withBehaviour,
  type Behaviour
} from '@open-pencil/scene-graph'

const OTHER_PLUGIN = { pluginId: 'tokens-studio', key: 'theme', value: 'dark' }

/** A Switch set with a behaviour, plugin data of another plugin, and a stale library source. */
function switchLibrary(behaviour: Behaviour) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const set = graph.createNode('COMPONENT_SET', page.id, {
    name: 'Switch',
    componentKey: 'switch',
    componentPropertyDefinitions: [
      {
        id: 'state',
        name: 'State',
        type: 'VARIANT',
        defaultValue: 'Off',
        variantOptions: ['Off', 'On']
      }
    ]
  })
  for (const value of ['Off', 'On'])
    graph.createNode('COMPONENT', set.id, {
      name: `State=${value}`,
      componentKey: `switch-${value}`,
      componentPropertyValues: { State: value }
    })
  const stale = pluginDataEntry(OPEN_PENCIL_PLUGIN_DATA.librarySource, {
    identity: { libraryId: 'elsewhere', assetKey: 'switch', revisionId: 'old' },
    sourceNodeId: null,
    readOnly: true
  })
  graph.updateNode(set.id, {
    pluginData: [...withBehaviour(set, behaviour), OTHER_PLUGIN, stale]
  })
  return graph
}

const SWITCH: Behaviour = {
  ...emptyBehaviour('switch'),
  booleans: { value: { propertyId: 'state', on: 'On', off: 'Off' } }
}

describe('plugin content in libraries', () => {
  test('a published control keeps its behaviour and other plugins’ data, not bookkeeping', async () => {
    const revision = await createLibraryRevision({
      libraryId: 'controls',
      name: 'Controls',
      graph: switchLibrary(SWITCH)
    })
    const consumer = new SceneGraph()
    const { componentSetId } = materializeLibraryAsset(consumer, revision, 'switch')
    const set = consumer.getNode(componentSetId ?? '')
    if (!set) throw new Error('Switch not inserted')

    expect(readBehaviour(set)).toEqual(SWITCH)
    expect(set.pluginData).toContainEqual(OTHER_PLUGIN)
    expect(set.pluginData.map((entry) => entry.key)).not.toContain(
      OPEN_PENCIL_PLUGIN_DATA.librarySource.key
    )
  })

  test('changing only a behaviour changes the asset, so instances are offered the update', async () => {
    const hash = async (behaviour: Behaviour) =>
      (
        await createLibraryRevision({
          libraryId: 'controls',
          name: 'Controls',
          graph: switchLibrary(behaviour)
        })
      ).manifest.assets.find((asset) => asset.key === 'switch')?.contentHash

    expect(await hash(SWITCH)).toBe(await hash(structuredClone(SWITCH)))
    expect(await hash({ ...SWITCH, kind: 'toggle' })).not.toBe(await hash(SWITCH))
  })
})
