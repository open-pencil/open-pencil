import { omit } from 'es-toolkit/object'
import * as v from 'valibot'

import type { NodeChange, PluginData, PluginRelaunchData } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import {
  clampExportScale,
  isExportFormatId,
  type ExportFormatId,
  type ExportSetting,
  type PluginDataEntry,
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

export const OPEN_PENCIL_PLUGIN_ID = 'open-pencil'
export const TEXT_DIRECTION_PLUGIN_KEY = 'textDirection'
export const LAYOUT_DIRECTION_PLUGIN_KEY = 'layoutDirection'
export const NODE_TYPE_PLUGIN_KEY = 'nodeType'
export const BOUND_VARIABLES_PLUGIN_KEY = 'boundVariables'
export const EXPORT_SETTINGS_PLUGIN_KEY = 'exportSettings'
export const TEXT_PATH_BOX_PLUGIN_KEY = 'textPathBox'
export const LIBRARY_SOURCE_PLUGIN_KEY = 'librarySource'
export const ENABLED_LIBRARIES_PLUGIN_KEY = 'enabledLibraries'

const TextPathBoxJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({ x: v.number(), y: v.number(), width: v.number(), height: v.number() }),
  v.check(
    ({ x, y, width, height }) => Number.isFinite(x + y + width + height) && width > 0 && height > 0
  )
)

/** String-valued entries of a JSON object; other entries are dropped, not rejected. */
const BoundVariablesJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.check((value) => !Array.isArray(value)),
  v.record(v.string(), v.unknown()),
  v.transform((value) =>
    Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    )
  )
)

/** Every entry must be valid, or the plugin value is ignored in favour of native settings. */
const ExportSettingsJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.array(
    v.pipe(
      v.object({
        scale: v.pipe(v.number(), v.finite()),
        format: v.custom<ExportFormatId>(isExportFormatId)
      }),
      // Clamp at the file-format boundary: imported plugin data may carry an
      // out-of-range scale the UI would never produce.
      v.transform(({ scale, format }): ExportSetting => ({
        scale: clampExportScale(scale),
        format
      }))
    )
  )
)

const LibrarySourceJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    identity: v.object({ libraryId: v.string(), assetKey: v.string(), revisionId: v.string() }),
    sourceNodeId: v.optional(v.unknown()),
    readOnly: v.optional(v.unknown())
  }),
  v.transform(({ identity, sourceNodeId, readOnly }): NonNullable<SceneNode['librarySource']> => ({
    identity,
    sourceNodeId: typeof sourceNodeId === 'string' ? sourceNodeId : null,
    readOnly: readOnly === true
  }))
)

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

export function removePluginData(node: { pluginData: PluginDataEntry[] }, key: string): void {
  node.pluginData = node.pluginData.filter(
    (entry) => !(entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === key)
  )
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
  const parsed = v.safeParse(
    TextPathBoxJSON,
    getOpenPencilPluginValue(nc, TEXT_PATH_BOX_PLUGIN_KEY)
  )
  return parsed.success ? parsed.output : null
}

function hasOpenPencilExportSettingsPluginData(pluginData: PluginDataEntry[]): boolean {
  return pluginData.some(
    (entry) => entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === EXPORT_SETTINGS_PLUGIN_KEY
  )
}

export function extractBoundVariables(nc: NodeChange): Record<string, string> {
  const stored = v.safeParse(
    BoundVariablesJSON,
    getOpenPencilPluginValue(nc, BOUND_VARIABLES_PLUGIN_KEY)
  )
  let bindings: Record<string, string> = stored.success ? stored.output : {}
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
  const pluginSettings = v.safeParse(
    ExportSettingsJSON,
    getOpenPencilPluginValue(nc, EXPORT_SETTINGS_PLUGIN_KEY)
  )
  if (pluginSettings.success) return pluginSettings.output

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
  const parsed = v.safeParse(
    LibrarySourceJSON,
    getOpenPencilPluginValue(nc, LIBRARY_SOURCE_PLUGIN_KEY)
  )
  return parsed.success ? parsed.output : null
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
