import type { DesignElement, DesignNode, VectorElementRenderer } from '@open-pencil/dom-css/export'
import { isIconModified, readIcon, readIconTint } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'

import { iconColor } from '#core/icons/render'
import { renderNodeSVGElement } from '#core/io/formats/svg/export'
import type { SVGNode } from '#core/io/formats/svg/node'

function designNode(node: SVGNode | string): DesignNode {
  if (typeof node === 'string') return { type: 'text', text: node }
  return {
    type: 'element',
    tagName: node.tag,
    attrs: Object.fromEntries(
      Object.entries(node.attrs).map(([name, value]) => [name, String(value)])
    ),
    children: node.children.map(designNode)
  }
}

/**
 * A layer id as an id-safe string, one to one: letters, digits, and `-` stay, and anything
 * else, `_` included, becomes `_<code point>_`, so `a:b` and `a-b` never meet.
 */
function idPart(id: string): string {
  return id.replace(/[^A-Za-z0-9-]/gu, (char) => `_${char.codePointAt(0)?.toString(16) ?? ''}_`)
}

/**
 * Vector layers and icons in HTML exports as inline SVG from the SVG export, so paths,
 * gradients, and shadows draw as they do there. An icon is one SVG whose tinted paths take
 * `currentColor`, so a page recolors it with CSS `color`, named by `data-icon` unless its paths
 * were edited. Def ids start with the layer's id, so several SVGs on one page never pick up each
 * other's gradients or filters.
 */
export const vectorElement: VectorElementRenderer = (graph, node) => {
  const idPrefix = `${idPart(node.id)}-`
  const icon = readIcon(node)
  const drawn = renderNodeSVGElement(graph, node, {
    idPrefix,
    colorSpace: graph.documentColorSpace,
    tint: icon ? readIconTint : undefined
  })
  const element = drawn && designNode(drawn)
  if (element?.type !== 'element') return null
  const color = icon ? iconColor(graph, node) : null
  return {
    ...element,
    // An icon whose paths were edited no longer draws the named icon, so it goes unnamed.
    attrs:
      icon && !isIconModified(graph, node)
        ? { ...element.attrs, 'data-icon': icon.name }
        : element.attrs,
    // Strokes and shadows can reach past the layer's box, which an inline SVG would clip.
    inlineStyle: { overflow: 'visible', ...(color ? { color: colorToHex(color) } : {}) }
  } satisfies DesignElement
}
