import type { NodeChange, PluginData, PluginRelaunchData } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import {
  clampExportScale,
  type ExportFormatId,
  type ExportSetting,
  type PluginDataEntry,
  type PluginRelaunchDataEntry
} from '@open-pencil/scene-graph'

export const OPEN_PENCIL_PLUGIN_ID = 'open-pencil'
export const TEXT_DIRECTION_PLUGIN_KEY = 'textDirection'
export const LAYOUT_DIRECTION_PLUGIN_KEY = 'layoutDirection'
export const NODE_TYPE_PLUGIN_KEY = 'nodeType'
export const BOUND_VARIABLES_PLUGIN_KEY = 'boundVariables'
export const EXPORT_SETTINGS_PLUGIN_KEY = 'exportSettings'

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

export function applyExportSettingsPluginData(node: {
  exportSettings: ExportSetting[]
  pluginData: PluginDataEntry[]
  source?: { fig?: { rawNodeFields?: Record<string, unknown> } }
}): void {
  if (node.exportSettings.length === 0) return
  if (
    !hasOpenPencilExportSettingsPluginData(node.pluginData) &&
    Array.isArray(node.source?.fig?.rawNodeFields?.exportSettings)
  ) {
    return
  }
  upsertPluginData(node, EXPORT_SETTINGS_PLUGIN_KEY, JSON.stringify(node.exportSettings))
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
  nc.fillPaints?.forEach((paint, i) => {
    if (paint.colorVariableBinding) {
      bindings[`fills/${i}/color`] = guidToString(paint.colorVariableBinding.variableID)
    }
  })
  nc.strokePaints?.forEach((paint, i) => {
    if (paint.colorVariableBinding) {
      bindings[`strokes/${i}/color`] = guidToString(paint.colorVariableBinding.variableID)
    }
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
