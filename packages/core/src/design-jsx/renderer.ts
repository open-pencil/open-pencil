import { createDesignJSXRenderer, type SVGSource } from '@open-pencil/design-jsx'

import { fetchIcons } from '#core/icons'
import { createIconFromPaths } from '#core/icons/render'
import { extractPaths, extractPathsFromElements, scalePathInfos } from '#core/icons/svg'
import type { IconData } from '#core/icons/types'
import { computeAllLayouts } from '#core/layout'

function parseViewBox(viewBox: string | undefined): { w: number; h: number } {
  if (!viewBox) return { w: 0, h: 0 }
  const parts = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  return { w: parts[2] ?? 0, h: parts[3] ?? 0 }
}

/** Inline SVG through the same path pipeline as Iconify icons, scaled from its viewBox. */
function svgIconData({ body, elements, props }: SVGSource, size: number): IconData | null {
  // Children may arrive as parsed SVG elements rather than markup; both use the same shapes.
  let pathInfos = body.trim() ? extractPaths(body) : []
  if (pathInfos.length === 0) pathInfos = extractPathsFromElements(elements, props)
  if (pathInfos.length === 0) return null
  const viewBox = parseViewBox(props.viewBox as string | undefined)
  return {
    prefix: 'svg',
    name: (props.name as string | undefined) ?? 'custom',
    width: size,
    height: size,
    paths: scalePathInfos(
      pathInfos,
      viewBox.w > 0 ? size / viewBox.w : 1,
      viewBox.h > 0 ? size / viewBox.h : 1
    )
  }
}

/** Design JSX rendering with OpenPencil's icons, SVG conversion, and layout. */
export const { renderJSX, renderTree } = createDesignJSXRenderer<IconData>({
  async icon(name, size) {
    const icon = (await fetchIcons([name], size)).get(name)
    return icon && icon.paths.length > 0 ? icon : null
  },
  svg: svgIconData,
  createArtwork: (graph, icon, { parentId, size, color, overrides }) =>
    createIconFromPaths(graph, icon, icon.name, size, color, parentId, overrides),
  layout: computeAllLayouts
})
