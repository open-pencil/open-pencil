import type { EnabledLibraryBinding, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { JSONObject } from '@open-pencil/std/json'

export const DESIGN_JSON_FORMAT = 'open-pencil/design-json'
export const DESIGN_JSON_VERSION = 1

/** A layer as JSON: every field it keeps, with its children nested in place of their IDs. */
export type DesignJSONLayer = JSONObject & {
  id: string
  type: SceneNode['type']
  name: string
  children?: DesignJSONLayer[]
  computed?: DesignJSONComputed
}

/** What the design works out for a layer rather than keeps on it. */
export interface DesignJSONComputed {
  /** The mode the layer is in for each collection its variables belong to, by collection ID. */
  variableModes: Record<string, string>
  /**
   * Each variable the layer uses, resolved in the layer's modes with aliases and formulas
   * followed, by variable ID; null where it does not resolve.
   */
  variables: Record<string, unknown>
  /** The comment threads pinned to the layer, by ID, deleted ones left out. */
  commentThreadIds: string[]
}

/** A page of the document: the pages of a design, and the internal page shared styles live on. */
export interface DesignJSONPage {
  id: string
  name: string
  internalOnly: boolean
}

/** The document the layers belong to. */
export interface DesignJSONDocument {
  rootId: string
  kind: SceneGraph['documentKind']
  colorSpace: SceneGraph['documentColorSpace']
  /** The Kiwi schema version of the `.fig` file the document was read from, if any. */
  figKiwiVersion: number | null
  /**
   * That file's compressed Kiwi schema, which describes the `.fig` format rather than the design,
   * written as {@link DesignJSONOptions.bytes} says; only when {@link DesignJSONOptions.figSchema}
   * asks for it.
   */
  figSchema?: unknown
  pages: DesignJSONPage[]
  /** The libraries the document uses, by library ID. */
  enabledLibraries: Record<string, EnabledLibraryBinding>
}

/** An image a layer's paint draws, keyed by its hash in {@link DesignJSON.images}. */
export interface DesignJSONImage {
  mimeType: string
  byteLength: number
  /** The image as a data URL, when {@link DesignJSONOptions.images} is `'data-url'`. */
  dataURL?: string
}

/** The layers asked for and everything they reference, all of it plain JSON. */
export interface DesignJSON {
  format: typeof DESIGN_JSON_FORMAT
  version: typeof DESIGN_JSON_VERSION
  document: DesignJSONDocument
  layers: DesignJSONLayer[]
  /** Variables the layers use, with the variables those alias, by ID. */
  variables: Record<string, JSONObject>
  /** The collections those variables belong to, by ID. */
  variableCollections: Record<string, JSONObject>
  /** Main components of the instances among the layers, with the ones those use, by ID. */
  components: Record<string, DesignJSONLayer>
  /** The shared styles the layers use, by the style ID they link it by. */
  styles: Record<string, DesignJSONLayer>
  images: Record<string, DesignJSONImage>
  /**
   * Every comment thread in the document, with its replies, resolved and deleted ones
   * included; each layer's `computed.commentThreadIds` names the live ones pinned to it.
   */
  comments: JSONObject[]
}

/** What a {@link DesignJSONOptions.transform} is told about the layer it rewrites. */
export interface DesignJSONLayerContext {
  graph: SceneGraph
  /** How far below a layer asked for this one is: 0 for the layer itself. */
  depth: number
  /**
   * Whether the layer belongs to a main component in {@link DesignJSON.components} or a shared
   * style in {@link DesignJSON.styles}, rather than to the layers asked for.
   */
  component: boolean
}

/** How bytes in a layer's fields, such as path geometry and text pictures, are written. */
export type DesignJSONBytes = 'base64' | 'length' | 'omit'

export interface DesignJSONOptions {
  /** The fields each layer keeps; all of them when absent. `id`, `type`, and `name` always stay. */
  pick?: readonly (keyof SceneNode)[]
  /** Fields each layer leaves out, after `pick`. */
  omit?: readonly (keyof SceneNode)[]
  /** How many levels of children are nested: 0 writes the layers alone. Unlimited by default. */
  depth?: number
  /**
   * Bytes as `{ byteLength, base64 }`, as `{ byteLength }` alone, or left out. Base64 by
   * default, so nothing is lost.
   */
  bytes?: DesignJSONBytes
  /** Images with their data URL, with their type and size alone, or left out. Data URLs by default. */
  images?: 'data-url' | 'summary' | 'omit'
  /** Adds `worldBounds`, the layer's axis-aligned box on the canvas. On by default. */
  worldBounds?: boolean
  /**
   * Variables, collections, main components, shared styles, and images the layers reference. On
   * by default; off, the layers keep their IDs alone.
   */
  references?: boolean
  /** Adds `computed` to each layer: its variable modes and resolved values, and its comments. On by default. */
  computed?: boolean
  /** Writes the document's comment threads. On by default. */
  comments?: boolean
  /** Adds the `.fig` file's Kiwi schema to `document`. Off by default: it describes the format, not the design. */
  figSchema?: boolean
  /**
   * Rewrites each layer once its fields and children are written, children first; returning null
   * leaves the layer out.
   */
  transform?: (
    layer: DesignJSONLayer,
    node: SceneNode,
    context: DesignJSONLayerContext
  ) => DesignJSONLayer | null
}
