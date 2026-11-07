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
import { bindGraph } from './graph'
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
import { waitOutsideScript } from './waits'

const MIXED = Symbol('mixed')

export type { FigmaFont, FigmaFontName } from './fonts/names'

export const INTERNAL_ID = Symbol('id')
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
  const load = pageHosts.get(api)?.load(pageId)
  // A page's layers load as the document was saved, which is no part of the script's edit.
  return load ? waitOutsideScript(api, load) : Promise.resolve()
}

/** The page holding a layer not loaded yet, which loading that page brings in. */
export function pageOfNode(api: NodeProxyHost, nodeId: string): Promise<string | null> {
  const found = pageHosts.get(api)?.pageOfNode?.(nodeId)
  return found ? waitOutsideScript(api, found) : Promise.resolve(null)
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
  [INTERNAL_ID]: string
  readonly #graph: SceneGraph;
  [INTERNAL_API]: NodeProxyHost

  constructor(id: string, graph: SceneGraph, api: NodeProxyHost) {
    super()
    this[INTERNAL_ID] = id
    this.#graph = graph
    bindGraph(this, graph)
    this[INTERNAL_API] = api
    const type = graph.getNode(id)?.type
    const internals = { id: INTERNAL_ID, api: INTERNAL_API }
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

  #update(changes: Partial<SceneNode>): void {
    assertNodeEditable(this.#graph, this[INTERNAL_ID])
    const graph = this.#graph
    const id = this[INTERNAL_ID]
    graph.updateNode(id, changes)
    recordInstanceOverride(graph, id, Object.keys(changes))
  }

  #raw(): SceneNode {
    const n = this.#graph.getNode(this[INTERNAL_ID])
    if (!n) throw new Error(`Node ${this[INTERNAL_ID]} has been removed`)
    return n
  }

  insertCharacters(
    start: number,
    characters: string,
    useStyle: TextProxy.InsertStyleSource = 'BEFORE'
  ): void {
    TextProxy.insertCharacters(this.#graph, this.#raw(), start, characters, useStyle)
  }

  deleteCharacters(start: number, end: number): void {
    TextProxy.deleteCharacters(this.#graph, this.#raw(), start, end)
  }

  get isMask(): boolean {
    return this.#raw().isMask
  }

  set isMask(v: boolean) {
    prepareFollowedFieldEdit(this.#graph, this.#raw(), 'isMask', 'is-mask')
    this.#update({ isMask: v })
    // A mask limits what its group spans.
    fitGroupsAround(this.#graph, this.#raw().parentId, this[INTERNAL_API].groupFitOptions)
  }

  get maskType(): string {
    return this.#raw().maskType
  }

  set maskType(v: string) {
    prepareFollowedFieldEdit(this.#graph, this.#raw(), 'maskType', 'mask-type')
    this.#update({ maskType: v as SceneNode['maskType'] })
  }

  // --- UI state ---

  get expanded(): boolean {
    return this.#raw().expanded
  }

  set expanded(v: boolean) {
    this.#update({ expanded: v })
  }

  // --- Components ---

  get backgrounds(): readonly FigmaPaint[] {
    // A page draws its background colour's alpha times the paint's opacity, which Figma reads as
    // the opacity alone.
    return Object.freeze(
      getPageBackgrounds(this.#raw()).map((paint) =>
        toFigmaPaint({ ...paint, opacity: paint.opacity * paint.color.a })
      )
    )
  }

  set backgrounds(value: readonly FigmaPaint[]) {
    const fills = parseFigmaPaints(value, 'set_backgrounds', 'backgrounds')
    setPageBackgrounds(this.#graph, this.#raw(), fills)
  }

  /** The async form Figma requires in dynamic-page mode; same result as mainComponent. */
  async getMainComponentAsync(): Promise<FigmaNodeProxy | null> {
    return this.mainComponent
  }

  get mainComponent(): FigmaNodeProxy | null {
    const n = this.#raw()
    if (!n.componentId) return null
    const comp = this.#graph.getNode(n.componentId)
    if (!comp) return null
    return this[INTERNAL_API].wrapNode(comp.id)
  }

  createInstance(): FigmaInstanceNode {
    const n = this.#raw()
    if (n.type !== 'COMPONENT') throw new Error('createInstance() can only be called on components')
    const pageId = this[INTERNAL_API].currentPageId
    const inst = this.#graph.createInstance(n.id, pageId)
    if (!inst) throw new Error('Failed to create instance')
    // `wrapNode` cannot know the node's type; this one just built an instance.
    return this[INTERNAL_API].wrapNode(inst.id) as FigmaInstanceNode
  }

  /** Turns this instance into a frame that keeps its current content, like Figma's. */
  detachInstance(): FigmaFrameNode {
    const n = this.#raw()
    if (n.type !== 'INSTANCE') throw new Error('detachInstance() can only be called on instances')
    assertNodeEditable(this.#graph, this[INTERNAL_ID])
    this.#graph.detachInstance(n.id)
    // The node is a frame once detached, which `wrapNode` has no way to tell.
    return this[INTERNAL_API].wrapNode(n.id) as FigmaFrameNode
  }

  /** Points this instance at another component, as Figma's swapComponent does. */
  swapComponent(component: FigmaNodeProxy): void {
    const n = this.#raw()
    if (n.type !== 'INSTANCE') throw new Error('swapComponent() can only be called on instances')
    const target = this.#graph.getNode(component[INTERNAL_ID])
    if (target?.type !== 'COMPONENT') throw new Error('swapComponent() needs a component')
    assertNodeEditable(this.#graph, this[INTERNAL_ID])
    this.#graph.swapInstanceComponent(n.id, target.id)
  }

  // --- Tree ---

  get parent(): FigmaNodeProxy | null {
    const n = this.#raw()
    if (!n.parentId) return null
    return this[INTERNAL_API].wrapNode(n.parentId)
  }

  get children(): FigmaNodeProxy[] {
    return pluginChildren(this.#graph, this[INTERNAL_ID]).map((c) =>
      this[INTERNAL_API].wrapNode(c.id)
    )
  }

  appendChild(child: FigmaNodeProxy): void {
    assertNodeEditable(this.#graph, this[INTERNAL_ID])
    assertNodeEditable(this.#graph, child[INTERNAL_ID])
    assertNoComponentCycle(this.#graph, this[INTERNAL_ID], child[INTERNAL_ID], 'appendChild')
    prepareSlotMove(this.#graph, this[INTERNAL_ID], child[INTERNAL_ID], 'appendChild')
    this.#reparentAndFit(child[INTERNAL_ID])
    // A child already here moves to the end, as Figma does; reparenting leaves it in place.
    const last = this.#raw().childIds.length - 1
    if (this.#raw().childIds[last] !== child[INTERNAL_ID])
      this.#graph.insertChildAt(child[INTERNAL_ID], this[INTERNAL_ID], last)
  }

  /**
   * Moves a child here as Figma does: it keeps its transform into its container, so its `x`, `y`,
   * and rotation stay and it moves with its new parent. The groups it left and joined refit.
   */
  #reparentAndFit(childId: string): void {
    const scene = this.#graph
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
    assertNodeEditable(this.#graph, this[INTERNAL_ID])
    assertNodeEditable(this.#graph, child[INTERNAL_ID])
    assertNoComponentCycle(this.#graph, this[INTERNAL_ID], child[INTERNAL_ID], 'insertChild')
    prepareSlotMove(this.#graph, this[INTERNAL_ID], child[INTERNAL_ID], 'insertChild')
    this.#reparentAndFit(child[INTERNAL_ID])
    this.#graph.insertChildAt(child[INTERNAL_ID], this[INTERNAL_ID], index)
  }

  clone(): FigmaNodeProxy {
    assertNodeEditable(this.#graph, this[INTERNAL_ID])
    const n = this.#raw()
    const parentId = n.parentId ?? this[INTERNAL_API].currentPageId
    const cloned = this.#graph.cloneTree(this[INTERNAL_ID], parentId)
    if (!cloned) throw new Error(`Failed to clone node ${this[INTERNAL_ID]}`)
    // A slot's copy is a plain frame: the slot binding belongs to the original alone.
    if (slotPropertyId(cloned))
      this.#graph.updateNode(cloned.id, {
        componentPropertyReferences: cloned.componentPropertyReferences.filter(
          (reference) => reference.field !== 'SLOT_CONTENT'
        )
      })
    return this[INTERNAL_API].wrapNode(cloned.id)
  }

  remove(): void {
    assertNodeEditable(this.#graph, this[INTERNAL_ID])
    prepareSlotRemoval(this.#graph, this[INTERNAL_ID])
    const parentId = this.#raw().parentId
    // Connectors go with a layer they attach to, as Figma removes them.
    const attached = attachedConnectors(this.#graph, [this[INTERNAL_ID]])
    this.#graph.deleteNode(this[INTERNAL_ID])
    for (const connector of attached) this.#graph.deleteNode(connector.id)
    fitGroupsAround(this.#graph, parentId, this[INTERNAL_API].groupFitOptions)
  }

  findAll(callback?: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy[] {
    return Traversal.findAll(this.#graph, this[INTERNAL_API], this[INTERNAL_ID], callback)
  }

  findOne(callback: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy | null {
    return Traversal.findOne(this.#graph, this[INTERNAL_API], this[INTERNAL_ID], callback)
  }

  findChild(callback: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy | null {
    return Traversal.findChild(this.#graph, this[INTERNAL_API], this[INTERNAL_ID], callback)
  }

  findChildren(callback?: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy[] {
    return Traversal.findChildren(this.#graph, this[INTERNAL_API], this[INTERNAL_ID], callback)
  }

  findAllWithCriteria(criteria: { types?: string[] }): FigmaNodeProxy[] {
    return Traversal.findAllWithCriteria(
      this.#graph,
      this[INTERNAL_API],
      this[INTERNAL_ID],
      criteria
    )
  }

  // --- Serialization ---

  toJSON(maxDepth?: number, currentDepth = 0): Record<string, unknown> {
    return nodeProxyToJSON(
      this.#graph,
      this[INTERNAL_API],
      this[INTERNAL_ID],
      maxDepth,
      currentDepth
    )
  }

  toString(): string {
    const n = this.#raw()
    return `[${n.type} "${n.name}" ${n.id}]`
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.toString()
  }
}

installBasicNodeProxyAccessors(FigmaNodeProxy.prototype, {
  id: INTERNAL_ID,
  api: INTERNAL_API
})

installVisualNodeProxyAccessors(
  FigmaNodeProxy.prototype,
  { id: INTERNAL_ID, api: INTERNAL_API },
  MIXED
)

const proxyInternals = {
  id: INTERNAL_ID,
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
