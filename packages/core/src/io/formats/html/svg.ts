import { compact } from 'es-toolkit'

import {
  serializeNode,
  type DesignDocument,
  type DesignElement,
  type DesignNode
} from '@open-pencil/dom-css'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { BLACK } from '@open-pencil/scene-graph/constants'
import { parseCSSColor } from '@open-pencil/scene-graph/css'
import { ICON_NAME } from '@open-pencil/scene-graph/icons'

import { drawIcon } from '#core/icons'
import { svgIconPaths } from '#core/icons/artwork'
import { extractSVGContent } from '#core/icons/svg'
import { parseSVGViewBoxValue } from '#core/io/formats/svg/metadata'
import { svgViewportAttributes } from '#core/vector/vectorize/svg/transform'

/** The set inline SVG with no icon name is reported in, which no icon provider has. */
const INLINE_SVG = 'svg'

function isElement(node: DesignNode): node is DesignElement {
  return node.type === 'element'
}

function* elementsIn(nodes: readonly DesignNode[]): Generator<DesignElement> {
  for (const node of nodes.filter(isElement)) {
    yield node
    yield* elementsIn(node.children)
  }
}

/** The element each `href="#id"` in `element` points at. */
/** An attribute or style value an element may not have. */
function valueOf(values: Readonly<Record<string, string>> | undefined, name: string) {
  return values && Object.hasOwn(values, name) ? values[name] : undefined
}

function referencedIds(element: DesignElement): string[] {
  return [...elementsIn([element])].flatMap((child) => {
    const href = valueOf(child.attrs, 'href') ?? valueOf(child.attrs, 'xlink:href')
    return href?.startsWith('#') ? [href.slice(1)] : []
  })
}

/**
 * The elements outside an SVG that its `<use>` and paint references reach, as a page keeps an
 * icon sprite's `<symbol>`s in one hidden SVG and draws them from others, with what they reach.
 */
function outsideReferences(
  element: DesignElement,
  byId: ReadonlyMap<string, DesignElement>
): DesignElement[] {
  const inside = new Set(elementsIn([element]))
  const reached = new Map<string, DesignElement>()
  const pending = referencedIds(element)
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    const target = byId.get(id)
    if (!target || inside.has(target) || reached.has(id)) continue
    reached.set(id, target)
    for (const next of referencedIds(target)) pending.push(next)
  }
  return [...reached.values()]
}

/** The SVG paint properties, with the computed values they start from (SVG 2 §13). */
const INITIAL_PAINT: Readonly<Record<string, string>> = {
  fill: 'rgb(0, 0, 0)',
  'fill-opacity': '1',
  'fill-rule': 'nonzero',
  stroke: 'none',
  'stroke-width': '1px',
  'stroke-opacity': '1',
  'stroke-linecap': 'butt',
  'stroke-linejoin': 'miter',
  'stroke-dasharray': 'none'
}

/**
 * An SVG element with the paint its page's CSS gives it written into its `style`, and its
 * children likewise. A runtime computes the CSS cascade, which may leave out presentation
 * attributes such as `fill="green"`, as the HTML engine does; so only a value that differs from
 * what the element inherits is CSS's own, and the markup draws the rest. A paint in the
 * element's own color is `currentColor`, so the artwork follows it.
 */
function withComputedPaint(
  element: DesignElement,
  inherited: Readonly<Record<string, string>>
): DesignElement {
  const style = element.computedStyle
  const own: Record<string, string> = {}
  const declarations: string[] = []
  for (const property of Object.keys(INITIAL_PAINT)) {
    const value = valueOf(style, property)?.trim()
    own[property] = value ?? inherited[property]
    if (value === undefined || value === inherited[property]) continue
    const isColor = property === 'fill' || property === 'stroke'
    const inColor = isColor && value === valueOf(style, 'color')
    declarations.push(`${property}:${inColor ? 'currentColor' : value}`)
  }
  const css = compact([element.attrs.style, ...declarations]).join(';')
  return {
    ...element,
    attrs: css ? { ...element.attrs, style: css } : element.attrs,
    children: element.children.map((child) =>
      child.type === 'element' ? withComputedPaint(child, own) : child
    )
  }
}

/** The markup of an inline SVG, with the definitions it uses from elsewhere in the page. */
function svgMarkup(element: DesignElement, byId: ReadonlyMap<string, DesignElement>): string {
  const outside = outsideReferences(element, byId).map((target) =>
    withComputedPaint(target, INITIAL_PAINT)
  )
  const defs: DesignElement = { type: 'element', tagName: 'defs', attrs: {}, children: outside }
  // A shape nothing paints is black, as in a browser, rather than in the icon's color.
  const rooted = { ...element, attrs: { fill: 'black', ...element.attrs } }
  const painted = withComputedPaint(rooted, INITIAL_PAINT)
  const children = outside.length > 0 ? [defs, ...painted.children] : painted.children
  return serializeNode({ ...painted, children })
}

/** An icon name a page gave the SVG, as OpenPencil's HTML export and Iconify write it. */
function iconName(element: DesignElement): { prefix: string; name: string } | null {
  const named = element.attrs['data-icon']
  if (!named || !ICON_NAME.test(named)) return null
  const [prefix, name] = named.split(':')
  return { prefix, name }
}

/**
 * Draws each inline SVG HTML import built a frame for into that frame, at the size layout and
 * placement gave it, through the path pipeline Iconify icons and design JSX `<svg>` use: its
 * `viewBox` mapped onto the frame as its `preserveAspectRatio` says, `currentColor` in the
 * element's color, and `<use>` reaching symbols defined elsewhere in the page. An SVG a page
 * names as an icon, as `data-icon="lucide:save"`, becomes that icon, which can be swapped,
 * recolored, and exported by name; others are artwork.
 */
export function drawInlineSVGs(
  graph: SceneGraph,
  svgs: ReadonlyMap<string, DesignElement>,
  page: DesignDocument
): void {
  if (svgs.size === 0) return
  const byId = new Map(
    [...elementsIn(page.children)].flatMap((element) =>
      element.attrs.id ? [[element.attrs.id, element] as const] : []
    )
  )
  for (const [frameId, element] of svgs) {
    const frame = graph.getNode(frameId)
    if (!frame || frame.width <= 0 || frame.height <= 0) continue
    const box = { width: frame.width, height: frame.height }
    const markup = svgMarkup(element, byId)
    const viewBox = valueOf(element.attrs, 'viewBox') ?? valueOf(element.attrs, 'viewbox')
    const space = parseSVGViewBoxValue(viewBox) ?? {
      x: 0,
      y: 0,
      ...box
    }
    const paths = svgIconPaths(extractSVGContent(markup), space, box, svgViewportAttributes(markup))
    if (paths.length === 0) continue
    const named = iconName(element)
    const icon = { prefix: INLINE_SVG, name: 'svg', ...named, ...box, paths }
    const color = parseCSSColor(element.computedStyle?.color) ?? BLACK
    drawIcon(graph, frameId, icon, Math.max(box.width, box.height), color, {
      identity: named !== null
    })
  }
}
