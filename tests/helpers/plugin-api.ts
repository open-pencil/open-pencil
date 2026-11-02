import { FigmaAPI, type FigmaNodeProxy } from '@open-pencil/core/figma-api'
import { SceneGraph, type Fill } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

// Plugin API support for the render and colour suites still under tests/engine. Core's own Plugin
// API tests use #core-tests/helpers/figma-api, which root tests cannot address; this goes when
// those suites move to their owners.

export function createAPI(): FigmaAPI {
  return new FigmaAPI(new SceneGraph())
}

/** Names `api.currentPage` as a page, which the boolean-operation entry points require. */
export function asPageNode(
  page: FigmaNodeProxy & { selection: FigmaNodeProxy[] }
): FigmaNodeProxy & PageNode {
  return page as FigmaNodeProxy & PageNode
}

/** A solid paint both the scene graph and the plugin API take: it carries no transform. */
type SolidFill = Omit<Fill, 'gradientTransform' | 'imageTransform'> & SolidPaint

export function solidFill(color: Color): SolidFill {
  return { type: 'SOLID', color, opacity: 1, visible: true }
}
