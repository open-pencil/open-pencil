import { omitBy } from 'es-toolkit/object'

import type { ExportSetting } from './types'

/**
 * Formats a node's export settings may persist. Each id must name a Core IO
 * export adapter that supports node export; labels and options come from that
 * adapter, so this list only decides what the Export panel offers.
 */
export const EXPORT_FORMAT_IDS = ['png', 'jpg', 'webp', 'svg', 'pdf', 'pptx', 'drawio'] as const

export type ExportFormatId = (typeof EXPORT_FORMAT_IDS)[number]

export function isExportFormatId(value: unknown): value is ExportFormatId {
  return EXPORT_FORMAT_IDS.some((id) => id === value)
}

/** What each of Figma's export options reads as when an export leaves it out. */
export const EXPORT_OPTION_DEFAULTS = {
  suffix: '',
  contentsOnly: true,
  useAbsoluteBounds: false,
  colorProfile: 'DOCUMENT',
  svgOutlineText: true,
  svgIdAttribute: false,
  svgSimplifyStroke: true
} as const satisfies Required<Omit<ExportSetting, 'scale' | 'format' | 'size'>>

/** An export as the model keeps it: options that are unset or at Figma's default left out. */
export function compactExportSetting({
  scale,
  format,
  size,
  ...options
}: ExportSetting): ExportSetting {
  const changed = omitBy(
    options,
    (value, key) => value === undefined || value === EXPORT_OPTION_DEFAULTS[key]
  )
  return size ? { scale, format, size, ...changed } : { scale, format, ...changed }
}
