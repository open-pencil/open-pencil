import type {
  ExportSettings,
  ExportSettingsConstraints
} from '@figma/plugin-typings/plugin-api-standalone'
import * as v from 'valibot'

import type { ExportSetting } from '@open-pencil/scene-graph'
import {
  compactExportSetting,
  EXPORT_OPTION_DEFAULTS,
  type ExportFormatId
} from '@open-pencil/scene-graph/export-format'
import { clampExportScale } from '@open-pencil/scene-graph/export-scale'

import { finiteNumberSchema } from '#core/figma-api/schema'
import { parseFigma } from '#core/figma-api/validation'

// Figma's export settings, as its plugin API checks and reads them (Figma desktop 126). An
// export's options are checked loosely, so a key Figma does not know is dropped; its size is
// checked strictly.

const COLOR_PROFILES = ['DOCUMENT', 'SRGB', 'DISPLAY_P3_V4'] as const

/** How big an export is: a multiplier, or a width or height in pixels. */
const constraintSchema = v.union([
  v.strictObject({ type: v.literal('SCALE'), value: finiteNumberSchema }),
  v.strictObject({ type: v.picklist(['WIDTH', 'HEIGHT']), value: finiteNumberSchema })
])

const optionEntries = {
  contentsOnly: v.optional(v.boolean()),
  useAbsoluteBounds: v.optional(v.boolean()),
  suffix: v.optional(v.string()),
  colorProfile: v.optional(v.picklist(COLOR_PROFILES))
}

const imageSchema = v.looseObject({
  format: v.picklist(['PNG', 'JPG']),
  ...optionEntries,
  constraint: v.optional(constraintSchema)
})

const pdfSchema = v.looseObject({ format: v.literal('PDF'), ...optionEntries })

const svgSchema = v.looseObject({
  format: v.picklist(['SVG', 'SVG_STRING']),
  ...optionEntries,
  svgOutlineText: v.optional(v.boolean()),
  svgIdAttribute: v.optional(v.boolean()),
  svgSimplifyStroke: v.optional(v.boolean())
})

/** An export a layer keeps: the formats Figma keeps, which includes the SVG string it refuses. */
const exportSettingSchema = v.variant('format', [imageSchema, pdfSchema, svgSchema])

/** What `exportAsync` takes: an export a layer keeps, Figma's REST JSON, or a video. */
const exportRequestSchema = v.variant('format', [
  imageSchema,
  pdfSchema,
  svgSchema,
  v.strictObject({ format: v.literal('JSON_REST_V1') }),
  v.looseObject({ format: v.picklist(['MP4', 'GIF', 'WEBM']) })
])

export type ExportRequest = v.InferOutput<typeof exportRequestSchema>

/** What `exportAsync` was asked for, a PNG at its size when nothing was, or Figma's refusal. */
export function parseExportRequest(value: unknown): ExportRequest {
  if (value === undefined) return { format: 'PNG' }
  return parseFigma(exportRequestSchema, value, 'exportAsync', 'settings')
}

type KeptExport = v.InferOutput<typeof exportSettingSchema>

const FIGMA_FORMATS = {
  png: 'PNG',
  jpg: 'JPG',
  svg: 'SVG',
  pdf: 'PDF'
} as const satisfies Partial<Record<ExportFormatId, ExportSettings['format']>>

type FigmaFormat = (typeof FIGMA_FORMATS)[keyof typeof FIGMA_FORMATS]

const MODEL_FORMATS: Record<FigmaFormat, ExportFormatId> = {
  PNG: 'png',
  JPG: 'jpg',
  SVG: 'svg',
  PDF: 'pdf'
}

function isFigmaFormat(format: ExportFormatId): format is keyof typeof FIGMA_FORMATS {
  return format in FIGMA_FORMATS
}

/**
 * A layer's exports as Figma reads them, each option filled in with its default. Exports in
 * formats Figma has no setting for, such as WebP or PowerPoint, are left out.
 */
export function figmaExportSettings(settings: readonly ExportSetting[]): readonly ExportSettings[] {
  return Object.freeze(
    settings.flatMap((setting) =>
      isFigmaFormat(setting.format)
        ? [Object.freeze(figmaExportSetting(setting, FIGMA_FORMATS[setting.format]))]
        : []
    )
  )
}

function figmaExportSetting(setting: ExportSetting, format: FigmaFormat): ExportSettings {
  const defaults = EXPORT_OPTION_DEFAULTS
  const options = {
    suffix: setting.suffix ?? defaults.suffix,
    contentsOnly: setting.contentsOnly ?? defaults.contentsOnly,
    colorProfile: setting.colorProfile ?? defaults.colorProfile
  }
  // Figma reads `useAbsoluteBounds` only on text that has it.
  const common = setting.useAbsoluteBounds ? { ...options, useAbsoluteBounds: true } : options
  if (format === 'PDF') return { format, ...common }
  if (format === 'SVG') {
    return {
      format,
      ...common,
      svgOutlineText: setting.svgOutlineText ?? defaults.svgOutlineText,
      svgIdAttribute: setting.svgIdAttribute ?? defaults.svgIdAttribute,
      svgSimplifyStroke: setting.svgSimplifyStroke ?? defaults.svgSimplifyStroke
    }
  }
  const constraint: ExportSettingsConstraints = Object.freeze(
    setting.size ? { ...setting.size } : { type: 'SCALE', value: setting.scale }
  )
  return { format, ...common, constraint }
}

/** `value` as the exports a layer keeps, or Figma's refusal of it. */
export function parseExportSettings(value: unknown, isText: boolean): ExportSetting[] {
  const parsed = parseFigma(
    v.array(exportSettingSchema),
    value,
    'set_exportSettings',
    'exportSettings'
  )
  return parsed.map((setting) => {
    if (setting.format === 'SVG_STRING') {
      throw new Error('in set_exportSettings: Invalid value "SVG_STRING" for enum "ImageType"')
    }
    if (setting.useAbsoluteBounds && !isText) {
      throw new Error(
        'in set_exportSettings: Cannot set useAbsoluteBounds for ExportSetting on node that is not type text.'
      )
    }
    return exportSetting(setting, MODEL_FORMATS[setting.format])
  })
}

/** A kept export as the model keeps it. */
function exportSetting(setting: KeptExport, format: ExportFormatId): ExportSetting {
  const constraint =
    setting.format === 'PNG' || setting.format === 'JPG' ? setting.constraint : undefined
  const svg = setting.format === 'SVG' || setting.format === 'SVG_STRING' ? setting : undefined
  return compactExportSetting({
    scale: constraint?.type === 'SCALE' ? clampExportScale(constraint.value) : 1,
    format,
    size:
      constraint && constraint.type !== 'SCALE'
        ? { type: constraint.type, value: constraint.value }
        : undefined,
    suffix: setting.suffix,
    contentsOnly: setting.contentsOnly,
    useAbsoluteBounds: setting.useAbsoluteBounds,
    colorProfile: setting.colorProfile,
    svgOutlineText: svg?.svgOutlineText,
    svgIdAttribute: svg?.svgIdAttribute,
    svgSimplifyStroke: svg?.svgSimplifyStroke
  })
}
