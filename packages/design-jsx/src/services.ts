import type { SceneGraph, SceneNode, VectorNetwork } from '@open-pencil/scene-graph'
import type { Color, Rect } from '@open-pencil/scene-graph/primitives'

import type { TreeNode } from './tree'

/** Inline `<svg>` content: markup, parsed shape elements, or both, with the element's props. */
export interface SVGSource {
  body: string
  elements: TreeNode[]
  props: Record<string, unknown>
}

/** Where to put artwork and how to size and color it. */
export interface ArtworkPlacement {
  parentId: string
  size: number
  color: Color
  overrides: Partial<SceneNode>
}

/**
 * Engine work the renderer delegates. `Artwork` is whatever the engine uses to describe
 * vector paths; the renderer only passes it from `icon`/`svg` to `createArtwork`.
 */
export interface DesignJSXServices<Artwork> {
  /** A named icon such as `lucide:heart` at `size`, or null when it does not exist. */
  icon(name: string, size: number): Promise<Artwork | null>
  /** Inline SVG scaled to `size`, or null when it has no supported shapes. */
  svg(source: SVGSource, size: number): Artwork | null
  /** Vector nodes for the artwork, created under the placement's parent. */
  createArtwork(graph: SceneGraph, artwork: Artwork, placement: ArtworkPlacement): SceneNode
  /** Size and lay out the rendered roots once they are in place. */
  layout(graph: SceneGraph, rootIds: readonly string[]): void
  /** The tight bounds of a vector network, its curves included, which size a `<Vector>`. */
  vectorBounds(network: VectorNetwork): Rect
  /**
   * `<Text markdown>`: Markdown as a text's characters, ranges, and paragraphs over `base`. An
   * engine without it renders everything else and refuses only `<Text markdown>`.
   */
  markdown?: MarkdownService
}

/** Markdown as a text's characters, ranges, and paragraphs, relative to its own style. */
export type MarkdownService = (
  source: string,
  base: Pick<SceneNode, 'fontSize' | 'fontWeight'>
) => Pick<SceneNode, 'text' | 'styleRuns' | 'textParagraphs'>
