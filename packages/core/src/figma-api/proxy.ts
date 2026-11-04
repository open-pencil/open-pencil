import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { attachedConnectors } from '@open-pencil/scene-graph/connectors'
import type { GroupFitOptions } from '@open-pencil/scene-graph/group-bounds'
import { createsComponentCycle, recordInstanceOverride } from '@open-pencil/scene-graph/instances'
import { slotPropertyId } from '@open-pencil/scene-graph/slots'

import type { SkiaRenderer } from '#core/canvas'
import { assertNodeEditable } from '#core/editor/capabilities'

import { prepareFollowedFieldEdit, fitGroupsAround } from './accessor-utils'
import { installBasicNodeProxyAccessors } from './accessors/basic'
import { installComponentNodeAccessors } from './accessors/component'
import { installConnectorNodeProxyAccessors } from './accessors/connector'
import { installGuideAccessors } from './accessors/guides'
import { installLayoutNodeProxyAccessors } from './accessors/layout'
import { installShapeNodeProxyAccessors } from './accessors/shape'
import { installStickyNodeProxyAccessors, pluginChildren } from './accessors/sticky'
import { installStrokeNodeProxyAccessors } from './accessors/strokes'
import { installStyleReferenceAccessors } from './accessors/styles'
import { installTextNodeProxyAccessors } from './accessors/text'
import { installTextRangeMethods } from './accessors/text/ranges'
import { installVariableModeNodeProxyAccessors } from './accessors/variables'
import { installVectorNodeProxyAccessors } from './accessors/vector'
import { installVisualNodeProxyAccessors } from './accessors/visual'
import { installComponentPropertyAccessors } from './components'
import { installCSSAccessors } from './css'
import { installDevStatusAccessors } from './dev-status'
import { installExportAccessors } from './export/accessors'
import type { ExportHost } from './export/render'
import { installGeometryAccessors } from './geometry/accessors'
import { FigmaNodeMembers } from './members'
import type { FigmaFrameNode, FigmaInstanceNode } from './node-types'
import { installInstanceOverrideAccessors } from './overrides'
import { getPageBackgrounds, setPageBackgrounds } from './page-backgrounds'
import { parseFigmaPaints, toFigmaPaint, type FigmaPaint } from './paints'
import { installPluginDataMethods } from './plugin-data'
import { nodeProxyToJSON } from './serialization'
import { installShapeWithTextAccessors } from './shape-with-text'
import { installSlotAccessors, prepareSlotMove, prepareSlotRemoval } from './slots'
import * as TextProxy from './text'
import { containerTransform, setContainerTransform } from './transform'
import * as Traversal from './traversal'

const MIXED = Symbol('mixed')

export type { FigmaFont, FigmaFontName } from './fonts/names'

export const INTERNAL_ID = Symbol('id')
export const INTERNAL_GRAPH = Symbol('graph')
export const INTERNAL_API = Symbol('api')

/** How a host loads pages as they are visited; see `FigmaAPIOptions`. */
export interface PageHost {
  load: (pageId: string) => Promise<void>
  pageOfNode?: (nodeId: string) => Promise<string | null>
}

/**
 * How each API loads a page's layers, a host's hook kept off `figma`, which has only Figma's
 * members. Without one every page is in memory.
 */
const pageHosts = new WeakMap<NodeProxyHost, PageHost>()

export function setPageHost(api: NodeProxyHost, host: PageHost): void {
  pageHosts.set(api, host)
}

export function loadPage(api: NodeProxyHost, pageId: string): Promise<void> {
  return pageHosts.get(api)?.load(pageId) ?? Promise.resolve()
}

/** The page holding a layer not loaded yet, which loading that page brings in. */
export function pageOfNode(api: NodeProxyHost, nodeId: string): Promise<string | null> {
  return pageHosts.get(api)?.pageOfNode?.(nodeId) ?? Promise.resolve(null)
}

export interface NodeProxyHost extends ExportHost {
  wrapNode(id: string): FigmaNodeProxy
  readonly currentPageId: string
  /** How groups and booleans refit; booleans size to their result when a renderer is attached. */
  readonly groupFitOptions: GroupFitOptions
  /** The renderer that measures geometry, when the host has one. */
  readonly renderer: SkiaRenderer | null
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

export class FigmaNodeProxy extends FigmaNodeMembers {
  /** Installed by `installGeometryAccessors` on the layers Figma gives it. */
  declare outlineStroke: () => FigmaNodeProxy | null;
  [INTERNAL_ID]: string;
  [INTERNAL_GRAPH]: SceneGraph;
  [INTERNAL_API]: NodeProxyHost

  constructor(id: string, graph: SceneGraph, api: NodeProxyHost) {
    super()
    this[INTERNAL_ID] = id
    this[INTERNAL_GRAPH] = graph
    this[INTERNAL_API] = api
    const type = graph.getNode(id)?.type
    const internals = { id: INTERNAL_ID, graph: INTERNAL_GRAPH, api: INTERNAL_API }
    if (type === 'VECTOR') installVectorNodeProxyAccessors(this, internals, MIXED)
    if (type) installShapeNodeProxyAccessors(this, internals, type)
    if (type) installComponentNodeAccessors(this, internals, type)
    if (type) installGuideAccessors(this, internals, type)
    if (type) installInstanceOverrideAccessors(this, internals, type)
    if (type) installStyleReferenceAccessors(this, internals, type, id === graph.rootId, MIXED)
    if (type && id !== graph.rootId) installExportAccessors(this, internals)
    installCSSAccessors(this, internals)
    if (type) installGeometryAccessors(this, internals, type)
    // Figma loads a page's layers on demand in dynamic-page mode and has `loadAsync` on pages
    // alone, as the editor loads a page's layers when it is first visited.
    if (type === 'CANVAS')
      Object.defineProperty(this, 'loadAsync', { value: () => loadPage(api, id) })
    if (id === graph.rootId)
      Object.defineProperty(this, 'documentColorProfile', {
        get: () => (graph.documentColorSpace === 'display-p3' ? 'DISPLAY_P3' : 'SRGB')
      })
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
    // A child already here moves to the end, as Figma does; reparenting leaves it in place.
    const last = this._raw().childIds.length - 1
    if (this._raw().childIds[last] !== child[INTERNAL_ID])
      this[INTERNAL_GRAPH].insertChildAt(child[INTERNAL_ID], this[INTERNAL_ID], last)
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
installSlotAccessors(FigmaNodeProxy.prototype, proxyInternals)
installDevStatusAccessors(FigmaNodeProxy.prototype, proxyInternals)
installShapeWithTextAccessors(FigmaNodeProxy.prototype, proxyInternals)
