import * as v from 'valibot'

import { finiteNumberSchema } from '../primitives/schema'
import type { ColorProfile, ExportColorProfile } from '../types'

export const colorSchema = v.object({
  r: finiteNumberSchema,
  g: finiteNumberSchema,
  b: finiteNumberSchema,
  a: finiteNumberSchema
})

/** A document's color profile, as files, libraries, and collaboration record it. */
export const colorProfileSchema = v.picklist(['srgb', 'display-p3'] satisfies ColorProfile[])

/** The profiles an export can ask for, as Figma names them. */
export const EXPORT_COLOR_PROFILE_NAMES = [
  'DOCUMENT',
  'SRGB',
  'DISPLAY_P3_V4'
] as const satisfies readonly ExportColorProfile[]

export const exportColorProfileSchema = v.picklist(EXPORT_COLOR_PROFILE_NAMES)
