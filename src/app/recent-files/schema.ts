import * as v from 'valibot'

import { ZOOM_MAX, ZOOM_MIN } from '@lawha/core/constants'

export const RECENT_FILES_LIMIT_MIN = 1
export const RECENT_FILES_LIMIT_MAX = 1000

export const recentFilesLimitSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(RECENT_FILES_LIMIT_MIN),
  v.maxValue(RECENT_FILES_LIMIT_MAX)
)

const finiteSchema = v.pipe(v.number(), v.finite())

/** The page and view a document was left at, which it opens on again, as in Figma. */
export const recentDocumentViewSchema = v.object({
  pageId: v.pipe(v.string(), v.nonEmpty()),
  /** The world point at the centre of the canvas. */
  center: v.object({ x: finiteSchema, y: finiteSchema }),
  zoom: v.pipe(finiteSchema, v.minValue(ZOOM_MIN), v.maxValue(ZOOM_MAX))
})
