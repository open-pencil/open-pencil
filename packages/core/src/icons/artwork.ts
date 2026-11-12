import { iconToSVG, type IconifyIcon } from '@iconify/utils'

import type { VectorNetwork } from '@open-pencil/scene-graph'
import { BLACK } from '@open-pencil/scene-graph/constants'
import type { Rect, Size } from '@open-pencil/scene-graph/primitives'

import { extractSVGContent, isSVGPathShown, type SVGContent } from '#core/icons/svg'
import { vectorizeSVGContent } from '#core/vector/vectorize/svg/to-vectors'
import {
  resolveSVGViewportMapping,
  type SVGViewportAttributes
} from '#core/vector/vectorize/svg/transform'

import type { IconData, IconPath } from './types'

/**
 * The paths SVG content draws in a `box`, its viewBox `space` mapped there as the outermost
 * `<svg>` says: the paths and paints SVG import makes, without its layers and text.
 */
export function svgIconPaths(
  content: SVGContent,
  space: Rect,
  box: Size,
  attributes: SVGViewportAttributes = {}
): IconPath[] {
  const viewport = resolveSVGViewportMapping(space, box, attributes)
  return vectorizeSVGContent({ ...content, texts: [] }, viewport)
    .paths.filter(isSVGPathShown)
    .map(({ vectorNetwork, fills, strokes, tint }) => ({ vectorNetwork, fills, strokes, tint }))
}

/** A path filled in the icon's color, as a glyph from a symbol font draws. */
export function tintedIconPath(vectorNetwork: VectorNetwork, opacity = 1): IconPath {
  return {
    vectorNetwork,
    fills: [{ type: 'SOLID', color: BLACK, opacity, visible: true }],
    strokes: [],
    tint: ['fill']
  }
}

/**
 * An Iconify icon at `size`. Iconify's own rendering applies its box, defaulting to 16, and any
 * turn or flip, before the shapes are placed in the icon box as SVG import places them.
 */
export function buildIconData(
  icon: IconifyIcon,
  prefix: string,
  iconName: string,
  size: number
): IconData {
  const rendered = iconToSVG(icon)
  const [x, y, width, height] = rendered.viewBox
  return {
    prefix,
    name: iconName,
    width: size,
    height: size,
    paths: svgIconPaths(
      extractSVGContent(rendered.body),
      { x, y, width, height },
      { width: size, height: size }
    )
  }
}
