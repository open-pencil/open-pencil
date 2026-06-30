import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export type DesignNode = DesignElement | DesignText

export interface DesignDocument {
  type: 'document'
  children: DesignNode[]
  stylesheets?: DesignStyleSheet[]
  sourceGraph?: SceneGraph
}

export interface DesignElement {
  type: 'element'
  tagName: string
  attrs: Record<string, string>
  children: DesignNode[]
  inlineStyle?: DesignStyleDeclaration
  computedStyle?: DesignStyleDeclaration
  sourceSceneNodeId?: string
  sourceSceneNode?: SceneNode
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

export interface CSSComputeOptions {
  includeBrowserDefaults?: boolean
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
