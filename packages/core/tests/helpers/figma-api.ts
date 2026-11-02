import { FigmaAPI, type FigmaNodeProxy } from '@open-pencil/core/figma-api'
import { fontManager } from '@open-pencil/core/text'
import { SceneGraph, type Fill } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

export function createAPI(): FigmaAPI {
  return new FigmaAPI(new SceneGraph())
}

/**
 * Registers the app's bundled variable Inter as `family`, upright and italic, as a host's own
 * fonts are, so `loadFontAsync` loads any weight of it. Plugin text edits refuse fonts that are
 * not loaded, as in Figma, so tests that edit text load their fonts first, as scripts do.
 */
export async function registerTestFont(family = 'Inter'): Promise<void> {
  const data = await fontManager.fetchBundledFont('/InterVariable.ttf')
  if (!data) throw new Error('The bundled Inter font is missing')
  await fontManager.markLoaded(family, 'Regular', data)
  await fontManager.markLoaded(family, 'Regular Italic', data)
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

/**
 * Names `api.currentPage` as a page. The boolean-operation entry points only take Figma's node
 * types, while the current-page proxy is typed by its selection alone.
 */
export function asPageNode(
  page: FigmaNodeProxy & { selection: FigmaNodeProxy[] }
): FigmaNodeProxy & PageNode {
  return page as FigmaNodeProxy & PageNode
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
