/* eslint-disable max-lines -- SceneGraph is the facade over the domain modules */
import { omitBy } from 'es-toolkit/object'
import { isUndefined } from 'es-toolkit/predicate'

import { removeStaleBindings } from './bindings'
import { BufferedSceneEmitter } from './buffered-events'
import {
  getAbsolutePosition,
  getNodeLocalMatrix,
  getParentWorldMatrix,
  isTranslationOnly,
  localTransformFromWorld
} from './coordinate'
import { cloneNodeProps, type NodeCloneMode } from './copy'
import { bindNodeEvents } from './events'
import { LAYOUT_AFFECTING_KEYS } from './fields/layout'
import { withGeneratedFrameSize } from './generated'
import * as HitTest from './hit-test'
import { generateId } from './ids'
import * as Instances from './instances'
import { LayoutWrites } from './layout/writes'
import Matrix from './matrix'
import { CONTAINER_TYPES, createDefaultNode } from './node-defaults'
import { updateNodePreview, type NodePreviewObserver } from './preview'
import type { Color, Rect, Vector } from './primitives'
import { markSourceFieldsEdited } from './source-metadata'
import { invalidateTextCaches } from './text/picture'
import type {
  DocumentColorSpace,
  DocumentKind,
  EnabledLibraryBinding,
  NodeChangeObserver,
  NodeType,
  SceneGraphEventHandlers,
  SceneNode,
  Variable,
  VariableCollection,
  VariableType,
  VariableValue,
  VariableLiteral
} from './types'
import * as Variables from './variables'
import type { VariableModeFallback } from './variables'
import { normalizeVectorNetwork } from './vector-network'

/** Scopes that graph methods check while a caller's callback runs; scopes nest. */
type GraphScope = 'preview' | 'sourceMetadata' | 'importedState' | 'layout' | 'derivedLayout'

export class SceneGraph {
  nodes = new Map<string, SceneNode>()
  images = new Map<string, Uint8Array>()
  variables = new Map<string, Variable>()
  variableCollections = new Map<string, VariableCollection>()
  activeMode = new Map<string, string>()
  rootId: string
  figKiwiVersion: number | null = null
  /** Deflated kiwi schema bytes from the original .fig file, preserved for roundtrip fidelity. */
  figSchemaDeflated: Uint8Array | null = null
  documentColorSpace: DocumentColorSpace = 'srgb'
  documentKind: DocumentKind = 'design'
  enabledLibraries = new Map<string, EnabledLibraryBinding>()
  readonly emitter = new BufferedSceneEmitter()
  private absPosCache = new Map<string, Vector>()
  private readonly scopeDepths: Record<GraphScope, number> = {
    preview: 0,
    sourceMetadata: 0,
    importedState: 0,
    layout: 0,
    derivedLayout: 0
  }
  private previewObservers: NodePreviewObserver[] = []
  private readonly changeObservers = new Set<NodeChangeObserver>()
  private importedIdGenerator: (() => string) | undefined
  private layoutWrites: LayoutWrites | null = null
  positionPreviewVersion = 0
  instanceIndex = new Map<string, Set<string>>()
  /** Every connector in the graph, so routing need not scan every layer. */
  connectorIds = new Set<string>()

  constructor(private readonly idGenerator: () => string = generateId) {
    const root = createDefaultNode(this.idGenerator, 'FRAME', {
      name: 'Document',
      width: 0,
      height: 0
    })
    this.rootId = root.id
    this.nodes.set(root.id, root)

    this.addPage('Page 1')
  }
  addPage(name: string): SceneNode {
    return this.createNode('CANVAS', this.rootId, { name, width: 0, height: 0 })
  }

  getPages(includeInternal = false): SceneNode[] {
    return this.getChildren(this.rootId).filter(
      (n) => n.type === 'CANVAS' && (includeInternal || !n.internalOnly)
    )
  }
  getAllNodes(): Iterable<SceneNode> {
    return this.nodes.values()
  }
  getNode(id: string): SceneNode | undefined {
    return this.nodes.get(id)
  }
  onNodeEvents(handlers: SceneGraphEventHandlers): () => void {
    return bindNodeEvents(this.emitter, handlers)
  }

  /**
   * Tells `observer` about each node an edit adds and, before it changes, each node it is about
   * to change, so a recorder can keep the node as it was. Unlike node events these are never
   * buffered. Graph methods report the nodes they change; code that writes into a node directly
   * reports it with `willChangeNode` first.
   */
  observeNodeChanges(observer: NodeChangeObserver): () => void {
    this.changeObservers.add(observer)
    return () => this.changeObservers.delete(observer)
  }

  /** Tells `observeNodeChanges` observers that `node` is about to change. */
  willChangeNode(node: SceneNode | undefined): void {
    if (!node) return
    for (const observer of this.changeObservers) observer.before(node)
  }

  countDescendants(nodeId: string): number {
    const node = this.nodes.get(nodeId)
    if (!node) return 0
    let count = 0
    const stack = [...node.childIds]
    while (stack.length > 0) {
      const id = stack.pop()
      if (id === undefined) break
      count++
      const child = this.nodes.get(id)
      if (child) {
        for (const childId of child.childIds) {
          stack.push(childId)
        }
      }
    }
    return count
  }
  addVariable(variable: Variable): void {
    Variables.addVariable(this, variable)
  }
  removeVariable(id: string): void {
    Variables.removeVariable(this, id)
  }
  addCollection(collection: VariableCollection): void {
    Variables.addCollection(this, collection)
  }
  createVariable(
    name: string,
    type: VariableType,
    collectionId: string,
    value?: VariableValue
  ): Variable {
    return Variables.createVariable(
      this,
      () => this.generateEntityId(),
      name,
      type,
      collectionId,
      value
    )
  }

  createCollection(name: string): VariableCollection {
    // The collection and its default mode are both created before either is registered.
    const issued = new Set<string>()
    return Variables.createCollection(this, () => this.generateEntityId(issued), name)
  }

  createMode(collectionId: string, name: string, sourceModeId?: string): string | undefined {
    return Variables.createMode(
      this,
      () => this.generateEntityId(),
      collectionId,
      name,
      sourceModeId
    )
  }

  removeCollection(id: string): void {
    Variables.removeCollection(this, id)
  }

  getActiveModeId(collectionId: string): string {
    return Variables.getActiveModeId(this, collectionId)
  }

  getNodeVariableModeId(nodeId: string, collectionId: string): string {
    return Variables.getNodeVariableModeId(this, nodeId, collectionId)
  }

  setActiveMode(collectionId: string, modeId: string): void {
    Variables.setActiveMode(this, collectionId, modeId)
  }

  addMode(collectionId: string, modeId: string, name: string, sourceMode?: string): void {
    Variables.addMode(this, collectionId, modeId, name, sourceMode)
  }

  removeMode(collectionId: string, modeId: string): void {
    Variables.removeMode(this, collectionId, modeId)
  }

  renameMode(collectionId: string, modeId: string, name: string): void {
    Variables.renameMode(this, collectionId, modeId, name)
  }

  setDefaultMode(collectionId: string, modeId: string): void {
    Variables.setDefaultMode(this, collectionId, modeId)
  }

  resolveVariable(
    variableId: string,
    modeId?: string,
    visited?: Set<string>
  ): VariableLiteral | undefined {
    return Variables.resolveVariable(this, variableId, modeId, visited)
  }

  resolveColorVariable(variableId: string): Color | undefined {
    return Variables.resolveColorVariable(this, variableId)
  }

  resolveNumberVariable(variableId: string): number | undefined {
    return Variables.resolveNumberVariable(this, variableId)
  }

  resolveColorVariableForNode(
    nodeId: string,
    variableId: string,
    fallback?: VariableModeFallback
  ): Color | undefined {
    return Variables.resolveColorVariableForNode(this, nodeId, variableId, fallback)
  }

  resolveNumberVariableForNode(
    nodeId: string,
    variableId: string,
    fallback?: VariableModeFallback
  ): number | undefined {
    return Variables.resolveNumberVariableForNode(this, nodeId, variableId, fallback)
  }

  resolveVariableForNode(
    nodeId: string,
    variableId: string,
    fallback?: VariableModeFallback
  ): VariableLiteral | undefined {
    return Variables.resolveVariableForNode(this, nodeId, variableId, fallback)
  }

  resolveStringVariableForNode(
    nodeId: string,
    variableId: string,
    fallback?: VariableModeFallback
  ): string | undefined {
    return Variables.resolveStringVariableForNode(this, nodeId, variableId, fallback)
  }

  getVariablesForCollection(collectionId: string): Variable[] {
    return Variables.getVariablesForCollection(this, collectionId)
  }

  getVariablesByType(type: VariableType): Variable[] {
    return Variables.getVariablesByType(this, type)
  }

  bindVariable(nodeId: string, field: string, variableId: string): void {
    Variables.bindVariable(this, nodeId, field, variableId)
  }

  unbindVariable(nodeId: string, field: string): void {
    Variables.unbindVariable(this, nodeId, field)
  }

  getChildren(id: string): SceneNode[] {
    const node = this.nodes.get(id)
    if (!node) return []
    return node.childIds
      .map((cid) => this.nodes.get(cid))
      .filter((n): n is SceneNode => n !== undefined)
  }

  isContainer(id: string): boolean {
    const node = this.nodes.get(id)
    return node ? CONTAINER_TYPES.has(node.type) : false
  }

  isDescendant(childId: string, ancestorId: string): boolean {
    return this.closest(childId, (node) => node.id === ancestorId) !== undefined
  }

  /**
   * The node itself or its nearest ancestor that matches. The walk visits at most as many nodes
   * as the graph holds, so a parent cycle in bad data cannot hang it.
   */
  closest(id: string, match: (node: SceneNode) => boolean): SceneNode | undefined {
    let current = this.nodes.get(id)
    for (let steps = 0; current && steps < this.nodes.size; steps++) {
      if (match(current)) return current
      current = current.parentId ? this.nodes.get(current.parentId) : undefined
    }
    return undefined
  }

  /**
   * The page a node is on: the node itself for a page, its nearest page ancestor otherwise, and
   * null for the document root or a node on no page.
   */
  pageOf(id: string): string | null {
    return this.closest(id, (node) => node.type === 'CANVAS')?.id ?? null
  }

  clearAbsPosCache(): void {
    this.absPosCache.clear()
  }

  getAbsolutePosition(id: string): Vector {
    const cached = this.absPosCache.get(id)
    if (cached) return cached

    const node = this.getNode(id)
    if (!node) return { x: 0, y: 0 }

    const result = getAbsolutePosition(node, this)
    this.absPosCache.set(id, result)
    return result
  }

  getAbsoluteBounds(id: string): Rect {
    const pos = this.getAbsolutePosition(id)
    const node = this.nodes.get(id)
    return {
      x: pos.x,
      y: pos.y,
      width: node?.width ?? 0,
      height: node?.height ?? 0
    }
  }
  /**
   * An ID no entity uses; `issued` also excludes IDs handed out earlier in the same creation.
   * A generator that returns more taken IDs than the graph holds must be repeating itself, so
   * it counts as exhausted then; a fixed cap would reject a sequence walking past a large import.
   */
  private generateEntityId(issued?: Set<string>): string {
    let limit = Infinity
    for (let attempt = 0; attempt < limit; attempt++) {
      const id = (this.importedIdGenerator ?? this.idGenerator)()
      if (this.isEntityIdTaken(id) || issued?.has(id)) {
        if (limit === Infinity) limit = this.entityIdCount() + (issued?.size ?? 0) + 1
        continue
      }
      issued?.add(id)
      return id
    }
    throw new Error('The ID generator only returned IDs that are in use')
  }
  private entityIdCount(): number {
    let count = this.nodes.size + this.variables.size + this.variableCollections.size
    for (const collection of this.variableCollections.values()) count += collection.modes.length
    return count
  }
  /** Whether a node, variable, collection, or mode has this id. */
  isEntityIdTaken(id: string): boolean {
    if (this.nodes.has(id) || this.variables.has(id) || this.variableCollections.has(id))
      return true
    // Callers replace collection maps and edit `modes` in place (history snapshots, transfer,
    // undo), so an index of mode IDs would go stale; walk them without allocating instead.
    for (const collection of this.variableCollections.values()) {
      for (const mode of collection.modes) if (mode.modeId === id) return true
    }
    return false
  }
  private indexInstance(componentId: string, instanceId: string): void {
    let set = this.instanceIndex.get(componentId)
    if (!set) {
      set = new Set()
      this.instanceIndex.set(componentId, set)
    }
    set.add(instanceId)
  }
  private unindexInstance(componentId: string, instanceId: string): void {
    this.instanceIndex.get(componentId)?.delete(instanceId)
  }
  private registerNode(node: SceneNode, parentId: string | null): SceneNode {
    node.parentId = parentId
    this.nodes.set(node.id, node)
    if (node.type === 'CONNECTOR') this.connectorIds.add(node.id)
    for (const observer of this.changeObservers) observer.created(node)
    if (node.type === 'INSTANCE' && node.componentId) this.indexInstance(node.componentId, node.id)
    this.emitter.emit('node:created', node)
    return node
  }
  /** Publish synchronous graph events only after the supplied mutation succeeds. */
  withBufferedEvents<T>(action: () => T): T {
    return this.emitter.batch(action)
  }

  createNode(type: NodeType, parentId: string, overrides: Partial<SceneNode> = {}): SceneNode {
    const node = createDefaultNode(() => this.generateEntityId(), type, overrides)
    const parent = this.nodes.get(parentId)
    this.willChangeNode(parent)
    parent?.childIds.push(node.id)
    return this.registerNode(node, parentId)
  }
  createNodeWithId(
    id: string,
    type: NodeType,
    parentId: string | null,
    overrides: Partial<SceneNode> = {}
  ): SceneNode {
    const node = createDefaultNode(() => id, type, overrides)
    // `overrides` may be another node's snapshot, ID included.
    node.id = id
    const parent = parentId ? this.nodes.get(parentId) : undefined
    if (parent && !parent.childIds.includes(id)) {
      this.willChangeNode(parent)
      parent.childIds.push(id)
    }
    return this.registerNode(node, parentId)
  }

  private withScope<T>(scope: GraphScope, fn: () => T): T {
    this.scopeDepths[scope]++
    try {
      return fn()
    } finally {
      this.scopeDepths[scope]--
    }
  }

  runPreviewUpdates(fn: () => void, beforeUpdate?: NodePreviewObserver): void {
    if (beforeUpdate) this.previewObservers.push(beforeUpdate)
    try {
      this.withScope('preview', fn)
    } finally {
      if (beforeUpdate) this.previewObservers.pop()
    }
  }
  preserveSourceMetadataDuring<T>(fn: () => T): T {
    return this.withScope('sourceMetadata', fn)
  }
  get isPreservingSourceMetadata(): boolean {
    return this.scopeDepths.sourceMetadata > 0
  }

  applyImportedStateDuring<T>(fn: () => T, idGenerator?: () => string): T {
    const previousGenerator = this.importedIdGenerator
    this.importedIdGenerator = idGenerator ?? previousGenerator
    try {
      return this.withScope('importedState', () => this.preserveSourceMetadataDuring(fn))
    } finally {
      this.importedIdGenerator = previousGenerator
    }
  }

  get isApplyingImportedState(): boolean {
    return this.scopeDepths.importedState > 0
  }

  /**
   * Lays out what the document already holds: a page as it loads, or again once its fonts
   * arrive. What this writes derives from the document; an edit's own layout is not this.
   */
  applyDerivedLayoutDuring(fn: () => void): void {
    this.withScope('derivedLayout', fn)
  }

  get isApplyingDerivedLayout(): boolean {
    return this.scopeDepths.derivedLayout > 0
  }

  /**
   * Runs `fn` as layout. Its updates are published once the outermost layout ends, still as
   * layout, and without values a pass changed and a later pass put back (`LayoutWrites`). Outside
   * derived layout, the positions and sizes it publishes count as edited, so formats save them.
   */
  withLayoutMutations(fn: () => void): void {
    const outermost = this.scopeDepths.layout === 0
    this.scopeDepths.layout++
    if (outermost) this.layoutWrites = new LayoutWrites()
    try {
      fn()
    } finally {
      try {
        if (outermost) this.publishLayoutUpdates()
      } finally {
        this.scopeDepths.layout--
      }
    }
  }

  private publishLayoutUpdates(): void {
    const writes = this.layoutWrites
    this.layoutWrites = null
    if (!writes) return
    for (const [node, changes, edited] of writes.updates((nodeId) => this.nodes.get(nodeId))) {
      markSourceFieldsEdited(node, edited)
      this.emitter.emit('node:updated', node.id, changes)
    }
  }
  get isApplyingLayout(): boolean {
    return this.scopeDepths.layout > 0
  }
  updateNodePositionPreview(id: string, x: number, y: number): void {
    this.updateNodePreview(id, { x, y })
  }
  updateNodePreview(id: string, changes: Partial<SceneNode>): void {
    const node = this.nodes.get(id)
    if (node) changes = this.sizedChanges(node, changes)
    const appliedChanges = updateNodePreview(this, id, changes, (node, applied) => {
      for (const observe of this.previewObservers) observe(node, applied)
    })
    if (appliedChanges) this.emitter.emit('node:previewUpdated', id, appliedChanges)
  }

  /**
   * Writes fields as given. Edits detach the shared styles whose fields they change before
   * they get here (`styleDetachmentChanges`); resolving bindings or loading a file does not.
   */
  updateNode(id: string, changes: Partial<SceneNode>): void {
    if (this.scopeDepths.preview > 0) {
      this.updateNodePreview(id, changes)
      return
    }

    const node = this.nodes.get(id)
    if (!node) return
    this.applyNodeChanges(node, this.sizedChanges(node, omitBy(changes, isUndefined)))
  }

  /** A size set from outside layout, with what it also sets on a generated frame. */
  private sizedChanges(node: SceneNode, changes: Partial<SceneNode>): Partial<SceneNode> {
    return this.isApplyingLayout ? changes : withGeneratedFrameSize(node, changes)
  }

  /** Replay captured properties without dropping explicit undefined values or absent keys. */
  restoreNodeProperties(
    id: string,
    changes: Partial<SceneNode>,
    absent: readonly (keyof SceneNode)[]
  ): void {
    const node = this.nodes.get(id)
    if (node) this.applyNodeChanges(node, changes, absent)
  }

  private applyNodeChanges(
    node: SceneNode,
    changes: Partial<SceneNode>,
    absent: readonly (keyof SceneNode)[] = []
  ): void {
    const { id } = node
    this.willChangeNode(node)
    // Include removed keys in cache invalidation and update notifications.
    if (absent.length) {
      changes = { ...changes }
      for (const key of absent) Reflect.set(changes, key, undefined)
    }

    // Only clear absPosCache when layout-affecting properties change.
    // Fills, strokes, effects, plugin data changes do NOT affect absolute position.
    const affectsLayout = Object.keys(changes).some((k) => LAYOUT_AFFECTING_KEYS.has(k))
    if (affectsLayout) this.absPosCache.clear()
    if (
      node.type === 'INSTANCE' &&
      'componentId' in changes &&
      changes.componentId !== node.componentId
    ) {
      if (node.componentId) this.unindexInstance(node.componentId, id)
      if (changes.componentId) this.indexInstance(changes.componentId, id)
    }
    if (node.type === 'TEXT') invalidateTextCaches(node, changes)
    if (this.scopeDepths.sourceMetadata === 0 && !this.isApplyingLayout) {
      markSourceFieldsEdited(node, Object.keys(changes))
    }
    if (changes.vectorNetwork) {
      changes = { ...changes, vectorNetwork: normalizeVectorNetwork(changes.vectorNetwork) }
    }
    this.layoutWrites?.record(
      node,
      changes,
      this.scopeDepths.sourceMetadata === 0 && !this.isApplyingDerivedLayout
    )
    Object.assign(node, changes)
    if (changes.fills) removeStaleBindings(node, 'fills', changes)
    if (changes.strokes) removeStaleBindings(node, 'strokes', changes)
    for (const key of absent) Reflect.deleteProperty(node, key)
    this.publishNodeUpdate(id, changes)
  }

  /** Publishes an update now, or leaves it to the running layout, which publishes once it ends. */
  private publishNodeUpdate(id: string, changes: Partial<SceneNode>): void {
    if (!this.layoutWrites) this.emitter.emit('node:updated', id, changes)
  }

  reparentNode(nodeId: string, newParentId: string): void {
    const node = this.nodes.get(nodeId)
    if (!node || nodeId === this.rootId) return
    if (this.isDescendant(newParentId, nodeId)) return

    const oldParent = node.parentId ? this.nodes.get(node.parentId) : undefined
    const newParent = this.nodes.get(newParentId)
    if (!newParent) return
    if (node.parentId === newParentId) return

    const oldParentId = node.parentId
    this.willChangeNode(node)
    this.willChangeNode(oldParent)
    this.willChangeNode(newParent)
    this.absPosCache.clear()

    const oldParentWorld = getParentWorldMatrix(oldParent, this)
    const newParentWorld = getParentWorldMatrix(newParent, this)

    if (oldParent) {
      oldParent.childIds = oldParent.childIds.filter((cid) => cid !== nodeId)
    }

    node.parentId = newParentId
    newParent.childIds.push(nodeId)

    if (isTranslationOnly(oldParentWorld) && isTranslationOnly(newParentWorld)) {
      node.x += oldParentWorld[2] - newParentWorld[2]
      node.y += oldParentWorld[5] - newParentWorld[5]
    } else {
      const world = Matrix.multiply(oldParentWorld, getNodeLocalMatrix(node))
      const local = localTransformFromWorld(node, world, newParentWorld)
      if (local) Object.assign(node, local)
    }

    this.emitter.emit('node:reparented', nodeId, oldParentId, newParentId)
  }

  /**
   * Moves a node to `index` among `parentId`'s children, from wherever it was, without changing
   * its own coordinates. An index past the end appends; a move into the node itself or one of
   * its descendants is ignored.
   */
  insertChildAt(childId: string, parentId: string, index: number): void {
    const node = this.nodes.get(childId)
    const newParent = this.nodes.get(parentId)
    if (!node || !newParent || this.isDescendant(parentId, childId)) return
    const previousParentId = node.parentId
    const oldParent = previousParentId ? this.nodes.get(previousParentId) : undefined
    this.willChangeNode(node)
    this.willChangeNode(oldParent)
    this.willChangeNode(newParent)
    if (oldParent) {
      oldParent.childIds = oldParent.childIds.filter((id) => id !== childId)
    }
    newParent.childIds = newParent.childIds.filter((id) => id !== childId)
    const at = Math.min(index, newParent.childIds.length)
    newParent.childIds.splice(at, 0, childId)
    node.parentId = parentId
    this.absPosCache.clear()
    this.emitter.emit('node:reordered', childId, parentId, at, previousParentId)
  }

  deleteNode(id: string): void {
    const node = this.nodes.get(id)
    if (!node || id === this.rootId) return
    this.willChangeNode(node)

    if (node.parentId) {
      const parent = this.nodes.get(node.parentId)
      this.willChangeNode(parent)
      if (parent) {
        parent.childIds = parent.childIds.filter((cid) => cid !== id)
      }
    }

    for (const childId of Array.from(node.childIds)) {
      this.deleteNode(childId)
    }

    if (node.type === 'INSTANCE' && node.componentId) this.unindexInstance(node.componentId, id)
    this.connectorIds.delete(id)
    this.nodes.delete(id)
    this.emitter.emit('node:deleted', id, node.parentId)
  }

  hitTest(px: number, py: number, scopeId?: string): SceneNode | null {
    return HitTest.hitTest(this, px, py, scopeId)
  }

  /** `pad`, in canvas units, grows each shape's box, as Figma takes clicks just outside one. */
  hitTestDeep(px: number, py: number, scopeId?: string, pad = 0): SceneNode | null {
    return HitTest.hitTestDeep(this, px, py, scopeId, pad)
  }

  hitTestSelectable(
    px: number,
    py: number,
    scopeId: string,
    selectedIds: ReadonlySet<string>,
    pad = 0
  ): SceneNode | null {
    return HitTest.hitTestSelectable(this, px, py, scopeId, selectedIds, pad)
  }

  hitTestOpenContainer(px: number, py: number, scopeId: string): SceneNode | null {
    return HitTest.hitTestOpenContainer(this, px, py, scopeId)
  }

  isOpenContainer(nodeId: string): boolean {
    return HitTest.isOpenContainer(this, nodeId)
  }

  isPointInNode(nodeId: string, px: number, py: number): boolean {
    return HitTest.isPointInNode(this, nodeId, px, py)
  }

  hitTestDropTarget(
    px: number,
    py: number,
    excludeIds: ReadonlySet<string>,
    scopeId?: string,
    options?: HitTest.DropTargetOptions
  ): SceneNode | null {
    return HitTest.hitTestDropTarget(this, px, py, excludeIds, scopeId, options)
  }

  cloneTree(
    sourceId: string,
    parentId: string,
    overrides: Partial<SceneNode> = {}
  ): SceneNode | null {
    const src = this.nodes.get(sourceId)
    if (!src) return null

    const props = cloneNodeProps(src, null)
    // Null out Figma source identifiers so the clone is treated as local.
    if (props.source) props.source = { ...props.source, id: null, orderKey: null }
    // A copy is a new design nobody has reviewed: Figma's duplicate and clone() drop the status.
    props.status = null
    const clone = this.createNode(src.type, parentId, { ...props, ...overrides })
    if (src.status) markSourceFieldsEdited(clone, ['status'])

    for (const childId of src.childIds) {
      this.cloneTree(childId, clone.id)
    }

    return clone
  }

  createInstance(
    componentId: string,
    parentId: string,
    overrides: Partial<SceneNode> = {}
  ): SceneNode | null {
    return Instances.createInstance(this, componentId, parentId, overrides)
  }

  populateInstanceChildren(
    instanceId: string,
    componentId: string,
    mode: NodeCloneMode = 'deep'
  ): void {
    Instances.populateInstanceChildren(this, instanceId, componentId, mode)
  }

  swapInstanceComponent(
    instanceId: string,
    componentId: string,
    options?: Instances.SwapInstanceOptions
  ): void {
    Instances.swapInstanceComponent(this, instanceId, componentId, options)
  }

  syncInstances(componentId: string): void {
    Instances.syncInstances(this, componentId)
  }

  syncInstancesTogether(componentIds: Iterable<string>): void {
    Instances.syncInstancesTogether(this, componentIds)
  }

  syncInstance(instanceId: string): void {
    Instances.syncInstance(this, instanceId)
  }

  detachInstance(instanceId: string): void {
    Instances.detachInstance(this, instanceId)
  }

  getMainComponent(instanceId: string): SceneNode | undefined {
    return Instances.getMainComponent(this, instanceId)
  }

  getInstances(componentId: string): SceneNode[] {
    return Instances.getInstances(this, componentId)
  }

  flattenTree(parentId?: string, depth = 0): Array<{ node: SceneNode; depth: number }> {
    const id = parentId ?? this.rootId
    const parent = this.nodes.get(id)
    if (!parent) return []
    const result: Array<{ node: SceneNode; depth: number }> = []
    for (const childId of parent.childIds) {
      const child = this.nodes.get(childId)
      if (!child) continue
      result.push({ node: child, depth })
      if (child.childIds.length > 0) result.push(...this.flattenTree(childId, depth + 1))
    }
    return result
  }
}
