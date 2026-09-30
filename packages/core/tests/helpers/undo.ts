import { UndoManager } from '@open-pencil/scene-graph'

export function noop(): void {}

export function createUndoManager(options?: ConstructorParameters<typeof UndoManager>[0]) {
  return new UndoManager(options)
}

export function undoEntry(label: string, forward: () => void = noop, inverse: () => void = noop) {
  return { label, forward, inverse }
}
