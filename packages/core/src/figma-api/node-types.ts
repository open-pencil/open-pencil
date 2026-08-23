/// <reference types="@figma/plugin-typings" />

import type { FigmaNodeProxy } from './proxy'

export type FigmaRectangleNode = FigmaNodeProxy & RectangleNode
export type FigmaFrameNode = FigmaNodeProxy & FrameNode
export type FigmaTextNode = FigmaNodeProxy & TextNode
export type FigmaEllipseNode = FigmaNodeProxy & EllipseNode
export type FigmaLineNode = FigmaNodeProxy & LineNode
export type FigmaVectorNode = FigmaNodeProxy & VectorNode
export type FigmaPolygonNode = FigmaNodeProxy & PolygonNode
export type FigmaStarNode = FigmaNodeProxy & StarNode
export type FigmaComponentNode = FigmaNodeProxy & ComponentNode
export type FigmaComponentSetNode = FigmaNodeProxy & ComponentSetNode
export type FigmaSectionNode = FigmaNodeProxy & SectionNode
export type FigmaGroupNode = FigmaNodeProxy & GroupNode
export type FigmaBooleanOperationNode = FigmaNodeProxy & BooleanOperationNode
