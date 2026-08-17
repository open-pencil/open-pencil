import type { NodeChange, PluginData, PluginRelaunchData } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import {
  clampExportScale,
  type ExportFormatId,
  type ExportSetting,
  type PluginDataEntry,
  type PluginRelaunchDataEntry,
  type SceneNode
} from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { readEffectiveFigmaRawField } from '../source-metadata'
import { resolveVariableConsumptionEntry } from './variable-bindings'

export const OPEN_PENCIL_PLUGIN_ID = 'open-pencil'
export const TEXT_DIRECTION_PLUGIN_KEY = 'textDirection'
export const LAYOUT_DIRECTION_PLUGIN_KEY = 'layoutDirection'
export const NODE_TYPE_PLUGIN_KEY = 'nodeType'
export const BOUND_VARIABLES_PLUGIN_KEY = 'boundVariables'
export const EXPORT_SETTINGS_PLUGIN_KEY = 'exportSettings'
export const TEXT_PATH_BOX_PLUGIN_KEY = 'textPathBox'
export const LIBRARY_SOURCE_PLUGIN_KEY = 'librarySource'
export const ENABLED_LIBRARIES_PLUGIN_KEY = 'enabledLibraries'

const NATIVE_EXPORT_FORMATS: Record<string, ExportFormatId> = {
  PNG: 'png',
  JPEG: 'jpg',
  SVG: 'svg',
  PDF: 'pdf'
}

export function upsertPluginData(
  node: { pluginData: PluginDataEntry[] },
  key: string,
  value: string
): void {
  const pluginData = node.pluginData.filter(
    (entry) => !(entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === key)
  )
  pluginData.push({ pluginId: OPEN_PENCIL_PLUGIN_ID, key, value })
  node.pluginData = pluginData
}

export function applyExportSettingsPluginData(
  node: Pick<SceneNode, 'exportSettings' | 'pluginData' | 'source'>
): void {
  if (node.exportSettings.length === 0) return
  if (
    !hasOpenPencilExportSettingsPluginData(node.pluginData) &&
    Array.isArray(readEffectiveFigmaRawField(node, 'exportSettings'))
  ) {
    return
  }
  upsertPluginData(node, EXPORT_SETTINGS_PLUGIN_KEY, JSON.stringify(node.exportSettings))
}

/**
 * textPathBox is OpenPencil-only state (the node-local rect the TEXT_PATH
 * layout path maps onto, after import-time box expansion and resize scaling).
 * The Kiwi schema has no home for it, and reconstructing it from an expanded,
 * resized node is ambiguous — persist it as plugin data so save/reopen keeps
 * reflow anchored correctly.
 */
export function applyTextPathBoxPluginData(node: {
  textPathBox: Rect | null
  pluginData: PluginDataEntry[]
}): void {
  if (!node.textPathBox) return
  upsertPluginData(node, TEXT_PATH_BOX_PLUGIN_KEY, JSON.stringify(node.textPathBox))
}

export function extractTextPathBox(nc: NodeChange): Rect | null {
  const value = getOpenPencilPluginValue(nc, TEXT_PATH_BOX_PLUGIN_KEY)
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<Rect> | null
    if (!parsed || typeof parsed !== 'object') return null
    const { x, y, width, height } = parsed
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number'
    ) {
      return null
    }
    if (!Number.isFinite(x + y + width + height) || width <= 0 || height <= 0) return null
    return { x, y, width, height }
  } catch {
    return null
  }
}

function hasOpenPencilExportSettingsPluginData(pluginData: PluginDataEntry[]): boolean {
  return pluginData.some(
    (entry) => entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === EXPORT_SETTINGS_PLUGIN_KEY
  )
}

function parseBoundVariablesPluginValue(value: string | null): Record<string, string> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === 'string' && typeof entry[1] === 'string'
      )
    )
  } catch {
    return {}
  }
}

export function extractBoundVariables(nc: NodeChange): Record<string, string> {
  const bindings = parseBoundVariablesPluginValue(
    getOpenPencilPluginValue(nc, BOUND_VARIABLES_PLUGIN_KEY)
  )
  for (const entry of nc.variableConsumptionMap?.entries ?? []) {
    const binding = resolveVariableConsumptionEntry(entry)
    if (binding) bindings[binding.field] = binding.variableId
  }
  nc.fillPaints?.forEach((paint, i) => {
    const variableGuid =
      paint.colorVariableBinding?.variableID ?? paint.colorVar?.value?.alias?.guid
    if (variableGuid) bindings[`fills/${i}/color`] = guidToString(variableGuid)
  })
  nc.strokePaints?.forEach((paint, i) => {
    const variableGuid =
      paint.colorVariableBinding?.variableID ?? paint.colorVar?.value?.alias?.guid
    if (variableGuid) bindings[`strokes/${i}/color`] = guidToString(variableGuid)
  })
  return bindings
}

function isExportFormatId(value: unknown): value is ExportFormatId {
  return (
    value === 'png' || value === 'jpg' || value === 'webp' || value === 'svg' || value === 'pdf'
  )
}

function parseExportSettingsPluginValue(value: string | null): ExportSetting[] | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return null
    const settings = parsed.flatMap((entry): ExportSetting[] => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
      const scale = (entry as { scale?: unknown }).scale
      const format = (entry as { format?: unknown }).format
      if (typeof scale !== 'number' || !Number.isFinite(scale) || !isExportFormatId(format)) {
        return []
      }
      // Clamp at the file-format boundary: imported plugin data may carry an
      // out-of-range scale the UI would never produce.
      return [{ scale: clampExportScale(scale), format }]
    })
    return settings.length === parsed.length ? settings : null
  } catch {
    return null
  }
}

function mapNativeImageType(imageType: unknown): ExportFormatId | null {
  if (typeof imageType === 'string') return NATIVE_EXPORT_FORMATS[imageType] ?? null
  if (imageType === 0) return 'png'
  if (imageType === 1) return 'jpg'
  if (imageType === 2) return 'svg'
  if (imageType === 3) return 'pdf'
  return null
}

function extractNativeConstraintScale(constraint: unknown): number {
  if (!constraint || typeof constraint !== 'object' || Array.isArray(constraint)) return 1
  const type = (constraint as { type?: unknown }).type
  if (type !== 'CONTENT_SCALE' && type !== 0) return 1
  const value = (constraint as { value?: unknown }).value
  // Clamp native CONTENT_SCALE too: malformed .fig data can carry huge multipliers.
  return typeof value === 'number' && Number.isFinite(value) ? clampExportScale(value) : 1
}

export function extractExportSettings(nc: NodeChange): ExportSetting[] {
  const pluginSettings = parseExportSettingsPluginValue(
    getOpenPencilPluginValue(nc, EXPORT_SETTINGS_PLUGIN_KEY)
  )
  if (pluginSettings) return pluginSettings

  return (nc.exportSettings ?? []).flatMap((entry): ExportSetting[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const format = mapNativeImageType((entry as { imageType?: unknown }).imageType)
    if (!format) return []
    return [
      {
        scale: extractNativeConstraintScale((entry as { constraint?: unknown }).constraint),
        format
      }
    ]
  })
}

export function extractPluginData(nc: NodeChange): PluginDataEntry[] {
  return (nc.pluginData ?? []).map((entry) => ({
    pluginId: entry.pluginID,
    key: entry.key,
    value: entry.value
  }))
}

export function extractLibrarySource(nc: NodeChange): SceneNode['librarySource'] {
  const value = getOpenPencilPluginValue(nc, LIBRARY_SOURCE_PLUGIN_KEY)
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const source = parsed as {
      identity?: { libraryId?: unknown; assetKey?: unknown; revisionId?: unknown }
      sourceNodeId?: unknown
      readOnly?: unknown
    }
    if (
      typeof source.identity?.libraryId !== 'string' ||
      typeof source.identity.assetKey !== 'string' ||
      typeof source.identity.revisionId !== 'string'
    ) {
      return null
    }
    return {
      identity: {
        libraryId: source.identity.libraryId,
        assetKey: source.identity.assetKey,
        revisionId: source.identity.revisionId
      },
      sourceNodeId: typeof source.sourceNodeId === 'string' ? source.sourceNodeId : null,
      readOnly: source.readOnly === true
    }
  } catch {
    return null
  }
}

export function applyLibrarySourcePluginData(node: SceneNode): void {
  if (node.librarySource) {
    upsertPluginData(node, LIBRARY_SOURCE_PLUGIN_KEY, JSON.stringify(node.librarySource))
  } else {
    node.pluginData = node.pluginData.filter(
      (entry) =>
        !(entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === LIBRARY_SOURCE_PLUGIN_KEY)
    )
  }
}

export function getOpenPencilPluginValue(nc: NodeChange, key: string): string | null {
  return (
    nc.pluginData?.find((entry) => entry.pluginID === OPEN_PENCIL_PLUGIN_ID && entry.key === key)
      ?.value ?? null
  )
}

export function extractPluginRelaunchData(nc: NodeChange): PluginRelaunchDataEntry[] {
  return (nc.pluginRelaunchData ?? []).map((entry) => ({
    pluginId: entry.pluginID,
    command: entry.command,
    message: entry.message,
    isDeleted: entry.isDeleted
  }))
}

export function mergePluginData(pluginData: PluginDataEntry[]): PluginData[] {
  return pluginData.map((entry) => ({
    pluginID: entry.pluginId,
    key: entry.key,
    value: entry.value
  }))
}

export function serializePluginRelaunchData(
  entries: PluginRelaunchDataEntry[]
): PluginRelaunchData[] {
  return entries.map((entry) => ({
    pluginID: entry.pluginId,
    command: entry.command,
    message: entry.message,
    isDeleted: entry.isDeleted
  }))
}
