import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { TRANSPARENT } from '@open-pencil/scene-graph/constants'
import { dimension, splitCSSValue } from '@open-pencil/scene-graph/css'
import type { Matrix, Rect, Size, Vector } from '@open-pencil/scene-graph/primitives'

import type { BackgroundPicture } from './image-fills'

/** A length or percentage of `total`, as one value of `background-size` or `-position` gives. */
function lengthOf(value: string | undefined, total: number): number | null {
  const parsed = value ? dimension(value) : null
  if (!parsed) return null
  if (parsed.unit === '%') return (total * parsed.number) / 100
  return parsed.unit === 'px' || parsed.unit === '' ? parsed.number : null
}

/** The size `background-size` draws a picture of `natural` size at in `box`. */
function pictureSize(size: string, box: Size, natural: Size): Size {
  const sizing = size.trim().toLowerCase()
  if (sizing === 'cover' || sizing === 'contain') {
    const scale = (sizing === 'cover' ? Math.max : Math.min)(
      box.width / natural.width,
      box.height / natural.height
    )
    return { width: natural.width * scale, height: natural.height * scale }
  }
  const [across, down = 'auto'] = splitCSSValue(sizing)
  const width = lengthOf(across, box.width)
  const height = lengthOf(down, box.height)
  // `auto` keeps the picture's proportions beside the other value, or its own size beside `auto`.
  if (width === null && height === null) return natural
  if (width === null && height !== null) {
    return { width: (height * natural.width) / natural.height, height }
  }
  if (width !== null && height === null) {
    return { width, height: (width * natural.height) / natural.width }
  }
  return { width: width ?? natural.width, height: height ?? natural.height }
}

const POSITION_KEYWORDS: Partial<Record<string, string>> = {
  left: '0%',
  top: '0%',
  center: '50%',
  right: '100%',
  bottom: '100%'
}

/** Where `background-position` puts a picture of `size` in `box`: a percentage of the room left. */
function pictureOffset(position: string, box: Size, size: Size): Vector {
  const [across = '50%', down = '50%'] = splitCSSValue(position.trim().toLowerCase()).map(
    (value) => POSITION_KEYWORDS[value] ?? value
  )
  const along = (value: string, room: number, total: number) => {
    const parsed = dimension(value)
    if (parsed?.unit === '%') return (room * parsed.number) / 100
    return lengthOf(value, total) ?? room / 2
  }
  return {
    x: along(across, box.width - size.width, box.width),
    y: along(down, box.height - size.height, box.height)
  }
}

/** Maps a layer's area onto the part of a picture at `picture` in its parent that the area shows. */
function cropTransform(area: Rect, picture: Rect): Matrix {
  return {
    m00: area.width / picture.width,
    m01: 0,
    m02: (area.x - picture.x) / picture.width,
    m10: 0,
    m11: area.height / picture.height,
    m12: (area.y - picture.y) / picture.height
  }
}

function cropFill(imageHash: string, imageTransform: Matrix) {
  return {
    type: 'IMAGE' as const,
    imageHash,
    imageScaleMode: 'CROP' as const,
    imageTransform,
    color: TRANSPARENT,
    opacity: 1,
    visible: true
  }
}

/**
 * Places background pictures where their `background-size` and `background-position` put them,
 * once their layers have their final size. A picture that covers its layer is a fill cropped to
 * it. One that covers part of it, such as an icon or an illustration at one side, is a layer of
 * its own behind the layer's children, as large as the part the layer shows: a fill cannot leave
 * the rest of the layer empty.
 */
export function placeBackgroundPictures(graph: SceneGraph, pictures: readonly BackgroundPicture[]) {
  const placed = new Map<string, number>()
  for (const picture of pictures) {
    const node = graph.getNode(picture.nodeId)
    if (!node || node.width <= 0 || node.height <= 0) continue
    const size = pictureSize(picture.size, node, picture)
    if (size.width <= 0 || size.height <= 0) continue
    const rect = { ...pictureOffset(picture.position, node, size), ...size }
    const covers =
      rect.x <= 0 &&
      rect.y <= 0 &&
      rect.x + rect.width >= node.width &&
      rect.y + rect.height >= node.height
    if (covers) {
      const area = { x: 0, y: 0, width: node.width, height: node.height }
      graph.updateNode(node.id, {
        fills: [...node.fills, cropFill(picture.imageHash, cropTransform(area, rect))]
      })
      continue
    }
    const left = Math.max(0, rect.x)
    const top = Math.max(0, rect.y)
    const right = Math.min(node.width, rect.x + rect.width)
    const bottom = Math.min(node.height, rect.y + rect.height)
    if (right <= left || bottom <= top) continue
    const area = { x: left, y: top, width: right - left, height: bottom - top }
    const index = placed.get(node.id) ?? 0
    placeLayer(graph, node, area, cropFill(picture.imageHash, cropTransform(area, rect)), index)
    placed.set(node.id, index + 1)
  }
}

function placeLayer(
  graph: SceneGraph,
  parent: SceneNode,
  area: Rect,
  fill: ReturnType<typeof cropFill>,
  index: number
): void {
  const layer = graph.createNode('RECTANGLE', parent.id, {
    name: 'background image',
    ...area,
    fills: [fill],
    layoutPositioning: parent.layoutMode === 'NONE' ? 'AUTO' : 'ABSOLUTE'
  })
  graph.insertChildAt(layer.id, parent.id, index)
}
