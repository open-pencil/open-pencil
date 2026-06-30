import { describe, expect, test } from 'bun:test'

import {
  deduplicateNodeChangePluginData,
  parseFigKiwiContainer,
  type NodeChange
} from '../src/fig/parse'

describe('Figma FIG parse helpers', () => {
  test('rejects non fig-kiwi containers', () => {
    expect(parseFigKiwiContainer(new TextEncoder().encode('not-fig-kiwi'))).toBeNull()
  })

  test('deduplicates plugin data entries by full triple', () => {
    const changes: NodeChange[] = [
      {
        pluginData: [
          { pluginID: 'plugin', key: 'a', value: '1' },
          { pluginID: 'plugin', key: 'a', value: '1' },
          { pluginID: 'plugin', key: 'a', value: '2' }
        ],
        pluginRelaunchData: [
          { pluginID: 'plugin', command: 'run', message: 'Run', isDeleted: false },
          { pluginID: 'plugin', command: 'run', message: 'Run', isDeleted: false },
          { pluginID: 'plugin', command: 'run', message: 'Gone', isDeleted: true }
        ]
      }
    ]

    deduplicateNodeChangePluginData(changes)

    expect(changes[0]?.pluginData).toHaveLength(2)
    expect(changes[0]?.pluginRelaunchData).toHaveLength(2)
  })
})
