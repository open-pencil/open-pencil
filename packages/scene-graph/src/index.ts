/* eslint-disable max-lines -- SceneGraph exposes a stable facade over domain modules */
export * from './mutation-impact'
export * from './variables/bindings'
export type { VariableModeFallback } from './variables'
export { modesDefaultFirst } from './variables'
export * from './variables/token'
export * from './plugin-data/field'
export * from './plugin-data/fields'
export { rescaleNodeTree, scaleNodeChanges } from './scaling'
import { TRANSFORM_FIELDS, SIZE_FIELDS } from './fields/geometry'
export { TRANSFORM_FIELDS, SIZE_FIELDS } from './fields/geometry'
export { TEXT_METRIC_FIELDS, TEXT_SHAPING_FIELDS, TEXT_LAYOUT_FIELDS } from './fields/text'
export * from './transfer'
export * from './instance-overrides'
export * from './images'
export * from './components/properties'
export * from './slots/frames'
export { instanceMainComponent } from './instances/main-component'
export { canCreateInstance } from './instances/cycles'
export {
  exposableInstances,
  exposedInstances,
  instanceExposureIssue,
  type InstanceExposureIssue
} from './components/exposure'
export * from './slots/content'
export * from './slots/authoring'
export * from './slots/limits'
export * from './behaviours/kinds'
export * from './icons/schema'
export * from './icons/model'
export * from './icons/glyph'
export * from './behaviours/layers'
export * from './behaviours/model'
export * from './behaviours/spec'
export * from './copy'
export {
  createDefaultNode,
  defaultStrokeAlign,
  FITTED_CONTAINER_TYPES,
  newStrokeGeometry
} from './node-defaults'
export {
  copyInstanceComponentProps,
  findInstanceAncestor,
  hasInstanceOverride,
  INSTANCE_SYNC_FIELDS,
  INSTANCE_SYNC_PROPS,
  INSTANCE_SYNC_TEXT_PROPS,
  recordInstanceOverride
} from './instances'
export {
  clearInstanceOverrides,
  cloneInstanceOverrideState,
  forEachInstanceOverride,
  getInstanceOverride,
  setInstanceOverride,
  type InstanceOverrideState
} from './instance-overrides'
export * from './snap'
export * from './export-format'
export * from './export-scale'
export * from './coordinate'
export * from './layout'
export * from './group-bounds'
export * from './constants'
export * from './geometry'
export * from './guides'
export * from './font-style'
export * from './shared-styles'
export { default as TransformMatrix } from './matrix'
export type { Mat3 } from './matrix'
export { UndoManager, type UndoEntry, type UndoManagerOptions } from './undo'

import { removeStaleBindings } from './bindings'
export { CommittedGraphEventError } from './buffered-events'
import { BufferedSceneEmitter } from './buffered-events'
import { cloneNodeProps } from './copy'
import { bindNodeEvents } from './events'
import * as HitTest from './hit-test'
export type { DropTargetOptions } from './hit-test'
import * as Instances from './instances'
import Matrix, { type Mat3 } from './matrix'
import { CONTAINER_TYPES, createDefaultNode } from './node-defaults'
import { updateNodePreview, type NodePreviewObserver } from './preview'
import { styleDetachmentChanges } from './shared-styles'
import { markSourceFieldsEdited } from './source-metadata'
import { GLYPH_AFFECTING_KEYS, invalidateTextCaches, TEXT_PICTURE_KEYS } from './text-picture'
import * as Variables from './variables'
import type { VariableModeFallback } from './variables'
import { normalizeVectorNetwork } from './vector-network'

export type { GUID, Color, Size, Vector } from './primitives'
export * from './types'

import {
  getAbsolutePosition,
  getNodeLocalMatrix,
  getParentWorldMatrix,
  isTranslationOnly,
  localTransformFromWorld
} from './coordinate'
import type { Color, Rect, Vector } from './primitives'
import type {
  DocumentColorSpace,
  EnabledLibraryBinding,
  NodeType,
  SceneGraphEventHandlers,
  SceneNode,
  SourceMetadata,
  Variable,
  VariableCollection,
  VariableType,
  VariableValue
} from './types'

export {
  cloneVectorNetwork,
  mergeVectorNetworks,
  normalizeVectorNetwork,
  transformVectorNetwork,
  validateVectorNetwork,
  vectorNetworksEqual
} from './vector-network'

/** Figma reads both parts of a GUID as signed 32-bit integers and drops records beyond them. */
const MAX_ID_SESSION = 0x7fffffff

let idSession = 0
let nextLocalID = 1

/**
 * Sets the session part of the IDs this process mints, as in Figma's `sessionID:localID` GUIDs.
 * Headless tools keep session 0, so a file's layers get the same IDs on every run. The editor
 * picks a random session at startup, as Yjs picks each document's `clientID`, so peers editing
 * one shared room never mint the same ID. Call it before creating any graph.
 */
export function setIdSession(sessionId: number): void {
  if (!Number.isInteger(sessionId) || sessionId < 0 || sessionId > MAX_ID_SESSION) {
    throw new RangeError('sessionId must be a non-negative 31-bit integer')
  }
  idSession = sessionId
}

export function generateId(): string {
  return `${idSession}:${nextLocalID++}`
}

function stripUndefinedProps<T extends object>(obj: T): T {
  const result = {} as T
  for (const key of Object.keys(obj) as (keyof T)[]) {
    const val = obj[key]
    if (val !== undefined) {
      result[key] = val
    }
  }
  return result
}

export { captureGraphCheckpoint } from './checkpoint'

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
  enabledLibraries = new Map<string, EnabledLibraryBinding>()
  readonly emitter = new BufferedSceneEmitter()
  private absPosCache = new Map<string, Vector>()
  private previewMutationDepth = 0
  private previewObservers: NodePreviewObserver[] = []
  private sourceMetadataPreservationDepth = 0
  private importedStateApplicationDepth = 0
  private layoutMutationDepth = 0
  private derivedLayoutDepth = 0
  positionPreviewVersion = 0
  instanceIndex = new Map<string, Set<string>>()

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
  ): VariableValue | undefined {
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
  ): VariableValue | undefined {
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
      const id = this.idGenerator()
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
  private isEntityIdTaken(id: string): boolean {
    if (this.nodes.has(id) || this.variables.has(id) || this.variableCollections.has(id))
      return true
    // Callers replace collection maps and edit `modes` in place (history snapshots, transfer,
    // undo), so an index of mode IDs would go stale; walk them without allocating instead.
    for (const collection of this.variableCollections.values()) {
      for (const mode of collection.modes) if (mode.modeId === id) return true
    }
    return false
  }
  private registerNode(node: SceneNode, parentId: string | null): SceneNode {
    node.parentId = parentId
    this.nodes.set(node.id, node)
    if (node.type === 'INSTANCE' && node.componentId) {
      let set = this.instanceIndex.get(node.componentId)
      if (!set) {
        set = new Set()
        this.instanceIndex.set(node.componentId, set)
      }
      set.add(node.id)
    }
    this.emitter.emit('node:created', node)
    return node
  }
  /** Publish synchronous graph events only after the supplied mutation succeeds. */
  withBufferedEvents<T>(action: () => T): T {
    return this.emitter.batch(action)
  }

  createNode(type: NodeType, parentId: string, overrides: Partial<SceneNode> = {}): SceneNode {
    const node = createDefaultNode(() => this.generateEntityId(), type, overrides)
    this.nodes.get(parentId)?.childIds.push(node.id)
    return this.registerNode(node, parentId)
  }
  createNodeWithId(
    id: string,
    type: NodeType,
    parentId: string | null,
    overrides: Partial<SceneNode> = {}
  ): SceneNode {
    const node = createDefaultNode(() => id, type, overrides)
    node.id = id
    const parent = parentId ? this.nodes.get(parentId) : undefined
    if (parent && !parent.childIds.includes(id)) parent.childIds.push(id)
    return this.registerNode(node, parentId)
  }

  static TEXT_PICTURE_KEYS: ReadonlySet<string> = TEXT_PICTURE_KEYS
  static GLYPH_AFFECTING_KEYS: ReadonlySet<string> = GLYPH_AFFECTING_KEYS

  static LAYOUT_AFFECTING_KEYS: ReadonlySet<string> = new Set([
    ...TRANSFORM_FIELDS,
    ...SIZE_FIELDS,
    'layoutMode',
    'layoutDirection',
    'itemSpacing',
    'counterAxisSpacing',
    'paddingLeft',
    'paddingRight',
    'paddingTop',
    'paddingBottom',
    'primaryAxisAlign',
    'counterAxisAlign',
    'counterAxisAlignContent',
    'layoutWrap',
    'primaryAxisSizing',
    'counterAxisSizing',
    'layoutPositioning',
    'layoutGrow',
    'layoutAlignSelf',
    'strokesIncludedInLayout',
    'horizontalConstraint',
    'verticalConstraint',
    'gridTemplateColumns',
    'gridTemplateRows',
    'gridColumnGap',
    'gridRowGap',
    'gridPosition',
    'minWidth',
    'maxWidth',
    'minHeight',
    'maxHeight'
  ])

  runPreviewUpdates(fn: () => void, beforeUpdate?: NodePreviewObserver): void {
    this.previewMutationDepth++
    if (beforeUpdate) this.previewObservers.push(beforeUpdate)
    try {
      fn()
    } finally {
      if (beforeUpdate) this.previewObservers.pop()
      this.previewMutationDepth--
    }
  }
  preserveSourceMetadataDuring(fn: () => void): void {
    this.sourceMetadataPreservationDepth++
    try {
      fn()
    } finally {
      this.sourceMetadataPreservationDepth--
    }
  }
  get isPreservingSourceMetadata(): boolean {
    return this.sourceMetadataPreservationDepth > 0
  }

  applyImportedStateDuring(fn: () => void): void {
    this.importedStateApplicationDepth++
    try {
      this.preserveSourceMetadataDuring(fn)
    } finally {
      this.importedStateApplicationDepth--
    }
  }

  get isApplyingImportedState(): boolean {
    return this.importedStateApplicationDepth > 0
  }

  /**
   * Lays out what the document already holds: a page as it loads, or again once its fonts
   * arrive. What this writes derives from the document; an edit's own layout is not this.
   */
  applyDerivedLayoutDuring(fn: () => void): void {
    this.derivedLayoutDepth++
    try {
      fn()
    } finally {
      this.derivedLayoutDepth--
    }
  }

  get isApplyingDerivedLayout(): boolean {
    return this.derivedLayoutDepth > 0
  }

  withLayoutMutations(fn: () => void): void {
    this.layoutMutationDepth++
    try {
      fn()
    } finally {
      this.layoutMutationDepth--
    }
  }
  get isApplyingLayout(): boolean {
    return this.layoutMutationDepth > 0
  }
  updateNodePositionPreview(id: string, x: number, y: number): void {
    this.updateNodePreview(id, { x, y })
  }
  updateNodePreview(id: string, changes: Partial<SceneNode>): void {
    const appliedChanges = updateNodePreview(this, id, changes, (node, applied) => {
      for (const observe of this.previewObservers) observe(node, applied)
    })
    if (appliedChanges) this.emitter.emit('node:previewUpdated', id, appliedChanges)
  }

  updateNode(id: string, changes: Partial<SceneNode>): void {
    if (this.previewMutationDepth > 0) {
      this.updateNodePreview(id, changes)
      return
    }

    const node = this.nodes.get(id)
    if (!node) return
    changes = stripUndefinedProps(styleDetachmentChanges(node, stripUndefinedProps(changes)))
    this.applyNodeChanges(node, changes)
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
    // Include removed keys in cache invalidation and update notifications.
    if (absent.length) {
      changes = { ...changes }
      for (const key of absent) Reflect.set(changes, key, undefined)
    }

    // Only clear absPosCache when layout-affecting properties change.
    // Fills, strokes, effects, plugin data changes do NOT affect absolute position.
    const affectsLayout = Object.keys(changes).some((k) => SceneGraph.LAYOUT_AFFECTING_KEYS.has(k))
    if (affectsLayout) this.absPosCache.clear()
    if (
      node.type === 'INSTANCE' &&
      'componentId' in changes &&
      changes.componentId !== node.componentId
    ) {
      if (node.componentId) this.instanceIndex.get(node.componentId)?.delete(id)
      if (changes.componentId) {
        let set = this.instanceIndex.get(changes.componentId)
        if (!set) {
          set = new Set()
          this.instanceIndex.set(changes.componentId, set)
        }
        set.add(id)
      }
    }
    if (node.type === 'TEXT') invalidateTextCaches(node, changes)
    if (this.sourceMetadataPreservationDepth === 0 && !this.isApplyingLayout) {
      markSourceFieldsEdited(node, Object.keys(changes))
    }
    if (changes.vectorNetwork) {
      changes = { ...changes, vectorNetwork: normalizeVectorNetwork(changes.vectorNetwork) }
    }
    Object.assign(node, changes)
    if (changes.fills) removeStaleBindings(node, 'fills', changes)
    if (changes.strokes) removeStaleBindings(node, 'strokes', changes)
    for (const key of absent) Reflect.deleteProperty(node, key)
    this.emitter.emit('node:updated', id, changes)
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
    this.absPosCache.clear()

    const oldParentWorld = this.parentWorldMatrix(oldParent)
    const newParentWorld = this.parentWorldMatrix(newParent)

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

  private parentWorldMatrix(parent: SceneNode | undefined): Mat3 {
    return getParentWorldMatrix(parent, this)
  }

  reorderChild(nodeId: string, parentId: string, insertIndex: number): void {
    const node = this.nodes.get(nodeId)
    if (!node) return

    const previousParentId = node.parentId
    const oldParent = previousParentId ? this.nodes.get(previousParentId) : undefined
    const newParent = this.nodes.get(parentId)
    if (!newParent || this.isDescendant(parentId, nodeId)) return

    // Remove from old parent
    if (oldParent) {
      oldParent.childIds = oldParent.childIds.filter((cid) => cid !== nodeId)
    }

    // If same parent, adjust index since we removed the item
    let idx = insertIndex
    if (
      oldParent === newParent &&
      idx > (!oldParent.childIds.includes(nodeId) ? idx : oldParent.childIds.length)
    ) {
      // Already removed above, no adjustment needed
    }

    node.parentId = parentId
    this.absPosCache.clear()
    idx = Math.min(idx, newParent.childIds.length)
    newParent.childIds.splice(idx, 0, nodeId)

    this.emitter.emit('node:reordered', nodeId, parentId, idx, previousParentId)
  }

  insertChildAt(childId: string, parentId: string, index: number): void {
    const node = this.getNode(childId)
    const newParent = this.getNode(parentId)
    if (!node || !newParent || childId === parentId || this.isDescendant(parentId, childId)) return
    const previousParentId = node.parentId
    const oldParent = previousParentId ? this.getNode(previousParentId) : undefined
    if (oldParent) {
      oldParent.childIds = oldParent.childIds.filter((id) => id !== childId)
    }
    newParent.childIds = newParent.childIds.filter((id) => id !== childId)
    newParent.childIds.splice(index, 0, childId)
    node.parentId = parentId
    this.clearAbsPosCache()
    this.emitter.emit('node:reordered', childId, parentId, index, previousParentId)
  }

  deleteNode(id: string): void {
    const node = this.nodes.get(id)
    if (!node || id === this.rootId) return

    if (node.parentId) {
      const parent = this.nodes.get(node.parentId)
      if (parent) {
        parent.childIds = parent.childIds.filter((cid) => cid !== id)
      }
    }

    for (const childId of Array.from(node.childIds)) {
      this.deleteNode(childId)
    }

    if (node.type === 'INSTANCE' && node.componentId) {
      this.instanceIndex.get(node.componentId)?.delete(id)
    }
    this.nodes.delete(id)
    this.emitter.emit('node:deleted', id, node.parentId)
  }

  hitTest(px: number, py: number, scopeId?: string): SceneNode | null {
    return HitTest.hitTest(this, px, py, scopeId)
  }

  hitTestDeep(px: number, py: number, scopeId?: string): SceneNode | null {
    return HitTest.hitTestDeep(this, px, py, scopeId)
  }

  hitTestSelectable(
    px: number,
    py: number,
    scopeId: string,
    selectedIds: ReadonlySet<string>
  ): SceneNode | null {
    return HitTest.hitTestSelectable(this, px, py, scopeId, selectedIds)
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
    // `as SourceMetadata` required: cloneNodeProps returns Partial<SceneNode>,
    // so props.source is SourceMetadata | undefined, but we know it's always set.
    props.source = { ...(props.source as SourceMetadata), id: null, orderKey: null }
    const clone = this.createNode(src.type, parentId, { ...props, ...overrides })

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
    mode: Instances.NodeCloneMode = 'deep'
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
