import { UndoManager } from '@open-pencil/scene-graph'

/** An undo entry that records nothing, for tests that only care about the batching. */
export const noop = (): void => undefined

export function createUndoManager(options?: ConstructorParameters<typeof UndoManager>[0]) {
  return new UndoManager(options)
}

export function undoEntry(label: string, forward: () => void = noop, inverse: () => void = noop) {
  return { label, forward, inverse }
}
