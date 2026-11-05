import { createDesignJSXRenderer, type SVGSource } from '@open-pencil/design-jsx'

import { defaultIcons, placeIcon, type IconProvider } from '#core/icons'
import { extractPaths, extractPathsFromElements, scalePathInfos } from '#core/icons/svg'
import type { IconData } from '#core/icons/types'
import { layoutAuthoredNodes } from '#core/layout'
import { markdownText } from '#core/text/markdown'
import { prepareGraphFonts } from '#core/text/prepare'
import { computeAccurateBounds } from '#core/vector/curve-math'

function finiteCoordinate(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** viewBox min-x, min-y, width, and height. A missing or non-finite part is 0. */
function parseViewBox(viewBox: string | undefined): { x: number; y: number; w: number; h: number } {
  if (!viewBox) return { x: 0, y: 0, w: 0, h: 0 }
  const parts = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  return {
    x: finiteCoordinate(parts[0]),
    y: finiteCoordinate(parts[1]),
    w: finiteCoordinate(parts[2]),
    h: finiteCoordinate(parts[3])
  }
}

/** The set inline SVG artwork is reported in, which no icon provider has. */
const INLINE_SVG = 'svg'

/** The root `<svg>` transform, which SVG applies outside the viewBox, or null when it has none. */
function rootSVGTransform(props: Readonly<Record<string, unknown>>): string | null {
  const transform = props.transform
  if (typeof transform !== 'string') return null
  const value = transform.trim()
  return value !== '' && value !== 'none' ? value : null
}

/** Root props without `transform`, so extraction keeps that transform out of descendant paths. */
function svgAttributes(
  props: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  if (!Object.hasOwn(props, 'transform')) return props
  const { transform: _transform, ...attributes } = props
  return attributes
}

/** Inline SVG through the same path pipeline as Iconify icons, scaled from its viewBox. */
function svgIconData({ body, elements, props }: SVGSource, size: number): IconData | null {
  // Children may arrive as parsed SVG elements rather than markup; both use the same shapes.
  // The root transform stays off those shapes: it is applied after the viewBox, not before it.
  let pathInfos = body.trim() ? extractPaths(body) : []
  if (pathInfos.length === 0) pathInfos = extractPathsFromElements(elements, svgAttributes(props))
  if (pathInfos.length === 0) return null
  const viewBox = parseViewBox(props.viewBox as string | undefined)
  // A viewBox with a non-positive size does not establish a viewport, so its origin is ignored.
  const hasViewBox = viewBox.w > 0 && viewBox.h > 0
  return {
    prefix: INLINE_SVG,
    name: (props.name as string | undefined) ?? 'custom',
    width: size,
    height: size,
    paths: scalePathInfos(
      pathInfos,
      viewBox.w > 0 ? size / viewBox.w : 1,
      viewBox.h > 0 ? size / viewBox.h : 1,
      hasViewBox ? viewBox.x : 0,
      hasViewBox ? viewBox.y : 0,
      rootSVGTransform(props)
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
    prepareFonts: prepareGraphFonts,
    layout: layoutAuthoredNodes,
    vectorBounds: computeAccurateBounds,
    markdown: markdownText
  })
}

const renderers = new WeakMap<IconProvider, ReturnType<typeof createRenderer>>()

/**
 * Design JSX rendering with OpenPencil's SVG conversion and layout, drawing `<Icon>` from
 * `icons`, such as the `FigmaAPI`'s provider, so a host's own icons render too.
 */
export function designJSXRenderer(icons: IconProvider = defaultIcons) {
  let renderer = renderers.get(icons)
  if (!renderer) {
    renderer = createRenderer(icons)
    renderers.set(icons, renderer)
  }
  return renderer
}

/** Design JSX rendering with Iconify's icons. */
export const { renderJSX, renderTree, renderRoots } = designJSXRenderer()
