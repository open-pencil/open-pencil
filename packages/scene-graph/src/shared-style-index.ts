import type { SceneNode, SharedStyleType } from './types'

type NodeMap = ReadonlyMap<string, SceneNode>

const INDEX_KEYS: ReadonlySet<string> = new Set(['source', 'sharedStyleType'])

function restyles(changes: Partial<SceneNode>): boolean {
  for (const key of INDEX_KEYS) {
    if (key in changes) {
      return true
    }
  }
  return false
}

function styleKey(node: SceneNode): string | null {
  return node.sharedStyleType ? node.source.id : null
}

export class SharedStyleIndex {
  private readonly nodeIdsByStyleId = new Map<string, Set<string>>()
  private indexed: NodeMap | null = null

  constructor(private readonly nodes: () => NodeMap) {}

  styleNode(styleId: string, type: SharedStyleType): SceneNode | undefined {
    const nodes = this.current()
    for (const id of this.nodeIdsByStyleId.get(styleId) ?? []) {
      const node = nodes.get(id)
      if (node?.sharedStyleType === type && node.source.id === styleId) {
        return node
      }
    }
    return undefined
  }

  added(node: SceneNode): void {
    if (this.indexed) {
      this.add(node)
    }
  }

  removed(node: SceneNode): void {
    if (this.indexed) {
      this.remove(node)
    }
  }

  willChange(node: SceneNode, changes: Partial<SceneNode>): boolean {
    const restyled = restyles(changes)
    if (restyled) {
      this.removed(node)
    }
    return restyled
  }

  didChange(node: SceneNode, restyled: boolean): void {
    if (restyled) {
      this.added(node)
    }
  }

  invalidate(): void {
    this.indexed = null
  }

  private current(): NodeMap {
    const nodes = this.nodes()
    if (this.indexed !== nodes) {
      this.nodeIdsByStyleId.clear()
      for (const node of nodes.values()) {
        this.add(node)
      }
      this.indexed = nodes
    }
    return nodes
  }

  private add(node: SceneNode): void {
    const key = styleKey(node)
    if (!key) {
      return
    }
    let ids = this.nodeIdsByStyleId.get(key)
    if (!ids) {
      ids = new Set()
      this.nodeIdsByStyleId.set(key, ids)
    }
    ids.add(node.id)
  }

  private remove(node: SceneNode): void {
    const key = styleKey(node)
    const ids = key ? this.nodeIdsByStyleId.get(key) : undefined
    if (!key || !ids) {
      return
    }
    ids.delete(node.id)
    if (ids.size === 0) {
      this.nodeIdsByStyleId.delete(key)
    }
  }
}
