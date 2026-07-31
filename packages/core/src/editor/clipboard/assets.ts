import type { Fill } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import { TRANSPARENT } from '#core/constants'
import { resolvePasteTarget } from '#core/editor/clipboard/paste-target'
import type { EditorContext } from '#core/editor/types'
import { computeImageHash } from '#core/figma-api'
import {
  createSVGNodesFromImport,
  prepareSVGImport,
  type SVGImportData
} from '#core/io/formats/svg'
import { computeAllLayouts } from '#core/layout'

const IMAGE_MAX_DIMENSION = 4096
const ASSET_GAP = 20

const RASTER_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif'
])

interface PreparedRasterAsset {
  kind: 'raster'
  bytes: Uint8Array
  name: string
  width: number
  height: number
}

interface PreparedSVGAsset {
  kind: 'svg'
  data: SVGImportData
  name: string
  width: number
  height: number
}

type PreparedAsset = PreparedRasterAsset | PreparedSVGAsset

type PushCreatedNodesUndo = (
  created: string[],
  previousSelection: Set<string>,
  label?: string
) => void

function isSVGFile(file: Pick<File, 'name' | 'type'>): boolean {
  return (
    file.type === 'image/svg+xml' || (file.type === '' && file.name.toLowerCase().endsWith('.svg'))
  )
}

export function createClipboardAssetActions(
  ctx: EditorContext,
  pushCreatedNodesUndo: PushCreatedNodesUndo
) {
  function storeImage(bytes: Uint8Array): string {
    const hash = computeImageHash(bytes)
    ctx.graph.images.set(hash, bytes)
    return hash
  }

  function decodeImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
    const ck = ctx.getCk()
    if (!ck) return null
    const skImg = ck.MakeImageFromEncoded(bytes)
    if (!skImg) return null
    let width = skImg.width()
    let height = skImg.height()
    skImg.delete()
    if (width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION) {
      const ratio = Math.min(IMAGE_MAX_DIMENSION / width, IMAGE_MAX_DIMENSION / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
    }
    return { width, height }
  }

  async function prepareAsset(file: File): Promise<PreparedAsset | null> {
    if (isSVGFile(file)) {
      const data = prepareSVGImport(await file.text())
      return data
        ? {
            kind: 'svg',
            data,
            name: file.name.replace(/\.svg$/i, '') || 'SVG',
            width: data.width,
            height: data.height
          }
        : null
    }
    if (!RASTER_IMAGE_TYPES.has(file.type)) return null
    const bytes = new Uint8Array(await file.arrayBuffer())
    const dimensions = decodeImageDimensions(bytes)
    return dimensions ? { kind: 'raster', bytes, name: file.name, ...dimensions } : null
  }

  function parentLocalPoint(parentId: string, x: number, y: number) {
    const parent = ctx.graph.getNode(parentId)
    if (!parent) return { x, y }
    const inverse = Matrix.invert(getWorldMatrix(parent, ctx.graph))
    return inverse ? Matrix.mapPoint(inverse, { x, y }) : { x, y }
  }

  function createRasterNode(
    asset: PreparedRasterAsset,
    parentId: string,
    x: number,
    y: number
  ): string {
    const hash = storeImage(asset.bytes)
    const fill: Fill = {
      type: 'IMAGE',
      imageHash: hash,
      imageScaleMode: 'FILL',
      color: TRANSPARENT,
      opacity: 1,
      visible: true
    }
    return ctx.graph.createNode('RECTANGLE', parentId, {
      name: asset.name.replace(/\.[^.]+$/, ''),
      x,
      y,
      width: asset.width,
      height: asset.height,
      fills: [fill]
    }).id
  }

  async function placeFiles(files: File[], cx: number, cy: number) {
    const prepared = (await Promise.all(files.map(prepareAsset))).filter(
      (asset): asset is PreparedAsset => asset !== null
    )
    if (prepared.length === 0) return

    const previousSelection = new Set(ctx.state.selectedIds)
    const parentId = resolvePasteTarget(ctx)
    const center = parentLocalPoint(parentId, cx, cy)
    const totalWidth =
      prepared.reduce((total, asset) => total + asset.width, 0) + ASSET_GAP * (prepared.length - 1)
    const maxHeight = Math.max(...prepared.map((asset) => asset.height))
    let x = center.x - totalWidth / 2
    const y = center.y - maxHeight / 2
    const created: string[] = []

    try {
      for (const asset of prepared) {
        const id =
          asset.kind === 'raster'
            ? createRasterNode(asset, parentId, x, y)
            : createSVGNodesFromImport(ctx.graph, parentId, asset.data, {
                name: asset.name,
                x,
                y
              })?.id
        if (id) created.push(id)
        x += asset.width + ASSET_GAP
      }
    } catch (error) {
      for (const id of created.reverse()) ctx.graph.deleteNode(id)
      throw error
    }

    if (created.length === 0) return
    computeAllLayouts(ctx.graph, ctx.state.currentPageId)
    ctx.setSelectedIds(new Set(created))
    pushCreatedNodesUndo(created, previousSelection, 'Place files')
    ctx.requestRender()
  }

  function placeImageFiles(files: File[], cx: number, cy: number) {
    return placeFiles(
      files.filter((file) => RASTER_IMAGE_TYPES.has(file.type)),
      cx,
      cy
    )
  }

  return { storeImage, placeFiles, placeImageFiles }
}
