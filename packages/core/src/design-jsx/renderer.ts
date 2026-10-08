import { createDesignJSXRenderer, type SVGSource } from '@open-pencil/design-jsx'

import { iconify, placeIcon, type IconProvider } from '#core/icons'
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

/** The set inline SVG artwork is reported in, which no icon provider has. */
const INLINE_SVG = 'svg'

/** Inline SVG through the same path pipeline as Iconify icons, scaled from its viewBox. */
function svgIconData({ body, elements, props }: SVGSource, size: number): IconData | null {
  // Children may arrive as parsed SVG elements rather than markup; both use the same shapes.
  let pathInfos = body.trim() ? extractPaths(body) : []
  if (pathInfos.length === 0) pathInfos = extractPathsFromElements(elements, props)
  if (pathInfos.length === 0) return null
  const viewBox = parseViewBox(props.viewBox as string | undefined)
  return {
    prefix: INLINE_SVG,
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

function createRenderer(icons: IconProvider) {
  return createDesignJSXRenderer<IconData>({
    async icon(name, size) {
      const icon = (await icons.icons([name], size)).get(name)
      return icon && icon.paths.length > 0 ? icon : null
    },
    svg: svgIconData,
    createArtwork: (graph, icon, { parentId, size, color, overrides }) =>
      placeIcon(graph, parentId, icon, {
        size,
        color,
        overrides,
        // Inline SVG is artwork, not an icon from a set.
        identity: icon.prefix !== INLINE_SVG
      }),
    layout: computeAllLayouts
  })
}

const renderers = new WeakMap<IconProvider, ReturnType<typeof createRenderer>>()

/**
 * Design JSX rendering with OpenPencil's SVG conversion and layout, drawing `<Icon>` from
 * `icons`, such as the `FigmaAPI`'s provider, so a host's own icons render too.
 */
export function designJSXRenderer(icons: IconProvider = iconify) {
  let renderer = renderers.get(icons)
  if (!renderer) {
    renderer = createRenderer(icons)
    renderers.set(icons, renderer)
  }
  return renderer
}

/** Design JSX rendering with Iconify's icons. */
export const { renderJSX, renderTree } = designJSXRenderer()
