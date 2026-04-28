import { UndoManager } from '@open-pencil/core'

export function noop() {}

export function createUndoManager(options?: ConstructorParameters<typeof UndoManager>[0]) {
  return new UndoManager(options)
}

export function undoEntry(label: string, forward = noop, inverse = noop) {
  return { label, forward, inverse }
}
