import type { Transform } from '@figma/plugin-typings/plugin-api-standalone'

import type { ColorProfile } from '@open-pencil/scene-graph'

import type { RasterExportFormat } from '#core/io/formats/raster'

/** Figma's `Transform`: a 2×3 affine matrix as two rows. */
export type FigmaTransform = Transform

/** Raster export request; `pageId` names the page holding the nodes (default: the current page). */
export interface ExportImageOptions {
  scale?: number
  format?: RasterExportFormat
  quality?: number
  pageId?: string
  /** Crop to the layers' boxes rather than to everything they draw. */
  useAbsoluteBounds?: boolean
  /** The profile the image is encoded in; the document's own unless given. */
  colorSpace?: ColorProfile
}
