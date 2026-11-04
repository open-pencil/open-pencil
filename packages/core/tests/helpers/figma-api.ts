import type {
  ComponentNode,
  PageNode,
  SolidPaint,
  TextNode
} from '@figma/plugin-typings/plugin-api-standalone'

import type { SkiaRenderer } from '@open-pencil/core/canvas'
import { FigmaAPI, type FigmaNodeProxy } from '@open-pencil/core/figma-api'
import { headlessRenderer } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type Fill } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

export function createAPI(): FigmaAPI {
  return new FigmaAPI(new SceneGraph())
}

/** Reads a proxy through Figma's `TextNode` surface, which `wrapNode()` cannot name. */
export function asTextNode(node: FigmaNodeProxy): FigmaNodeProxy & TextNode {
  return node as FigmaNodeProxy & TextNode
}

/**
 * Names a proxy a component, including where a rejection path is handed one and the runtime
 * guard, not the type, is what the test exercises.
 */
export function asComponentNode(node: FigmaNodeProxy): FigmaNodeProxy & ComponentNode {
  return node as FigmaNodeProxy & ComponentNode
}

function isPageNode(node: FigmaNodeProxy): node is FigmaNodeProxy & PageNode {
  return node.type === 'PAGE'
}

/**
 * Names `api.currentPage` as a page. The boolean-operation entry points only take Figma's node
 * types, while the current-page proxy is typed by its selection alone.
 */
export function asPageNode(page: FigmaNodeProxy): FigmaNodeProxy & PageNode {
  if (!isPageNode(page)) throw new Error(`Expected a page, got ${page.type}`)
  return page
}

/**
 * A solid paint that satisfies both the OpenPencil `Fill` and the Figma `SolidPaint` shape, as the
 * node proxies expose the intersection of the two.
 */
/** A solid paint both the scene graph and the plugin API take: it carries no transform. */
type SolidFill = Omit<Fill, 'gradientTransform' | 'imageTransform'> & SolidPaint

export function solidFill(
  color: Color,
  overrides: { opacity?: number; visible?: boolean } = {}
): SolidFill {
  return {
    type: 'SOLID',
    color,
    opacity: overrides.opacity ?? 1,
    visible: overrides.visible ?? true
  }
}

/** A white 800×600 frame and a way to add named 50 px squares to it and read their stack order. */
export function createStackHost() {
  const figma = new FigmaAPI(new SceneGraph())
  const host = figma.createFrame()
  host.resize(800, 600)
  const rect = (name: string, x: number) => {
    const node = figma.createRectangle()
    node.name = name
    node.resize(50, 50)
    node.x = x
    host.appendChild(node)
    return node
  }
  const order = () => host.children.map((child: FigmaNodeProxy) => child.name)
  return { figma, host, rect, order }
}

/**
 * Attaches the process's headless renderer to `api`, as the app and `open-pencil eval` do, so
 * geometry, booleans, and flatten measure real paths. One renderer serves every test, as each new
 * one would keep its own copy of every font loaded after it; the paths it keeps by layer id are
 * cleared, since another document's layers share those ids.
 */
export async function attachTestRenderer(api: FigmaAPI): Promise<SkiaRenderer> {
  const renderer = await headlessRenderer()
  renderer.nodePaths.clear()
  renderer.invalidateAllPictures()
  api.setRenderer(renderer)
  return renderer
}
