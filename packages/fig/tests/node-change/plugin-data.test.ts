import { describe, expect, test } from 'bun:test'

import {
  BOUND_VARIABLES_PLUGIN_KEY,
  EXPORT_SETTINGS_PLUGIN_KEY,
  extractBoundVariables,
  extractExportSettings,
  extractLibrarySource,
  extractTextPathBox,
  LIBRARY_SOURCE_PLUGIN_KEY,
  OPEN_PENCIL_PLUGIN_ID,
  TEXT_PATH_BOX_PLUGIN_KEY
} from '#fig/node-change/plugin-data'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { clampExportScale } from '@open-pencil/scene-graph'

function withPluginValue(key: string, value: string, extra: NodeChange = {}): NodeChange {
  return { ...extra, pluginData: [{ pluginID: OPEN_PENCIL_PLUGIN_ID, key, value }] }
}

describe('OpenPencil plugin data readers', () => {
  test('textPathBox requires finite numbers and a positive size', () => {
    const box = { x: 1, y: 2, width: 30, height: 40 }
    expect(
      extractTextPathBox(withPluginValue(TEXT_PATH_BOX_PLUGIN_KEY, JSON.stringify(box)))
    ).toEqual(box)
    for (const value of [
      '{not json',
      'null',
      JSON.stringify({ ...box, width: 0 }),
      JSON.stringify({ ...box, x: '1' })
    ]) {
      expect(extractTextPathBox(withPluginValue(TEXT_PATH_BOX_PLUGIN_KEY, value))).toBeNull()
    }
  })

  test('bound variables keep string entries and drop the rest', () => {
    const value = JSON.stringify({ opacity: 'VariableID:1:2', width: 3 })
    expect(extractBoundVariables(withPluginValue(BOUND_VARIABLES_PLUGIN_KEY, value))).toEqual({
      opacity: 'VariableID:1:2'
    })
    for (const malformed of ['{not json', '["VariableID:1:2"]', '"VariableID:1:2"']) {
      expect(extractBoundVariables(withPluginValue(BOUND_VARIABLES_PLUGIN_KEY, malformed))).toEqual(
        {}
      )
    }
  })

  test('export settings clamp scales and fall back to native settings when any entry is invalid', () => {
    const native: NodeChange = {
      exportSettings: [{ imageType: 'SVG', constraint: { type: 'CONTENT_SCALE', value: 1 } }]
    }
    expect(
      extractExportSettings(
        withPluginValue(
          EXPORT_SETTINGS_PLUGIN_KEY,
          JSON.stringify([{ scale: 1000, format: 'png' }])
        )
      )
    ).toEqual([{ scale: clampExportScale(1000), format: 'png' }])
    for (const value of [
      '{not json',
      JSON.stringify({ scale: 1, format: 'png' }),
      JSON.stringify([
        { scale: 2, format: 'png' },
        { scale: 1, format: 'gif' }
      ])
    ]) {
      expect(
        extractExportSettings(withPluginValue(EXPORT_SETTINGS_PLUGIN_KEY, value, native))
      ).toEqual([{ scale: 1, format: 'svg' }])
    }
  })

  test('library source defaults its optional fields and rejects a malformed identity', () => {
    const identity = { libraryId: 'lib', assetKey: 'button', revisionId: 'r1' }
    expect(
      extractLibrarySource(
        withPluginValue(LIBRARY_SOURCE_PLUGIN_KEY, JSON.stringify({ identity, readOnly: 'yes' }))
      )
    ).toEqual({ identity, sourceNodeId: null, readOnly: false })
    expect(
      extractLibrarySource(
        withPluginValue(
          LIBRARY_SOURCE_PLUGIN_KEY,
          JSON.stringify({ identity, sourceNodeId: '1:2', readOnly: true })
        )
      )
    ).toEqual({ identity, sourceNodeId: '1:2', readOnly: true })
    for (const value of [
      '{not json',
      JSON.stringify({ identity: { ...identity, revisionId: 1 } })
    ]) {
      expect(extractLibrarySource(withPluginValue(LIBRARY_SOURCE_PLUGIN_KEY, value))).toBeNull()
    }
  })
})
