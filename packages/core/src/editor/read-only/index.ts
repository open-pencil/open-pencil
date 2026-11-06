import type { UndoManager } from '@open-pencil/scene-graph/undo'

import type { EditorContext, Tool } from '#core/editor/types'
import { offeredTool, type EditorRestrictions } from '#core/editor/views'

import { READ_ONLY_ACTIONS } from './actions'

/** Raised by an edit to a document that is open read-only, in Figma's words for its own. */
export class ReadOnlyDocumentError extends Error {
  constructor() {
    super("Can't edit the document in read-only mode")
    this.name = 'ReadOnlyDocumentError'
  }
}

/**
 * Returns the editor with every action that changes the document refused while `isReadOnly`
 * holds, as it does while the editor's profile offers no edits; the actions in `READ_ONLY_ACTIONS` and the editor's getters pass through.
 */
export function guardReadOnly<T extends object>(editor: T, isReadOnly: () => boolean): T {
  const descriptors = Object.getOwnPropertyDescriptors(editor)
  for (const [name, descriptor] of Object.entries(descriptors)) {
    const action: unknown = descriptor.value
    if (typeof action !== 'function' || READ_ONLY_ACTIONS.has(name)) continue
    descriptor.value = (...args: unknown[]): unknown => {
      if (isReadOnly()) throw new ReadOnlyDocumentError()
      return Reflect.apply(action, undefined, args)
    }
  }
  return Object.defineProperties({}, descriptors) as T
}

/**
 * Returns the editor's undo history with undo and redo refused while `isReadOnly` holds, since
 * they change the document; batches and reads pass through for the gestures that open them.
 */
export function guardUndo(undo: UndoManager, isReadOnly: () => boolean): UndoManager {
  return new Proxy(undo, {
    get(target, key) {
      const value: unknown = Reflect.get(target, key)
      if ((key === 'undo' || key === 'redo') && isReadOnly()) {
        return () => {
          throw new ReadOnlyDocumentError()
        }
      }
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
}

/** What the restrictions end when they take effect. */
export interface RestrictionEnds {
  /** Ends every edit in progress, as a read-only document has none. */
  endEdits: () => void
  /** Ends a pen path continuing an existing layer, which handles-only paths do not allow. */
  endPathContinuation: () => void
  /** Picks a tool as the toolbar does, committing a pen path in progress when it is not the pen. */
  pickTool: (tool: Tool) => void
}

export function createReadOnlyActions(
  ctx: EditorContext,
  { endEdits, endPathContinuation, pickTool }: RestrictionEnds
) {
  /**
   * Opens the document read-only or editable again. Going read-only ends what is being edited and
   * drops a tool that would edit, as Figma does on opening version history.
   */
  function setReadOnly(readOnly: boolean): void {
    if (ctx.state.hostRestrictions.readOnly === readOnly) return
    if (readOnly) endEdits()
    ctx.state.hostRestrictions = { ...ctx.state.hostRestrictions, readOnly }
    ctx.setActiveTool(offeredTool(ctx.state, ctx.state.activeTool))
    ctx.emitEditorEvent('document:read-only-changed', readOnly)
    ctx.requestRepaint()
  }

  /**
   * Narrows what the editor offers, as a host that is not a general design tool does: only some
   * tools, or path edits that move handles alone. Each restriction given replaces the one before;
   * one left out stays. A tool no longer on offer gives way to Move.
   */
  function setHostRestrictions(
    restrictions: Partial<Pick<EditorRestrictions, 'tools' | 'pathEdits'>>
  ): void {
    ctx.state.hostRestrictions = { ...ctx.state.hostRestrictions, ...restrictions }
    if (restrictions.pathEdits === 'handles') {
      // What was drawn stays; the path just stops growing, and regions stop taking the pointer.
      endPathContinuation()
      if (ctx.state.nodeEditState) ctx.state.nodeEditState.hoveredRegion = null
    }
    // A tool no longer offered gives way to Move as a picked tool does, so a pen path in
    // progress is committed rather than left pending.
    pickTool(offeredTool(ctx.state, ctx.state.activeTool))
    ctx.requestRepaint()
  }

  return { setReadOnly, setHostRestrictions }
}
