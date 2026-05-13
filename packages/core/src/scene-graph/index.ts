export * from './snap'
export { UndoManager, type UndoEntry, type UndoManagerOptions } from './undo'

import { createNanoEvents } from 'nanoevents'

import * as HitTest from './hit-test'
import * as Instances from './instances'
import { CONTAINER_TYPES, createDefaultNode } from './node-defaults'
import { updateNodePreview } from './preview'
import * as Variables from './variables'
import { normalizeVectorNetwork } from './vector-network'

export type { GUID, Color } from '#core/types'
export * from './types'

import type { Emitter } from 'nanoevents'

import { getAbsolutePosition } from '#core/canvas/coordinate'
import type { Color, Rect, Vector } from '#core/types'

import type {
  DocumentColorSpace,
  NodeType,
  SceneGraphEventHandlers,
  SceneGraphEvents,
  SceneNode,
  Variable,
  VariableCollection,
  VariableType,
  VariableValue
} from './types'

export { cloneVectorNetwork, normalizeVectorNetwork, validateVectorNetwork } from './vector-network'

let nextLocalID = 1

export function generateId(): string {
  return `0:${nextLocalID++}`
}

export class SceneGraph {
  nodes = new Map<string, SceneNode>()
  images = new Map<string, Uint8Array>()
  variables = new Map<string, Variable>()
  variableCollections = new Map<string, VariableCollection>()
  activeMode = new Map<string, string>()
  rootId: string
  figKiwiVersion: number | null = null
  documentColorSpace: DocumentColorSpace = 'display-p3'
  readonly emitter: Emitter<SceneGraphEvents> = createNanoEvents()
  private absPosCache = new Map<string, Vector>()
  private previewMutationDepth = 0
  positionPreviewVersion = 0
  instanceIndex = new Map<string, Set<string>>()

  constructor() {
    const root = createDefaultNode(generateId, 'FRAME', {
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
    const unbinds = [
      handlers.created ? this.emitter.on('node:created', handlers.created) : null,
      handlers.updated ? this.emitter.on('node:updated', handlers.updated) : null,
      handlers.deleted ? this.emitter.on('node:deleted', handlers.deleted) : null,
      handlers.reparented ? this.emitter.on('node:reparented', handlers.reparented) : null,
      handlers.reordered ? this.emitter.on('node:reordered', handlers.reordered) : null
    ].filter((unbind): unbind is () => void => !!unbind)

    return () => {
      for (const unbind of unbinds) unbind()
    }
  }

  /**
   * Count all descendants of a node (children, grandchildren, etc.).
   * Used for per-page node counts in the renderer to determine if a page
   * is "large" without counting nodes on other pages.
   */
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
        // Use a for-of loop instead of spread: stack.push(...ids) places every
        // element on the call stack as function arguments and crashes V8/JSC
        // with RangeError on nodes with >~125k direct children.
        for (const childId of child.childIds) {
          stack.push(childId)
        }
      }
    }
    return count
  }

  // --- Variables ---

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
    return Variables.createVariable(this, generateId, name, type, collectionId, value)
  }

  createCollection(name: string): VariableCollection {
    return Variables.createCollection(this, generateId, name)
  }

  removeCollection(id: string): void {
    Variables.removeCollection(this, id)
  }

  getActiveModeId(collectionId: string): string {
    return Variables.getActiveModeId(this, collectionId)
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
    let current = this.nodes.get(childId)
    while (current) {
      if (current.id === ancestorId) return true
      current = current.parentId ? this.nodes.get(current.parentId) : undefined
    }
    return false
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

  private generateNodeId(): string {
    let id = generateId()
    while (this.nodes.has(id)) id = generateId()
    return id
  }

  createNode(type: NodeType, parentId: string, overrides: Partial<SceneNode> = {}): SceneNode {
    const node = createDefaultNode(() => this.generateNodeId(), type, overrides)
    node.parentId = parentId
    this.nodes.set(node.id, node)

    const parent = this.nodes.get(parentId)
    if (parent) {
      parent.childIds.push(node.id)
    }

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

  /**
   * Properties that affect absolute position computation (getNodeLocalMatrix).
   * Changing any of these on a node invalidates the absPosCache for that node
   * and all its descendants. Other changes (fills, strokes, effects, plugin data)
   * do NOT affect absolute position and can skip the expensive cache clear.
   *
   * These names MUST match the actual SceneNode field names (not Figma API proxy names).
   */
  static LAYOUT_AFFECTING_KEYS: ReadonlySet<string> = new Set([
    'x',
    'y',
    'width',
    'height',
    'rotation',
    'flipX',
    'flipY',
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

  static TEXT_PICTURE_KEYS: ReadonlySet<string> = new Set([
    'text',
    'fontSize',
    'fontFamily',
    'fontWeight',
    'italic',
    'textAlignHorizontal',
    'textDirection',
    'textAlignVertical',
    'lineHeight',
    'letterSpacing',
    'textDecoration',
    'textCase',
    'styleRuns',
    'fills',
    'width',
    'height'
  ])

  runPreviewUpdates(fn: () => void): void {
    this.previewMutationDepth++
    try {
      fn()
    } finally {
      this.previewMutationDepth--
    }
  }
  updateNodePositionPreview(id: string, x: number, y: number): void {
    this.updateNodePreview(id, { x, y })
  }
  updateNodePreview(id: string, changes: Partial<SceneNode>): void {
    updateNodePreview(this, id, changes)
  }
  updateNode(id: string, changes: Partial<SceneNode>): void {
    if (this.previewMutationDepth > 0) {
      this.updateNodePreview(id, changes)
      return
    }

    const node = this.nodes.get(id)
    if (!node) return

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
    if (
      node.type === 'TEXT' &&
      node.textPicture &&
      Object.keys(changes).some((k) => SceneGraph.TEXT_PICTURE_KEYS.has(k))
    ) {
      node.textPicture = null
    }
    if (changes.vectorNetwork) {
      changes = { ...changes, vectorNetwork: normalizeVectorNetwork(changes.vectorNetwork) }
    }
    Object.assign(node, changes)
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

    // Convert absolute position
    const absPos = this.getAbsolutePosition(nodeId)
    const newParentNode = this.nodes.get(newParentId)
    const newParentAbs =
      newParentId === this.rootId || newParentNode?.type === 'CANVAS'
        ? { x: 0, y: 0 }
        : this.getAbsolutePosition(newParentId)

    // Remove from old parent
    if (oldParent) {
      oldParent.childIds = oldParent.childIds.filter((cid) => cid !== nodeId)
    }

    // Add to new parent
    node.parentId = newParentId
    newParent.childIds.push(nodeId)

    // Adjust position so node stays in same visual place
    node.x = absPos.x - newParentAbs.x
    node.y = absPos.y - newParentAbs.y

    this.emitter.emit('node:reparented', nodeId, oldParentId, newParentId)
  }

  reorderChild(nodeId: string, parentId: string, insertIndex: number): void {
    const node = this.nodes.get(nodeId)
    if (!node) return

    const oldParent = node.parentId ? this.nodes.get(node.parentId) : undefined
    const newParent = this.nodes.get(parentId)
    if (!newParent) return

    // Remove from old parent
    if (oldParent) {
      oldParent.childIds = oldParent.childIds.filter((cid) => cid !== nodeId)
    }

    // If same parent, adjust index since we removed the item
    let idx = insertIndex
    if (
      oldParent === newParent &&
      idx > (oldParent.childIds.indexOf(nodeId) === -1 ? idx : oldParent.childIds.length)
    ) {
      // Already removed above, no adjustment needed
    }

    node.parentId = parentId
    idx = Math.min(idx, newParent.childIds.length)
    newParent.childIds.splice(idx, 0, nodeId)

    this.emitter.emit('node:reordered', nodeId, parentId, idx)
  }

  insertChildAt(childId: string, parentId: string, index: number): void {
    const oldParent = this.getNode(this.getNode(childId)?.parentId ?? '')
    if (oldParent) {
      oldParent.childIds = oldParent.childIds.filter((id) => id !== childId)
    }
    const newParent = this.getNode(parentId)
    if (!newParent) return
    newParent.childIds = newParent.childIds.filter((id) => id !== childId)
    newParent.childIds.splice(index, 0, childId)
    const node = this.getNode(childId)
    if (node) node.parentId = parentId
    this.clearAbsPosCache()
    this.emitter.emit('node:reordered', childId, parentId, index)
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
    this.emitter.emit('node:deleted', id)
  }

  hitTest(px: number, py: number, scopeId?: string): SceneNode | null {
    return HitTest.hitTest(this, px, py, scopeId)
  }

  hitTestDeep(px: number, py: number, scopeId?: string): SceneNode | null {
    return HitTest.hitTestDeep(this, px, py, scopeId)
  }

  hitTestFrame(
    px: number,
    py: number,
    excludeIds: Set<string>,
    scopeId?: string
  ): SceneNode | null {
    return HitTest.hitTestFrame(this, px, py, excludeIds, scopeId)
  }

  cloneTree(
    sourceId: string,
    parentId: string,
    overrides: Partial<SceneNode> = {}
  ): SceneNode | null {
    const src = this.nodes.get(sourceId)
    if (!src) return null

    const { id: _srcId, parentId: _srcParent, childIds: _srcChildren, ...rest } = src
    const clone = this.createNode(src.type, parentId, { ...rest, ...overrides })

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

  populateInstanceChildren(instanceId: string, componentId: string): void {
    Instances.populateInstanceChildren(this, instanceId, componentId)
  }

  swapInstanceComponent(instanceId: string, componentId: string): void {
    Instances.swapInstanceComponent(this, instanceId, componentId)
  }

  syncInstances(componentId: string): void {
    Instances.syncInstances(this, componentId)
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
      if (child.childIds.length > 0) {
        result.push(...this.flattenTree(childId, depth + 1))
      }
    }
    return result
  }
}
