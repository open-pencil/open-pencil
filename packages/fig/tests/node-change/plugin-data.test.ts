import { describe, expect, test } from 'bun:test'

import {
  extractBoundVariables,
  extractExportSettings,
  extractLibrarySource,
  extractTextPathBox
} from '#fig/node-change/plugin-data'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { ExportSetting } from '@open-pencil/scene-graph'
import { clampExportScale } from '@open-pencil/scene-graph/export-scale'
import {
  OPEN_PENCIL_PLUGIN_DATA,
  OPEN_PENCIL_PLUGIN_ID
} from '@open-pencil/scene-graph/plugin-data'

function withPluginValue(key: string, value: string, extra: NodeChange = {}): NodeChange {
  return { ...extra, pluginData: [{ pluginID: OPEN_PENCIL_PLUGIN_ID, key, value }] }
}

describe('OpenPencil plugin data readers', () => {
  test('textPathBox requires finite numbers and a positive size', () => {
    const box = { x: 1, y: 2, width: 30, height: 40 }
    expect(
      extractTextPathBox(
        withPluginValue(OPEN_PENCIL_PLUGIN_DATA.textPathBox.key, JSON.stringify(box))
      )
    ).toEqual(box)
    for (const value of [
      '{not json',
      'null',
      JSON.stringify({ ...box, width: 0 }),
      JSON.stringify({ ...box, x: '1' })
    ]) {
      expect(
        extractTextPathBox(withPluginValue(OPEN_PENCIL_PLUGIN_DATA.textPathBox.key, value))
      ).toBeNull()
    }
  })

  test('bound variables keep string entries and drop the rest', () => {
    const value = JSON.stringify({ opacity: 'VariableID:1:2', width: 3 })
    expect(
      extractBoundVariables(withPluginValue(OPEN_PENCIL_PLUGIN_DATA.boundVariables.key, value))
    ).toEqual({
      opacity: 'VariableID:1:2'
    })
    for (const malformed of ['{not json', '["VariableID:1:2"]', '"VariableID:1:2"']) {
      expect(
        extractBoundVariables(
          withPluginValue(OPEN_PENCIL_PLUGIN_DATA.boundVariables.key, malformed)
        )
      ).toEqual({})
    }
  })

  test('effect aliases bind only the properties each effect has', () => {
    const alias = (localID: number, resolvedDataType: 'COLOR' | 'FLOAT') => ({
      dataType: 'ALIAS' as const,
      resolvedDataType,
      value: { alias: { guid: { sessionID: 1, localID } } }
    })
    expect(
      extractBoundVariables({
        effects: [
          { type: 'DROP_SHADOW', colorVar: alias(2, 'COLOR'), yVar: alias(3, 'FLOAT') },
          { type: 'FOREGROUND_BLUR', colorVar: alias(2, 'COLOR'), radiusVar: alias(3, 'FLOAT') }
        ]
      })
    ).toEqual({
      'effects/0/color': '1:2',
      'effects/0/offsetY': '1:3',
      'effects/1/radius': '1:3'
    })
  })

  test('export settings clamp scales and fall back to native settings when any entry is invalid', () => {
    const native: NodeChange = {
      exportSettings: [{ imageType: 'SVG', constraint: { type: 'CONTENT_SCALE', value: 1 } }]
    }
    expect(
      extractExportSettings(
        withPluginValue(
          OPEN_PENCIL_PLUGIN_DATA.exportSettings.key,
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
        extractExportSettings(
          withPluginValue(OPEN_PENCIL_PLUGIN_DATA.exportSettings.key, value, native)
        )
      ).toEqual([{ scale: 1, format: 'svg' }])
    }
  })

  test('native export settings keep Figma’s options, by name or by index', () => {
    expect(
      extractExportSettings({
        exportSettings: [
          {
            imageType: 'PNG',
            suffix: '@2x',
            constraint: { type: 'CONTENT_WIDTH', value: 120 },
            contentsOnly: false,
            useAbsoluteBounds: true,
            colorProfile: 'SRGB'
          },
          {
            imageType: 2,
            constraint: { type: 0, value: 3 },
            svgOutlineText: false,
            svgIDMode: 1,
            svgForceStrokeMasks: true,
            colorProfile: 0
          },
          { imageType: 'MP4' }
        ]
      })
    ).toEqual([
      {
        scale: 1,
        format: 'png',
        suffix: '@2x',
        size: { type: 'WIDTH', value: 120 },
        contentsOnly: false,
        useAbsoluteBounds: true,
        colorProfile: 'SRGB'
      },
      {
        scale: 3,
        format: 'svg',
        svgOutlineText: false,
        svgIdAttribute: true,
        svgSimplifyStroke: false
      }
    ])
  })

  test('export settings in plugin data keep Figma’s options', () => {
    const settings: ExportSetting[] = [
      {
        scale: 1,
        format: 'jpg',
        suffix: '-small',
        size: { type: 'HEIGHT', value: 40 },
        colorProfile: 'DISPLAY_P3_V4'
      }
    ]
    expect(
      extractExportSettings(
        withPluginValue(OPEN_PENCIL_PLUGIN_DATA.exportSettings.key, JSON.stringify(settings))
      )
    ).toEqual(settings)
  })

  test('library source defaults its optional fields and rejects a malformed identity', () => {
    const identity = { libraryId: 'lib', assetKey: 'button', revisionId: 'r1' }
    expect(
      extractLibrarySource(
        withPluginValue(
          OPEN_PENCIL_PLUGIN_DATA.librarySource.key,
          JSON.stringify({ identity, readOnly: 'yes' })
        )
      )
    ).toEqual({ identity, sourceNodeId: null, readOnly: false })
    expect(
      extractLibrarySource(
        withPluginValue(
          OPEN_PENCIL_PLUGIN_DATA.librarySource.key,
          JSON.stringify({ identity, sourceNodeId: '1:2', readOnly: true })
        )
      )
    ).toEqual({ identity, sourceNodeId: '1:2', readOnly: true })
    for (const value of [
      '{not json',
      JSON.stringify({ identity: { ...identity, revisionId: 1 } })
    ]) {
      expect(
        extractLibrarySource(withPluginValue(OPEN_PENCIL_PLUGIN_DATA.librarySource.key, value))
      ).toBeNull()
    }
  })
})
