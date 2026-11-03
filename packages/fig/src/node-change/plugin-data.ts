import { omit } from 'es-toolkit/object'
import * as v from 'valibot'

import type { NodeChange, PluginData, PluginRelaunchData } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import type {
  ExportSetting,
  PluginDataEntry,
  PluginRelaunchDataEntry,
  SceneNode
} from '@open-pencil/scene-graph'
import { compactExportSetting, type ExportFormatId } from '@open-pencil/scene-graph/export-format'
import { clampExportScale } from '@open-pencil/scene-graph/export-scale'
import {
  hasPluginData,
  OPEN_PENCIL_PLUGIN_DATA,
  OPEN_PENCIL_PLUGIN_ID,
  withPluginData,
  type PluginDataField
} from '@open-pencil/scene-graph/plugin-data'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import { effectBindingTarget, paintBindingTarget } from '@open-pencil/scene-graph/variables'

import { readEffectiveFigmaRawField } from '../source-metadata'
import {
  resolveVariableConsumptionEntry,
  variableConsumptionEntries,
  VARIABLE_BINDING_FIELDS_INVERSE,
  referencesVariable
} from './variable/bindings'
import { effectBindingsFromKiwi } from './variable/effects'

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
 * reflow anchored correctly. A node still saved in its Figma box gets none: the
 * reader rebuilds the box from that, and this one, in the expanded node's
 * coordinates, would shift the path off the lettering a second time.
 */
export function applyTextPathBoxPluginData(
  node: {
    textPathBox: Rect | null
    pluginData: PluginDataEntry[]
  },
  savedInFigmaBox: boolean
): void {
  if (!node.textPathBox) return
  node.pluginData = withPluginData(
    node.pluginData,
    textPathBox,
    savedInFigmaBox ? undefined : node.textPathBox
  )
}

export function extractTextPathBox(nc: NodeChange): Rect | null {
  return readNodeChangePluginData(nc, textPathBox) ?? null
}

export function extractBoundVariables(nc: NodeChange): Record<string, string> {
  let bindings = readNodeChangePluginData(nc, boundVariables) ?? {}
  // Each paint and effect carries its own aliases. An instance's copy pairs its component's plugin
  // data with paints or effects an override set, so the plugin data can name a binding they dropped.
  const decidedByPaints = (field: string) => {
    if (effectBindingTarget(field)) return nc.effects !== undefined
    const list = paintBindingTarget(field)?.list
    return list === 'fills'
      ? nc.fillPaints !== undefined
      : list === 'strokes' && nc.strokePaints !== undefined
  }
  bindings = Object.fromEntries(
    Object.entries(bindings).filter(([field]) => !decidedByPaints(field))
  )
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
  if (nc.effects) Object.assign(bindings, effectBindingsFromKiwi(nc.effects))
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

export function extractExportSettings(nc: NodeChange): ExportSetting[] {
  const pluginSettings = readNodeChangePluginData(nc, exportSettings)
  if (pluginSettings) return pluginSettings
  return (nc.exportSettings ?? []).flatMap((entry): ExportSetting[] => {
    const native = v.safeParse(nativeExportSettingSchema, entry)
    if (!native.success) return []
    const format = mapNativeImageType(native.output.imageType)
    return format ? [exportSettingFromNative(native.output, format)] : []
  })
}

/** An enum Kiwi decodes by name, or by its index in `names` when it is a number. */
function nativeEnum<const T extends string>(names: readonly T[], value: unknown): T | undefined {
  const name = typeof value === 'number' ? names[value] : value
  return names.find((candidate) => candidate === name)
}

const CONSTRAINT_TYPES = ['CONTENT_SCALE', 'CONTENT_WIDTH', 'CONTENT_HEIGHT'] as const
const COLOR_PROFILES = ['DOCUMENT', 'SRGB', 'DISPLAY_P3_V4'] as const
const SVG_ID_MODES = ['IF_NEEDED', 'ALWAYS'] as const

const nativeExportSettingSchema = v.looseObject({
  imageType: v.unknown(),
  suffix: v.optional(v.string()),
  constraint: v.optional(
    v.looseObject({ type: v.unknown(), value: v.optional(v.pipe(v.number(), v.finite())) })
  ),
  contentsOnly: v.optional(v.boolean()),
  useAbsoluteBounds: v.optional(v.boolean()),
  colorProfile: v.optional(v.unknown()),
  svgOutlineText: v.optional(v.boolean()),
  svgIDMode: v.optional(v.unknown()),
  svgForceStrokeMasks: v.optional(v.boolean())
})

/** Figma's export options as the model keeps them; an option Figma left out reads as its default. */
function exportSettingFromNative(
  native: v.InferOutput<typeof nativeExportSettingSchema>,
  format: ExportFormatId
): ExportSetting {
  const constraint = nativeEnum(CONSTRAINT_TYPES, native.constraint?.type) ?? 'CONTENT_SCALE'
  const value = native.constraint?.value
  const svgIDMode = nativeEnum(SVG_ID_MODES, native.svgIDMode)
  const sized = constraint !== 'CONTENT_SCALE' && value !== undefined
  return compactExportSetting({
    // Clamp native CONTENT_SCALE too: malformed .fig data can carry huge multipliers.
    scale: constraint === 'CONTENT_SCALE' && value !== undefined ? clampExportScale(value) : 1,
    format,
    size: sized ? { type: constraint === 'CONTENT_WIDTH' ? 'WIDTH' : 'HEIGHT', value } : undefined,
    suffix: native.suffix,
    contentsOnly: native.contentsOnly,
    useAbsoluteBounds: native.useAbsoluteBounds,
    colorProfile: nativeEnum(COLOR_PROFILES, native.colorProfile),
    svgOutlineText: native.svgOutlineText,
    svgIdAttribute: svgIDMode === undefined ? undefined : svgIDMode === 'ALWAYS',
    svgSimplifyStroke:
      native.svgForceStrokeMasks === undefined ? undefined : !native.svgForceStrokeMasks
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
