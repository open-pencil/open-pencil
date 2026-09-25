/**
 * Formats a node's export settings may persist. Each id must name a Core IO
 * export adapter that supports node export; labels and options come from that
 * adapter, so this list only decides what the Export panel offers.
 */
export const EXPORT_FORMAT_IDS = ['png', 'jpg', 'webp', 'svg', 'pdf', 'pptx'] as const

export type ExportFormatId = (typeof EXPORT_FORMAT_IDS)[number]

export function isExportFormatId(value: unknown): value is ExportFormatId {
  return EXPORT_FORMAT_IDS.some((id) => id === value)
}
