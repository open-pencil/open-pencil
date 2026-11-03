import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  isValidExportScale,
  MAX_EXPORT_SCALE,
  MIN_EXPORT_SCALE
} from '@open-pencil/scene-graph/export-scale'

import { flushPendingLayout } from '#core/figma-api/pending-layout'
import type { ExportImageOptions } from '#core/figma-api/types'
import { findPageId } from '#core/io/subgraph'

import type { ExportRequest } from './settings'

/** What a host lends an export: its renderer, for raster formats. */
export interface ExportHost {
  exportImage?: (nodeIds: string[], options: ExportImageOptions) => Promise<Uint8Array | null>
}

/** A layer or page as `exportAsync` writes it: bytes, an SVG string for `SVG_STRING`. */
export async function exportLayer(
  host: ExportHost,
  graph: SceneGraph,
  node: SceneNode,
  request: ExportRequest
): Promise<Uint8Array | string> {
  // A script's edits that nothing read yet are laid out first, as Figma lays them out.
  flushPendingLayout(graph)
  // A page exports what is on it.
  const ids =
    node.type === 'CANVAS' ? graph.getChildren(node.id).map((child) => child.id) : [node.id]
  const pageId = node.type === 'CANVAS' ? node.id : findPageId(graph, node.id)
  if (!pageId) throw new Error(`in exportAsync: The node with id "${node.id}" is not on a page`)
  switch (request.format) {
    case 'PNG':
    case 'JPG':
      return exportImage(host, graph, pageId, ids, request)
    case 'SVG':
    case 'SVG_STRING': {
      const { renderNodesToLaidOutSVG } = await import('#core/io/formats/svg/text/layout')
      const svg = await renderNodesToLaidOutSVG(graph, pageId, ids, {
        xmlDeclaration: false,
        layerIds: request.svgIdAttribute,
        useAbsoluteBounds: request.useAbsoluteBounds
      })
      if (svg === null) throw nothingToExport()
      return request.format === 'SVG' ? new TextEncoder().encode(svg) : svg
    }
    case 'PDF': {
      const { exportPDFDocument } = await import('#core/io/formats/pdf/document')
      const pdf = await exportPDFDocument(graph, [{ pageId, nodeIds: ids }], { embedFonts: false })
      if (!pdf || pdf.data.length === 0) throw nothingToExport()
      return pdf.data
    }
    case 'JSON_REST_V1':
      throw new Error('in exportAsync: OpenPencil does not export JSON_REST_V1')
    default:
      // Figma's words for a layer with nothing animated, which no OpenPencil layer has.
      throw new Error('Cannot export node as video')
  }
}

async function exportImage(
  host: ExportHost,
  graph: SceneGraph,
  pageId: string,
  ids: string[],
  request: Extract<ExportRequest, { format: 'PNG' | 'JPG' }>
): Promise<Uint8Array> {
  if (!host.exportImage) {
    throw new Error('in exportAsync: This host has no renderer to export PNG or JPG images with')
  }
  const { exportBounds, oversizedRaster, rasterSize } = await import('#core/io/formats/raster')
  const bounds = exportBounds(graph, ids, request.useAbsoluteBounds)
  if (!bounds) throw nothingToExport()
  const constraint = request.constraint
  let scale = 1
  // Figma reads a scale of 0 as none.
  if (constraint?.type === 'SCALE' && constraint.value !== 0) scale = constraint.value
  if (constraint?.type === 'WIDTH') scale = constraint.value / (bounds.maxX - bounds.minX)
  if (constraint?.type === 'HEIGHT') scale = constraint.value / (bounds.maxY - bounds.minY)
  if (!isValidExportScale(scale)) {
    throw new Error(
      `in exportAsync: An image must be exported at ${MIN_EXPORT_SCALE} to ${MAX_EXPORT_SCALE} times the layer's size`
    )
  }
  const { width, height } = rasterSize(bounds, scale)
  const oversized = oversizedRaster(width, height)
  if (oversized) throw new Error(`in exportAsync: ${oversized}`)
  const data = await host.exportImage(ids, {
    scale,
    format: request.format,
    pageId,
    useAbsoluteBounds: request.useAbsoluteBounds
  })
  if (!data || data.length === 0) throw nothingToExport()
  return data
}

/** Figma exports a hidden or empty layer as a blank pixel; OpenPencil has nothing to write. */
function nothingToExport(): Error {
  return new Error('in exportAsync: The layer draws nothing to export')
}
