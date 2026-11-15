import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import type { ShaderPreset } from '@open-pencil/scene-graph/shaders'

import type { DesignTokens } from './tokens/references'

export type DesignNode = DesignElement | DesignText

export interface DesignDocument {
  type: 'document'
  children: DesignNode[]
  stylesheets?: DesignStyleSheet[]
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
  sourceSceneNodeId?: string
  sourceSceneNode?: SceneNode
  /**
   * The shader the layer fills with, which plays behind its content: a framework draws it with
   * the `shaders` library, static HTML shows `frame`, its still frame as a data URL.
   */
  shader?: { preset: ShaderPreset; frame?: string }
}

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
