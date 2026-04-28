export interface UndoEntry {
  label: string
  forward: () => void
  inverse: () => void
}

export interface UndoManagerOptions {
  limit?: number
}

interface UndoBatch {
  label: string
  entries: UndoEntry[]
}

const DEFAULT_HISTORY_LIMIT = 200

export class UndoManager {
  private undoStack: UndoEntry[] = []
  private redoStack: UndoEntry[] = []
  private batches: UndoBatch[] = []
  private readonly limit: number

  constructor(options: UndoManagerOptions = {}) {
    this.limit = options.limit ?? DEFAULT_HISTORY_LIMIT
  }

  apply(entry: UndoEntry): void {
    this.execute(entry)
  }

  execute(entry: UndoEntry): void {
    entry.forward()
    this.record(entry)
  }

  push(entry: UndoEntry): void {
    this.record(entry)
  }

  record(entry: UndoEntry): void {
    const batch = this.currentBatch
    if (batch) {
      batch.entries.push(entry)
      return
    }
    this.pushUndoEntry(entry)
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
    this.batches.push({ label, entries: [] })
  }

  commitBatch(): void {
    const batch = this.batches.pop()
    if (!batch || batch.entries.length === 0) return

    const entry = this.createBatchEntry(batch)
    const parentBatch = this.currentBatch
    if (parentBatch) parentBatch.entries.push(entry)
    else this.pushUndoEntry(entry)
  }

  runBatch<T>(label: string, fn: () => T): T {
    this.beginBatch(label)
    try {
      const result = fn()
      this.commitBatch()
      return result
    } catch (error) {
      this.rollbackBatch()
      throw error
    }
  }

  rollbackBatch(): void {
    const batch = this.batches.pop()
    if (!batch) return
    for (const entry of batch.entries.toReversed()) entry.inverse()
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.batches = []
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

  private get currentBatch(): UndoBatch | null {
    return this.batches.at(-1) ?? null
  }

  private createBatchEntry(batch: UndoBatch): UndoEntry {
    return {
      label: batch.label,
      forward: () => batch.entries.forEach((entry) => entry.forward()),
      inverse: () => batch.entries.toReversed().forEach((entry) => entry.inverse())
    }
  }

  private pushUndoEntry(entry: UndoEntry): void {
    this.undoStack.push(entry)
    this.redoStack = []
    this.trimUndoStack()
  }

  private trimUndoStack(): void {
    if (!Number.isFinite(this.limit) || this.limit <= 0) return
    const overflow = this.undoStack.length - this.limit
    if (overflow > 0) this.undoStack.splice(0, overflow)
  }
}
