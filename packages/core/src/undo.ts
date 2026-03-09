import type { SceneNode } from './scene-graph'

export interface UndoEntry {
  label: string
  forward: () => void
  inverse: () => void
}

export class UndoManager {
  private undoStack: UndoEntry[] = []
  private redoStack: UndoEntry[] = []
  private batchEntries: UndoEntry[] | null = null
  private batchLabel = ''

  apply(entry: UndoEntry): void {
    entry.forward()
    if (this.batchEntries) {
      this.batchEntries.push(entry)
    } else {
      this.undoStack.push(entry)
      this.redoStack = []
    }
  }

  push(entry: UndoEntry): void {
    if (this.batchEntries) {
      this.batchEntries.push(entry)
    } else {
      this.undoStack.push(entry)
      this.redoStack = []
    }
  }

  undo(): string | null {
    const entry = this.undoStack.pop()
    if (!entry) return null
    entry.inverse()
    this.redoStack.push(entry)
    return entry.label
  }

  redo(): string | null {
    const entry = this.redoStack.pop()
    if (!entry) return null
    entry.forward()
    this.undoStack.push(entry)
    return entry.label
  }

  beginBatch(label: string): void {
    this.batchLabel = label
    this.batchEntries = []
  }

  commitBatch(): void {
    if (!this.batchEntries || this.batchEntries.length === 0) {
      this.batchEntries = null
      return
    }
    const entries = this.batchEntries
    const label = this.batchLabel
    this.batchEntries = null

    this.undoStack.push({
      label,
      forward: () => entries.forEach((e) => e.forward()),
      inverse: () => [...entries].reverse().forEach((e) => e.inverse())
    })
    this.redoStack = []
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.batchEntries = null
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  get undoLabel(): string | null {
    return this.undoStack.at(-1)?.label ?? null
  }

  get redoLabel(): string | null {
    return this.redoStack.at(-1)?.label ?? null
  }
}

export function createPropertyChange(
  node: SceneNode,
  changes: Partial<SceneNode>,
  label: string
): UndoEntry {
  const previous = Object.fromEntries(
    (Object.keys(changes) as (keyof SceneNode)[]).map((key) => [key, node[key]])
  ) as Partial<SceneNode>

  return {
    label,
    forward: () => Object.assign(node, changes),
    inverse: () => Object.assign(node, previous)
  }
}
