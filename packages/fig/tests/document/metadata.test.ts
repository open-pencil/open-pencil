import { describe, expect, test } from 'bun:test'

import { applyDocumentMetadata } from '#fig/document/metadata'
import { ENABLED_LIBRARIES_PLUGIN_KEY, OPEN_PENCIL_PLUGIN_ID } from '#fig/node-change/plugin-data'

import { SceneGraph } from '@open-pencil/scene-graph'

function enabledLibraries(value: string) {
  const graph = new SceneGraph()
  applyDocumentMetadata(graph, {
    pluginData: [{ pluginID: OPEN_PENCIL_PLUGIN_ID, key: ENABLED_LIBRARIES_PLUGIN_KEY, value }]
  })
  return [...graph.enabledLibraries.values()]
}

describe('document metadata', () => {
  test('restores valid enabled libraries and skips invalid entries', () => {
    expect(
      enabledLibraries(
        JSON.stringify([
          { libraryId: 'design-system', revisionId: 'r1', enabled: true },
          { libraryId: 'icons', revisionId: 'r2', enabled: 'yes' },
          { libraryId: 'broken', revisionId: 3 },
          null
        ])
      )
    ).toEqual([
      { libraryId: 'design-system', revisionId: 'r1', enabled: true },
      { libraryId: 'icons', revisionId: 'r2', enabled: false }
    ])
  })

  test('ignores malformed or non-array enabled libraries', () => {
    expect(enabledLibraries('{not json')).toEqual([])
    expect(
      enabledLibraries(JSON.stringify({ libraryId: 'design-system', revisionId: 'r1' }))
    ).toEqual([])
  })
})
