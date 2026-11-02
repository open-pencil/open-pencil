import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { GroupFitOptions } from '@open-pencil/scene-graph/group-bounds'
import { internalCanvas, newSharedStyleId } from '@open-pencil/scene-graph/shared-styles'

import { applyLayerChanges } from '#core/figma-api/accessor-utils'
import type { FigmaNodeProxy } from '#core/figma-api/proxy'

import {
  FigmaEffectStyle,
  FigmaGridStyle,
  FigmaPaintStyle,
  FigmaTextStyle,
  STYLE_TYPES,
  type FigmaBaseStyle,
  type FigmaStyleType,
  type StyleHost
} from './handles'

/** What the style methods need from `figma`. */
interface StyleOwner {
  readonly graph: SceneGraph
  readonly groupFitOptions: GroupFitOptions
  wrapNode(id: string): FigmaNodeProxy
}

interface StyleClasses {
  PAINT: FigmaPaintStyle
  TEXT: FigmaTextStyle
  EFFECT: FigmaEffectStyle
  GRID: FigmaGridStyle
}

const CLASSES = {
  PAINT: FigmaPaintStyle,
  TEXT: FigmaTextStyle,
  EFFECT: FigmaEffectStyle,
  GRID: FigmaGridStyle
}

/** Each API's style handles by ID, so a style reads back as the same object, as in Figma. */
const handlesByOwner = new WeakMap<StyleOwner, Map<string, FigmaBaseStyle>>()

function handles(owner: StyleOwner): Map<string, FigmaBaseStyle> {
  let found = handlesByOwner.get(owner)
  if (!found) {
    found = new Map()
    handlesByOwner.set(owner, found)
  }
  return found
}

function host(owner: StyleOwner): StyleHost {
  return {
    graph: owner.graph,
    wrapNode: (id) => owner.wrapNode(id),
    updateLayer: (node, changes, inInstance) =>
      applyLayerChanges(owner.graph, node.id, changes, owner.groupFitOptions, !inInstance),
    forgetStyle: (id) => handles(owner).delete(id)
  }
}

function handle<T extends FigmaStyleType>(owner: StyleOwner, type: T, id: string): StyleClasses[T] {
  const cache = handles(owner)
  const found = cache.get(id)
  if (found?.type === type) return found as StyleClasses[T]
  const made = new CLASSES[type](host(owner), id) as StyleClasses[T]
  cache.set(id, made)
  return made
}

function typeOf(node: SceneNode): FigmaStyleType | null {
  const entry = Object.entries(STYLE_TYPES).find(([, type]) => type === node.sharedStyleType)
  return entry ? (entry[0] as FigmaStyleType) : null
}

/** A new style of `type`, empty and unnamed, kept on the document's internal page as Figma's. */
function createStyle<T extends FigmaStyleType>(owner: StyleOwner, type: T): StyleClasses[T] {
  const { graph } = owner
  const node = graph.createNode(type === 'TEXT' ? 'TEXT' : 'RECTANGLE', internalCanvas(graph).id, {
    name: '',
    sharedStyleType: STYLE_TYPES[type],
    internalOnly: true,
    // A text style starts as Figma's does, at 12px; the others start empty.
    ...(type === 'TEXT' ? { fontSize: 12 } : { fills: [] }),
    effects: [],
    layoutGrids: []
  })
  const id = newSharedStyleId()
  node.source.id = id
  return handle(owner, type, id)
}

/** The document's own styles of `type`, in the order they were made, as Figma lists them. */
function localStyles<T extends FigmaStyleType>(owner: StyleOwner, type: T): StyleClasses[T][] {
  const styles: StyleClasses[T][] = []
  for (const node of owner.graph.getAllNodes()) {
    if (node.sharedStyleType === STYLE_TYPES[type] && node.source.id)
      styles.push(handle(owner, type, node.source.id))
  }
  return styles
}

function styleById(owner: StyleOwner, id: unknown): FigmaBaseStyle | null {
  if (typeof id !== 'string' || !id) return null
  for (const node of owner.graph.getAllNodes()) {
    const type = typeOf(node)
    if (type && node.source.id === id) return handle(owner, type, id)
  }
  return null
}

/**
 * Figma's style members of `figma`, which `FigmaAPI` extends; installed at runtime below, this
 * class only declares their types.
 */
export abstract class FigmaStyleMethods {
  declare createPaintStyle: () => FigmaPaintStyle
  declare createTextStyle: () => FigmaTextStyle
  declare createEffectStyle: () => FigmaEffectStyle
  declare createGridStyle: () => FigmaGridStyle
  declare getLocalPaintStyles: () => FigmaPaintStyle[]
  declare getLocalTextStyles: () => FigmaTextStyle[]
  declare getLocalEffectStyles: () => FigmaEffectStyle[]
  declare getLocalGridStyles: () => FigmaGridStyle[]
  declare getLocalPaintStylesAsync: () => Promise<FigmaPaintStyle[]>
  declare getLocalTextStylesAsync: () => Promise<FigmaTextStyle[]>
  declare getLocalEffectStylesAsync: () => Promise<FigmaEffectStyle[]>
  declare getLocalGridStylesAsync: () => Promise<FigmaGridStyle[]>
  declare getStyleById: (id: string) => FigmaBaseStyle | null
  declare getStyleByIdAsync: (id: string) => Promise<FigmaBaseStyle | null>
}

const NAMES = { PAINT: 'Paint', TEXT: 'Text', EFFECT: 'Effect', GRID: 'Grid' } as const

function installStyleMethods(prototype: object): void {
  const methods: PropertyDescriptorMap = {
    getStyleById: {
      value(this: StyleOwner, id: unknown) {
        return styleById(this, id)
      }
    },
    getStyleByIdAsync: {
      value(this: StyleOwner, id: unknown) {
        return Promise.resolve(styleById(this, id))
      }
    }
  }
  for (const [type, name] of Object.entries(NAMES) as Array<[FigmaStyleType, string]>) {
    methods[`create${name}Style`] = {
      value(this: StyleOwner) {
        return createStyle(this, type)
      }
    }
    methods[`getLocal${name}Styles`] = {
      value(this: StyleOwner) {
        return localStyles(this, type)
      }
    }
    methods[`getLocal${name}StylesAsync`] = {
      value(this: StyleOwner) {
        return Promise.resolve(localStyles(this, type))
      }
    }
  }
  Object.defineProperties(prototype, methods)
}

installStyleMethods(FigmaStyleMethods.prototype)
