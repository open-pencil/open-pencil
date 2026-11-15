import { createDesignJSXRenderer, type SVGSource } from '@open-pencil/design-jsx'
import type { Size } from '@open-pencil/scene-graph/primitives'

import { defaultIcons, placeIcon, type IconProvider } from '#core/icons'
import { svgIconPaths } from '#core/icons/artwork'
import { extractSVGContent, extractSVGContentFromElements } from '#core/icons/svg'
import type { IconData } from '#core/icons/types'
import { parseSVGViewBoxValue } from '#core/io/formats/svg/metadata'
import { layoutAuthoredNodes } from '#core/layout'
import { markdownText } from '#core/text/markdown'
import { prepareGraphFonts } from '#core/text/prepare'
import { computeAccurateBounds } from '#core/vector/curve-math'

/** The set inline SVG artwork is reported in, which no icon provider has. */
const INLINE_SVG = 'svg'

function stringProp(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/** Inline SVG through the same path pipeline as Iconify icons, placed as SVG import places it. */
function svgIconData({ body, elements, props }: SVGSource, box: Size): IconData | null {
  // Children may arrive as parsed SVG elements rather than markup; both use the same shapes.
  let content = body.trim() ? extractSVGContent(body) : null
  if (!content?.paths.length) content = extractSVGContentFromElements(elements, props)
  const space = parseSVGViewBoxValue(stringProp(props.viewBox)) ?? { x: 0, y: 0, ...box }
  const paths = svgIconPaths(content, space, box, {
    preserveAspectRatio: stringProp(props.preserveAspectRatio),
    transform: stringProp(props.transform)
  })
  if (paths.length === 0) return null
  return {
    prefix: INLINE_SVG,
    name: stringProp(props.name) ?? 'custom',
    width: box.width,
    height: box.height,
    paths
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
