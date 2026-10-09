import type { Element } from '@xmldom/xmldom'

import type { SVGClipPathRegion, SVGElementLayer, SVGTextInfo } from '#core/icons/types'

import { inlineStyles, opacityValue, type PresentationAttributes } from './presentation'

export interface Traversal {
  root: Element
  elementsById: ReadonlyMap<string, Element>
  nextKey: number
  /** `<text>` elements in drawing order; each records how many paths precede it. */
  texts: SVGTextInfo[]
}

/** What an element inherits from the elements around it. */
export interface Scope {
  presentation: PresentationAttributes
  transform: string | null
  clipPaths: SVGClipPathRegion[]
  elements: SVGElementLayer[]
  useStack: ReadonlySet<Element>
  /** Drawn through `<use>` or inside a `<clipPath>`, so ids name the source, not this copy. */
  referenced: boolean
}

export function elementLayer(
  traversal: Traversal,
  element: Element,
  kind: SVGElementLayer['kind'],
  scope: Pick<Scope, 'referenced'>,
  clip: number | null
): SVGElementLayer {
  return {
    key: traversal.nextKey++,
    kind,
    name: scope.referenced ? null : element.getAttribute('id') || null,
    opacity: opacityValue(inlineStyles(element).get('opacity') ?? element.getAttribute('opacity')),
    clip
  }
}
