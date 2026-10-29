import type {
  ArcData,
  HyperlinkTarget,
  SceneGraph,
  SceneNode,
  NodeType,
  LayoutGrid,
  LayoutMode
} from '@open-pencil/scene-graph'
import { attachedConnectors } from '@open-pencil/scene-graph/connectors'
import type { GroupFitOptions } from '@open-pencil/scene-graph/group-bounds'
import { createsComponentCycle, recordInstanceOverride } from '@open-pencil/scene-graph/instances'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'
import type { ShapeWithTextType } from '@open-pencil/scene-graph/shape-with-text'
import { slotPropertyId } from '@open-pencil/scene-graph/slots'

import { assertNodeEditable } from '#core/editor/capabilities'
import type { FigmaEffect } from '#core/figma-api/effects'

import { prepareFollowedFieldEdit, fitGroupsAround } from './accessor-utils'
import { installBasicNodeProxyAccessors } from './accessors/basic'
import { installConnectorNodeProxyAccessors } from './accessors/connector'
import { installLayoutNodeProxyAccessors } from './accessors/layout'
import { installShapeNodeProxyAccessors } from './accessors/shape'
import { installStickyNodeProxyAccessors, pluginChildren } from './accessors/sticky'
import { installStrokeNodeProxyAccessors } from './accessors/strokes'
import { installTextNodeProxyAccessors } from './accessors/text'
import { installTextRangeMethods, type TextRangeMethods } from './accessors/text/ranges'
import {
  installVariableModeNodeProxyAccessors,
  type VariableNodeMembers
} from './accessors/variables'
import {
  installVectorNodeProxyAccessors,
  type FigmaVectorNetwork,
  type FigmaVectorPath
} from './accessors/vector'
import { installVisualNodeProxyAccessors } from './accessors/visual'
import { installComponentPropertyAccessors } from './components'
import { installDevStatusAccessors, type FigmaDevStatusValue } from './dev-status'
import type { FigmaFontName } from './fonts'
import type { FigmaFrameNode, FigmaInstanceNode } from './node-types'
import { installInstanceOverrideAccessors, type FigmaInstanceOverride } from './overrides'
import { getPageBackgrounds, setPageBackgrounds } from './page-backgrounds'
import { parseFigmaPaints, toFigmaPaint, type FigmaPaint } from './paints'
import { installPluginDataMethods, type PluginDataMethods } from './plugin-data'
import { nodeProxyToJSON } from './serialization'
import { installShapeWithTextAccessors } from './shape-with-text'
import { installSlotAccessors, prepareSlotMove, prepareSlotRemoval } from './slots'
import type { FigmaLetterSpacing, FigmaLineHeight } from './text'
import * as TextProxy from './text'
import { containerTransform, setContainerTransform } from './transform'
import * as Traversal from './traversal'
import type { FigmaTransform } from './types'

const MIXED = Symbol('mixed')

export { weightToStyleName, type FigmaFont, type FigmaFontName } from './fonts'

export const INTERNAL_ID = Symbol('id')
export const INTERNAL_GRAPH = Symbol('graph')
export const INTERNAL_API = Symbol('api')

export interface NodeProxyHost {
  wrapNode(id: string): FigmaNodeProxy
  readonly currentPageId: string
  /** How groups and booleans refit; booleans size to their result when a renderer is attached. */
  readonly groupFitOptions: GroupFitOptions
}

export { MIXED }

/** Figma refuses a move that would make a component contain itself. */
function assertNoComponentCycle(
  graph: SceneGraph,
  parentId: string,
  childId: string,
  method: 'appendChild' | 'insertChild'
): void {
  if (createsComponentCycle(graph, childId, parentId))
    throw new Error(`in ${method}: Cannot move node. Reparenting would create a component cycle`)
}

export class FigmaNodeProxy {
  [INTERNAL_ID]: string;
  [INTERNAL_GRAPH]: SceneGraph;
  [INTERNAL_API]: NodeProxyHost

  declare readonly id: string
  /** A slot frame reads as `'SLOT'`, as Figma's `SlotNode` does. */
  declare readonly type: NodeType | 'SLOT'
  declare name: string
  declare readonly removed: boolean
  declare x: number
  declare y: number
  declare readonly width: number
  declare readonly height: number
  declare rotation: number
  declare relativeTransform: FigmaTransform
  declare resize: (width: number, height: number) => void
  declare resizeWithoutConstraints: (width: number, height: number) => void
  declare rescale: (scale: number) => void
  declare readonly absoluteTransform: FigmaTransform
  declare readonly absoluteBoundingBox: Rect
  declare readonly absoluteRenderBounds: Rect | null

  declare fills: readonly FigmaPaint[] | symbol
  declare strokes: readonly FigmaPaint[]
  declare effects: readonly FigmaEffect[]
  declare opacity: number
  declare visible: boolean
  declare locked: boolean
  declare devStatus: FigmaDevStatusValue | undefined
  declare blendMode: string
  declare clipsContent: boolean
  declare cornerRadius: number | typeof MIXED
  declare topLeftRadius: number
  declare topRightRadius: number
  declare bottomLeftRadius: number
  declare bottomRightRadius: number
  declare cornerSmoothing: number

  declare layoutMode: LayoutMode
  declare layoutGrids: readonly LayoutGrid[]
  declare primaryAxisAlignItems: string
  declare counterAxisAlignItems: string
  declare itemSpacing: number
  declare counterAxisSpacing: number
  declare paddingTop: number
  declare paddingRight: number
  declare paddingBottom: number
  declare paddingLeft: number
  declare layoutWrap: string
  declare primaryAxisSizingMode: string
  declare counterAxisSizingMode: string
  declare counterAxisAlignContent: string
  declare itemReverseZIndex: boolean
  declare strokesIncludedInLayout: boolean
  declare layoutPositioning: string
  declare layoutGrow: number
  declare layoutAlign: string
  declare layoutSizingHorizontal: string
  declare layoutSizingVertical: string
  declare constraints: { horizontal: string; vertical: string }
  declare minWidth: number | null
  declare maxWidth: number | null
  declare minHeight: number | null
  declare maxHeight: number | null
  declare readonly targetAspectRatio: Vector | null
  /** @deprecated Figma's alias for whether `targetAspectRatio` is set. */
  declare constrainProportions: boolean
  declare lockAspectRatio: () => void
  declare unlockAspectRatio: () => void
  declare pointCount: number
  declare innerRadius: number
  declare arcData: Readonly<ArcData>
  declare vectorPaths: readonly FigmaVectorPath[]
  declare vectorNetwork: FigmaVectorNetwork
  declare setVectorNetworkAsync: (vectorNetwork: FigmaVectorNetwork) => Promise<void>
  declare handleMirroring: SceneNode['handleMirroring'] | typeof MIXED
  declare getPluginData: PluginDataMethods['getPluginData']
  declare setPluginData: PluginDataMethods['setPluginData']
  declare getPluginDataKeys: PluginDataMethods['getPluginDataKeys']
  declare getSharedPluginData: PluginDataMethods['getSharedPluginData']
  declare setSharedPluginData: PluginDataMethods['setSharedPluginData']
  declare getSharedPluginDataKeys: PluginDataMethods['getSharedPluginDataKeys']
  declare readonly explicitVariableModes: VariableNodeMembers['explicitVariableModes']
  declare readonly resolvedVariableModes: VariableNodeMembers['resolvedVariableModes']
  declare setExplicitVariableModeForCollection: VariableNodeMembers['setExplicitVariableModeForCollection']
  declare clearExplicitVariableModeForCollection: VariableNodeMembers['clearExplicitVariableModeForCollection']
  declare readonly boundVariables: VariableNodeMembers['boundVariables']
  declare setBoundVariable: VariableNodeMembers['setBoundVariable']
  declare readonly overrides: FigmaInstanceOverride[] | undefined
  /** A sticky note's body or a shape's label, a sticky's author line, and whether it is wide. */
  declare readonly text: FigmaNodeProxy | undefined
  declare readonly authorName: string | undefined
  declare authorVisible: boolean | undefined
  declare isWideWidth: boolean | undefined
  declare shapeType: ShapeWithTextType | undefined
  /** On pages alone, as in Figma. */
  declare loadAsync: () => Promise<void>
  declare resetOverrides: () => void

  declare strokeWeight: number
  declare strokeAlign: string
  declare dashPattern: readonly number[]
  declare strokeCap: string
  declare strokeJoin: string
  declare strokeMiterLimit: number
  declare strokeTopWeight: number
  declare strokeBottomWeight: number
  declare strokeLeftWeight: number
  declare strokeRightWeight: number

  declare characters: string
  declare fontSize: number | symbol
  declare fontName: FigmaFontName | symbol
  declare fontWeight: number | symbol
  declare textAlignHorizontal: string
  declare textAlignVertical: string
  declare textAutoResize: string
  declare letterSpacing: FigmaLetterSpacing | symbol
  declare lineHeight: FigmaLineHeight | symbol
  declare textCase: SceneNode['textCase'] | symbol
  declare hyperlink: HyperlinkTarget | null | symbol
  declare textStyleId: string | symbol
  declare fillStyleId: string | symbol
  declare textDecoration: SceneNode['textDecoration'] | symbol
  declare maxLines: number | null
  declare listSpacing: number | symbol
  declare paragraphSpacing: number | symbol
  declare paragraphIndent: number | symbol
  declare hangingList: boolean
  declare textTruncation: string
  declare autoRename: boolean

  // Per-character and per-paragraph methods: accessors/text/ranges.ts.
  declare getStyledTextSegments: TextRangeMethods['getStyledTextSegments']
  declare getRangeAllFontNames: TextRangeMethods['getRangeAllFontNames']
  declare getRangeFontSize: TextRangeMethods['getRangeFontSize']
  declare setRangeFontSize: TextRangeMethods['setRangeFontSize']
  declare getRangeFontName: TextRangeMethods['getRangeFontName']
  declare setRangeFontName: TextRangeMethods['setRangeFontName']
  declare getRangeFontWeight: TextRangeMethods['getRangeFontWeight']
  declare getRangeFills: TextRangeMethods['getRangeFills']
  declare setRangeFills: TextRangeMethods['setRangeFills']
  declare getRangeLetterSpacing: TextRangeMethods['getRangeLetterSpacing']
  declare setRangeLetterSpacing: TextRangeMethods['setRangeLetterSpacing']
  declare getRangeLineHeight: TextRangeMethods['getRangeLineHeight']
  declare setRangeLineHeight: TextRangeMethods['setRangeLineHeight']
  declare getRangeTextDecoration: TextRangeMethods['getRangeTextDecoration']
  declare setRangeTextDecoration: TextRangeMethods['setRangeTextDecoration']
  declare getRangeTextDecorationStyle: TextRangeMethods['getRangeTextDecorationStyle']
  declare setRangeTextDecorationStyle: TextRangeMethods['setRangeTextDecorationStyle']
  declare getRangeTextDecorationOffset: TextRangeMethods['getRangeTextDecorationOffset']
  declare setRangeTextDecorationOffset: TextRangeMethods['setRangeTextDecorationOffset']
  declare getRangeTextDecorationThickness: TextRangeMethods['getRangeTextDecorationThickness']
  declare setRangeTextDecorationThickness: TextRangeMethods['setRangeTextDecorationThickness']
  declare getRangeTextDecorationColor: TextRangeMethods['getRangeTextDecorationColor']
  declare setRangeTextDecorationColor: TextRangeMethods['setRangeTextDecorationColor']
  declare getRangeTextDecorationSkipInk: TextRangeMethods['getRangeTextDecorationSkipInk']
  declare setRangeTextDecorationSkipInk: TextRangeMethods['setRangeTextDecorationSkipInk']
  declare getRangeOpenTypeFeatures: TextRangeMethods['getRangeOpenTypeFeatures']
  declare getRangeListOptions: TextRangeMethods['getRangeListOptions']
  declare setRangeListOptions: TextRangeMethods['setRangeListOptions']
  declare getRangeIndentation: TextRangeMethods['getRangeIndentation']
  declare setRangeIndentation: TextRangeMethods['setRangeIndentation']
  declare getRangeListSpacing: TextRangeMethods['getRangeListSpacing']
  declare setRangeListSpacing: TextRangeMethods['setRangeListSpacing']
  declare getRangeParagraphSpacing: TextRangeMethods['getRangeParagraphSpacing']
  declare setRangeParagraphSpacing: TextRangeMethods['setRangeParagraphSpacing']
  declare getRangeParagraphIndent: TextRangeMethods['getRangeParagraphIndent']
  declare setRangeParagraphIndent: TextRangeMethods['setRangeParagraphIndent']
  declare getRangeTextCase: TextRangeMethods['getRangeTextCase']
  declare setRangeTextCase: TextRangeMethods['setRangeTextCase']
  declare getRangeHyperlink: TextRangeMethods['getRangeHyperlink']
  declare setRangeHyperlink: TextRangeMethods['setRangeHyperlink']
  declare getRangeTextStyleId: TextRangeMethods['getRangeTextStyleId']
  declare setRangeTextStyleId: TextRangeMethods['setRangeTextStyleId']
  declare setRangeTextStyleIdAsync: TextRangeMethods['setRangeTextStyleIdAsync']
  declare getRangeFillStyleId: TextRangeMethods['getRangeFillStyleId']
  declare setRangeFillStyleId: TextRangeMethods['setRangeFillStyleId']
  declare setRangeFillStyleIdAsync: TextRangeMethods['setRangeFillStyleIdAsync']
  declare getRangeBoundVariable: TextRangeMethods['getRangeBoundVariable']
  declare setRangeBoundVariable: TextRangeMethods['setRangeBoundVariable']

  constructor(id: string, graph: SceneGraph, api: NodeProxyHost) {
    this[INTERNAL_ID] = id
    this[INTERNAL_GRAPH] = graph
    this[INTERNAL_API] = api
    const type = graph.getNode(id)?.type
    const internals = { id: INTERNAL_ID, graph: INTERNAL_GRAPH, api: INTERNAL_API }
    if (type === 'VECTOR') installVectorNodeProxyAccessors(this, internals, MIXED)
    if (type) installShapeNodeProxyAccessors(this, internals, type)
    // Figma loads a page's layers on demand in dynamic-page mode and has `loadAsync` on pages
    // alone; every page here is already loaded.
    if (type === 'CANVAS')
      Object.defineProperty(this, 'loadAsync', { value: () => Promise.resolve() })
  }

  private _update(changes: Partial<SceneNode>): void {
    assertNodeEditable(this[INTERNAL_GRAPH], this[INTERNAL_ID])
    const graph = this[INTERNAL_GRAPH]
    const id = this[INTERNAL_ID]
    graph.updateNode(id, changes)
    recordInstanceOverride(graph, id, Object.keys(changes))
  }

  private _raw(): SceneNode {
    const n = this[INTERNAL_GRAPH].getNode(this[INTERNAL_ID])
    if (!n) throw new Error(`Node ${this[INTERNAL_ID]} has been removed`)
    return n
  }

  insertCharacters(
    start: number,
    characters: string,
    useStyle: TextProxy.InsertStyleSource = 'BEFORE'
  ): void {
    TextProxy.insertCharacters(this[INTERNAL_GRAPH], this._raw(), start, characters, useStyle)
  }

  deleteCharacters(start: number, end: number): void {
    TextProxy.deleteCharacters(this[INTERNAL_GRAPH], this._raw(), start, end)
  }

  get isMask(): boolean {
    return this._raw().isMask
  }

  set isMask(v: boolean) {
    prepareFollowedFieldEdit(this[INTERNAL_GRAPH], this._raw(), 'isMask', 'is-mask')
    this._update({ isMask: v })
    // A mask limits what its group spans.
    fitGroupsAround(this[INTERNAL_GRAPH], this._raw().parentId, this[INTERNAL_API].groupFitOptions)
  }

  get maskType(): string {
    return this._raw().maskType
  }

  set maskType(v: string) {
    prepareFollowedFieldEdit(this[INTERNAL_GRAPH], this._raw(), 'maskType', 'mask-type')
    this._update({ maskType: v as SceneNode['maskType'] })
  }

  // --- UI state ---

  get expanded(): boolean {
    return this._raw().expanded
  }

  set expanded(v: boolean) {
    this._update({ expanded: v })
  }

  // --- Components ---

  get backgrounds(): readonly FigmaPaint[] {
    // A page draws its background colour's alpha times the paint's opacity, which Figma reads as
    // the opacity alone.
    return Object.freeze(
      getPageBackgrounds(this._raw()).map((paint) =>
        toFigmaPaint({ ...paint, opacity: paint.opacity * paint.color.a })
      )
    )
  }

  set backgrounds(value: readonly FigmaPaint[]) {
    const fills = parseFigmaPaints(value, 'set_backgrounds', 'backgrounds')
    setPageBackgrounds(this[INTERNAL_GRAPH], this._raw(), fills)
  }

  /** The async form Figma requires in dynamic-page mode; same result as mainComponent. */
  async getMainComponentAsync(): Promise<FigmaNodeProxy | null> {
    return this.mainComponent
  }

  get mainComponent(): FigmaNodeProxy | null {
    const n = this._raw()
    if (!n.componentId) return null
    const comp = this[INTERNAL_GRAPH].getNode(n.componentId)
    if (!comp) return null
    return this[INTERNAL_API].wrapNode(comp.id)
  }

  createInstance(): FigmaInstanceNode {
    const n = this._raw()
    if (n.type !== 'COMPONENT') throw new Error('createInstance() can only be called on components')
    const pageId = this[INTERNAL_API].currentPageId
    const inst = this[INTERNAL_GRAPH].createInstance(n.id, pageId)
    if (!inst) throw new Error('Failed to create instance')
    // `wrapNode` cannot know the node's type; this one just built an instance.
    return this[INTERNAL_API].wrapNode(inst.id) as FigmaInstanceNode
  }

  /** Turns this instance into a frame that keeps its current content, like Figma's. */
  detachInstance(): FigmaFrameNode {
    const n = this._raw()
    if (n.type !== 'INSTANCE') throw new Error('detachInstance() can only be called on instances')
    assertNodeEditable(this[INTERNAL_GRAPH], this[INTERNAL_ID])
    this[INTERNAL_GRAPH].detachInstance(n.id)
    // The node is a frame once detached, which `wrapNode` has no way to tell.
    return this[INTERNAL_API].wrapNode(n.id) as FigmaFrameNode
  }

  /** Points this instance at another component, as Figma's swapComponent does. */
  swapComponent(component: FigmaNodeProxy): void {
    const n = this._raw()
    if (n.type !== 'INSTANCE') throw new Error('swapComponent() can only be called on instances')
    const target = this[INTERNAL_GRAPH].getNode(component[INTERNAL_ID])
    if (target?.type !== 'COMPONENT') throw new Error('swapComponent() needs a component')
    assertNodeEditable(this[INTERNAL_GRAPH], this[INTERNAL_ID])
    this[INTERNAL_GRAPH].swapInstanceComponent(n.id, target.id)
  }

  // --- Tree ---

  get parent(): FigmaNodeProxy | null {
    const n = this._raw()
    if (!n.parentId) return null
    return this[INTERNAL_API].wrapNode(n.parentId)
  }

  get children(): FigmaNodeProxy[] {
    return pluginChildren(this[INTERNAL_GRAPH], this[INTERNAL_ID]).map((c) =>
      this[INTERNAL_API].wrapNode(c.id)
    )
  }

  appendChild(child: FigmaNodeProxy): void {
    assertNodeEditable(this[INTERNAL_GRAPH], this[INTERNAL_ID])
    assertNodeEditable(this[INTERNAL_GRAPH], child[INTERNAL_ID])
    assertNoComponentCycle(
      this[INTERNAL_GRAPH],
      this[INTERNAL_ID],
      child[INTERNAL_ID],
      'appendChild'
    )
    prepareSlotMove(this[INTERNAL_GRAPH], this[INTERNAL_ID], child[INTERNAL_ID], 'appendChild')
    this._reparentAndFit(child[INTERNAL_ID])
  }

  /**
   * Moves a child here as Figma does: it keeps its transform into its container, so its `x`, `y`,
   * and rotation stay and it moves with its new parent. The groups it left and joined refit.
   */
  private _reparentAndFit(childId: string): void {
    const scene = this[INTERNAL_GRAPH]
    const child = scene.getNode(childId)
    if (!child) return
    const previousParentId = child.parentId
    const transform = containerTransform(child, scene)
    scene.reparentNode(childId, this[INTERNAL_ID])
    setContainerTransform(scene, child, transform)
    const options = this[INTERNAL_API].groupFitOptions
    fitGroupsAround(scene, previousParentId, options)
    fitGroupsAround(scene, this[INTERNAL_ID], options)
  }

  insertChild(index: number, child: FigmaNodeProxy): void {
    assertNodeEditable(this[INTERNAL_GRAPH], this[INTERNAL_ID])
    assertNodeEditable(this[INTERNAL_GRAPH], child[INTERNAL_ID])
    assertNoComponentCycle(
      this[INTERNAL_GRAPH],
      this[INTERNAL_ID],
      child[INTERNAL_ID],
      'insertChild'
    )
    prepareSlotMove(this[INTERNAL_GRAPH], this[INTERNAL_ID], child[INTERNAL_ID], 'insertChild')
    this._reparentAndFit(child[INTERNAL_ID])
    this[INTERNAL_GRAPH].insertChildAt(child[INTERNAL_ID], this[INTERNAL_ID], index)
  }

  clone(): FigmaNodeProxy {
    assertNodeEditable(this[INTERNAL_GRAPH], this[INTERNAL_ID])
    const n = this._raw()
    const parentId = n.parentId ?? this[INTERNAL_API].currentPageId
    const cloned = this[INTERNAL_GRAPH].cloneTree(this[INTERNAL_ID], parentId)
    if (!cloned) throw new Error(`Failed to clone node ${this[INTERNAL_ID]}`)
    // A slot's copy is a plain frame: the slot binding belongs to the original alone.
    if (slotPropertyId(cloned))
      this[INTERNAL_GRAPH].updateNode(cloned.id, {
        componentPropertyReferences: cloned.componentPropertyReferences.filter(
          (reference) => reference.field !== 'SLOT_CONTENT'
        )
      })
    return this[INTERNAL_API].wrapNode(cloned.id)
  }

  remove(): void {
    assertNodeEditable(this[INTERNAL_GRAPH], this[INTERNAL_ID])
    prepareSlotRemoval(this[INTERNAL_GRAPH], this[INTERNAL_ID])
    const parentId = this._raw().parentId
    // Connectors go with a layer they attach to, as Figma removes them.
    const attached = attachedConnectors(this[INTERNAL_GRAPH], [this[INTERNAL_ID]])
    this[INTERNAL_GRAPH].deleteNode(this[INTERNAL_ID])
    for (const connector of attached) this[INTERNAL_GRAPH].deleteNode(connector.id)
    fitGroupsAround(this[INTERNAL_GRAPH], parentId, this[INTERNAL_API].groupFitOptions)
  }

  findAll(callback?: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy[] {
    return Traversal.findAll(this[INTERNAL_GRAPH], this[INTERNAL_API], this[INTERNAL_ID], callback)
  }

  findOne(callback: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy | null {
    return Traversal.findOne(this[INTERNAL_GRAPH], this[INTERNAL_API], this[INTERNAL_ID], callback)
  }

  findChild(callback: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy | null {
    return Traversal.findChild(
      this[INTERNAL_GRAPH],
      this[INTERNAL_API],
      this[INTERNAL_ID],
      callback
    )
  }

  findChildren(callback?: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy[] {
    return Traversal.findChildren(
      this[INTERNAL_GRAPH],
      this[INTERNAL_API],
      this[INTERNAL_ID],
      callback
    )
  }

  findAllWithCriteria(criteria: { types?: string[] }): FigmaNodeProxy[] {
    return Traversal.findAllWithCriteria(
      this[INTERNAL_GRAPH],
      this[INTERNAL_API],
      this[INTERNAL_ID],
      criteria
    )
  }

  // --- Serialization ---

  toJSON(maxDepth?: number, currentDepth = 0): Record<string, unknown> {
    return nodeProxyToJSON(
      this[INTERNAL_GRAPH],
      this[INTERNAL_API],
      this[INTERNAL_ID],
      maxDepth,
      currentDepth
    )
  }

  toString(): string {
    const n = this._raw()
    return `[${n.type} "${n.name}" ${n.id}]`
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.toString()
  }
}

installBasicNodeProxyAccessors(FigmaNodeProxy.prototype, {
  id: INTERNAL_ID,
  graph: INTERNAL_GRAPH,
  api: INTERNAL_API
})

installVisualNodeProxyAccessors(
  FigmaNodeProxy.prototype,
  { id: INTERNAL_ID, graph: INTERNAL_GRAPH, api: INTERNAL_API },
  MIXED
)

const proxyInternals = {
  id: INTERNAL_ID,
  graph: INTERNAL_GRAPH,
  api: INTERNAL_API
}

installStrokeNodeProxyAccessors(FigmaNodeProxy.prototype, proxyInternals)
installStickyNodeProxyAccessors(FigmaNodeProxy.prototype, proxyInternals)
installConnectorNodeProxyAccessors(FigmaNodeProxy.prototype, proxyInternals)
installTextNodeProxyAccessors(FigmaNodeProxy.prototype, proxyInternals, MIXED)
installTextRangeMethods(FigmaNodeProxy.prototype, proxyInternals, MIXED)
installLayoutNodeProxyAccessors(FigmaNodeProxy.prototype, proxyInternals)
installVariableModeNodeProxyAccessors(FigmaNodeProxy.prototype, proxyInternals)
installPluginDataMethods(FigmaNodeProxy.prototype, proxyInternals)
installComponentPropertyAccessors(FigmaNodeProxy.prototype, proxyInternals)
installInstanceOverrideAccessors(FigmaNodeProxy.prototype, proxyInternals)
installSlotAccessors(FigmaNodeProxy.prototype, proxyInternals)
installDevStatusAccessors(FigmaNodeProxy.prototype, proxyInternals)
installShapeWithTextAccessors(FigmaNodeProxy.prototype, proxyInternals)
