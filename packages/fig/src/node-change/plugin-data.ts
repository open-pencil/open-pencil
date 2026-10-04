import { omit } from 'es-toolkit/object'

import type { NodeChange, PluginData, PluginRelaunchData } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import {
  clampExportScale,
  hasPluginData,
  OPEN_PENCIL_PLUGIN_DATA,
  OPEN_PENCIL_PLUGIN_ID,
  withPluginData,
  type ExportFormatId,
  type ExportSetting,
  type PluginDataEntry,
  type PluginDataField,
  type PluginRelaunchDataEntry,
  type SceneNode
} from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { readEffectiveFigmaRawField } from '../source-metadata'
import {
  resolveVariableConsumptionEntry,
  variableConsumptionEntries,
  VARIABLE_BINDING_FIELDS_INVERSE,
  referencesVariable
} from './variable/bindings'

const { boundVariables, exportSettings, librarySource, textPathBox } = OPEN_PENCIL_PLUGIN_DATA

const NATIVE_EXPORT_FORMATS: Record<string, ExportFormatId> = {
  PNG: 'png',
  JPEG: 'jpg',
  SVG: 'svg',
  PDF: 'pdf'
}

/** An OpenPencil plugin-data value on a record read from a `.fig` file. */
export function readNodeChangePluginData<T>(
  nc: Pick<NodeChange, 'pluginData'>,
  field: PluginDataField<T>
): T | undefined {
  return field.decode(
    nc.pluginData?.find(
      (entry) => entry.pluginID === OPEN_PENCIL_PLUGIN_ID && entry.key === field.key
    )?.value
  )
}

export function applyExportSettingsPluginData(
  node: Pick<SceneNode, 'exportSettings' | 'pluginData' | 'source'>
): void {
  if (node.exportSettings.length === 0) return
  if (
    !hasPluginData(node.pluginData, exportSettings) &&
    Array.isArray(readEffectiveFigmaRawField(node, 'exportSettings'))
  ) {
    return
  }
  node.pluginData = withPluginData(node.pluginData, exportSettings, node.exportSettings)
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
  node.pluginData = withPluginData(node.pluginData, textPathBox, node.textPathBox)
}

export function extractTextPathBox(nc: NodeChange): Rect | null {
  return readNodeChangePluginData(nc, textPathBox) ?? null
}

export function extractBoundVariables(nc: NodeChange): Record<string, string> {
  let bindings = readNodeChangePluginData(nc, boundVariables) ?? {}
  for (const entry of variableConsumptionEntries(nc)) {
    const binding = resolveVariableConsumptionEntry(entry)
    if (binding) bindings[binding.field] = binding.variableId
    else if (entry.variableField && !referencesVariable(entry.variableData?.dataType)) {
      const field = VARIABLE_BINDING_FIELDS_INVERSE[entry.variableField]
      if (field) bindings = omit(bindings, [field])
    }
  }
  nc.fillPaints?.forEach((paint, i) => {
    const variableGuid = paint.colorVar?.value?.alias?.guid
    if (variableGuid) bindings[`fills/${i}/color`] = guidToString(variableGuid)
  })
  nc.strokePaints?.forEach((paint, i) => {
    const variableGuid = paint.colorVar?.value?.alias?.guid
    if (variableGuid) bindings[`strokes/${i}/color`] = guidToString(variableGuid)
  })
  return bindings
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
  const pluginSettings = readNodeChangePluginData(nc, exportSettings)
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
  return readNodeChangePluginData(nc, librarySource) ?? null
}

export function applyLibrarySourcePluginData(node: SceneNode): void {
  node.pluginData = withPluginData(node.pluginData, librarySource, node.librarySource ?? undefined)
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
