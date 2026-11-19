import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import type { ShaderPreset } from '@open-pencil/scene-graph/shaders'

import type { CSSFontFaceRule } from './import/font-faces'
import type { DesignTokens } from './tokens/references'

export type DesignNode = DesignElement | DesignText

export interface DesignDocument {
  type: 'document'
  children: DesignNode[]
  stylesheets?: DesignStyleSheet[]
  /**
   * The `@font-face` rules of the page's stylesheets, linked and imported ones included, for a
   * host to load the faces its text is set in.
   */
  fontFaces?: CSSFontFaceRule[]
  /**
   * The color the page's canvas is painted: the root element's background, or the body's when the
   * root has none, as CSS paints it; none when neither has one, which a browser shows as white.
   */
  background?: string
  sourceGraph?: SceneGraph
  /** Variable references the projection wrote, for Tailwind names and the token stylesheet. */
  tokens?: DesignTokens
}

export interface DesignElement {
  type: 'element'
  tagName: string
  attrs: Record<string, string>
  children: DesignNode[]
  inlineStyle?: DesignStyleDeclaration
  computedStyle?: DesignStyleDeclaration
  /** Where the engine that computed the styles laid the element out, when it was asked to. */
  layout?: DesignLayout
  /** The picture an `<img>` shows, as the runtime that styled the page loaded it. */
  image?: DesignResource
  sourceSceneNodeId?: string
  sourceSceneNode?: SceneNode
  /**
   * The shader the layer fills with, which plays behind its content: a framework draws it with
   * the `shaders` library, static HTML shows `frame`, its still frame as a data URL.
   */
  shader?: { preset: ShaderPreset; frame?: string }
}

/** A file a page loads, such as a stylesheet, a font, or a picture, as its host fetched it. */
export interface DesignResource {
  /** Where it came from, after redirects. */
  url: string
  bytes: Uint8Array
  /** Its media type without parameters, such as `image/svg+xml`, when the host knows it. */
  contentType?: string
}

/**
 * Fetches a file a page loads; null when it cannot. `signal` aborts when the request runs out of
 * time, and styling goes on without it.
 */
export type DesignResourceFetch = (
  url: string,
  signal: AbortSignal
) => Promise<DesignResource | null>

export interface DesignText {
  type: 'text'
  text: string
}

export interface DesignStyleSheet {
  type: 'stylesheet'
  cssText: string
  href?: string
}

export type DesignStyleDeclaration = Record<string, string>

/**
 * An element as laid out, in CSS pixels from the top-left of the document, before transforms,
 * which move what is drawn but not the layout. `fragments` are an inline element's boxes, one per
 * line it spans, and `lines` are the line boxes of the text it holds directly or through its
 * inline descendants.
 */
export interface DesignLayout {
  box: Rect
  fragments?: Rect[]
  lines?: Rect[]
}

/** The viewport an engine lays the document out in; `height` resolves `vh` units. */
export interface DesignViewport {
  width: number
  height: number
}

export interface CSSComputeOptions {
  includeBrowserDefaults?: boolean
  /** Record where each element is laid out as well as its computed style. */
  layout?: boolean
  viewport?: DesignViewport
}

export interface CSSRuntime {
  readonly kind: 'browser' | 'headless'
  parseHTML(html: string): DesignDocument
  serializeHTML(document: DesignDocument): string
  computeStyles(
    document: DesignDocument,
    cssText?: string,
    options?: CSSComputeOptions
  ): Promise<DesignDocument>
}
