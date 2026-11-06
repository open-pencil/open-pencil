import type { UndoEntry, UndoManager } from '@open-pencil/scene-graph/undo'

import type { EditorContext, Tool } from '#core/editor/types'
import {
  offeredTool,
  resolveEditorProfile,
  type EditorProfile,
  type EditorRestrictions
} from '#core/editor/views'

import { PATH_EDIT_ACTIONS, READ_ONLY_ACTIONS } from './actions'

/**
 * Raised by an edit the editor's restrictions refuse. Such an edit does nothing, as in Figma, so
 * a front end that runs edits from keys or panels can let it pass silently.
 */
export class RefusedEditError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RefusedEditError'
  }
}

/** Raised by an edit to a document that is open read-only, in Figma's words for its own. */
export class ReadOnlyDocumentError extends RefusedEditError {
  constructor() {
    super("Can't edit the document in read-only mode")
    this.name = 'ReadOnlyDocumentError'
  }
}

/** Raised by an edit to a layer while the host keeps layers as they are (`layerEdits: 'none'`). */
export class FixedLayersError extends RefusedEditError {
  constructor() {
    super("Can't change layers here; only paths can be reshaped")
    this.name = 'FixedLayersError'
  }
}

/**
 * The error an action is refused with, or null when it may run: while the profile offers no
 * edits every action outside `READ_ONLY_ACTIONS` is refused, and while it offers no layer edits
 * so is every one outside those and `PATH_EDIT_ACTIONS`.
 */
export function refusalFor(action: string, profile: EditorProfile): RefusedEditError | null {
  if (READ_ONLY_ACTIONS.has(action)) return null
  if (PATH_EDIT_ACTIONS.has(action)) return profile.edits ? null : new ReadOnlyDocumentError()
  return layerEditRefusal(profile)
}

/** The error a change to layers is refused with, or null when the profile allows it. */
export function layerEditRefusal(profile: EditorProfile): RefusedEditError | null {
  if (!profile.edits) return new ReadOnlyDocumentError()
  if (profile.layerEdits === 'none') return new FixedLayersError()
  return null
}

/**
 * Returns the editor with every action its restrictions refuse throwing the refusal (see
 * `refusalFor`); allowed actions and the editor's getters pass through.
 */
export function guardEdits<T extends object>(
  editor: T,
  refusal: (action: string) => RefusedEditError | null
): T {
  const descriptors = Object.getOwnPropertyDescriptors(editor)
  for (const [name, descriptor] of Object.entries(descriptors)) {
    const action: unknown = descriptor.value
    if (typeof action !== 'function' || READ_ONLY_ACTIONS.has(name)) continue
    descriptor.value = (...args: unknown[]): unknown => {
      const refused = refusal(name)
      if (refused) throw refused
      return Reflect.apply(action, undefined, args)
    }
  }
  return Object.defineProperties({}, descriptors) as T
}

type HistoryStep = 'undo' | 'redo'

/**
 * Returns the editor's undo history with undo and redo refused when `refusal` says so, since they
 * change the document; batches and reads pass through for the gestures that open them.
 */
export function guardUndo(
  undo: UndoManager,
  refusal: (step: HistoryStep) => RefusedEditError | null
): UndoManager {
  return new Proxy(undo, {
    get(target, key) {
      const value: unknown = Reflect.get(target, key)
      const refused = key === 'undo' || key === 'redo' ? refusal(key) : null
      if (refused) {
        return () => {
          throw refused
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
  /** Ends the edits in progress that change layers, such as a nudge or a text edit. */
  endLayerEdits: () => void
  /** Ends a pen path continuing an existing layer, which handles-only paths do not allow. */
  endPathContinuation: () => void
  /** Picks a tool as the toolbar does, committing a pen path in progress when it is not the pen. */
  pickTool: (tool: Tool) => void
}

export function createReadOnlyActions(
  ctx: EditorContext,
  { endEdits, endLayerEdits, endPathContinuation, pickTool }: RestrictionEnds
) {
  /**
   * The newest undo and redo steps when layers became fixed. Stepping back to them would change
   * layers again, so undo and redo stop there, leaving only what was done since.
   */
  let fixedAt: Record<HistoryStep, UndoEntry | undefined> | null = null
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
   * tools, path edits that move handles alone, or layers kept as they are. Each restriction given
   * replaces the one before; one left out stays. A tool no longer on offer gives way to Move.
   */
  function setHostRestrictions(
    restrictions: Partial<Pick<EditorRestrictions, 'tools' | 'pathEdits' | 'layerEdits'>>
  ): void {
    const fixing =
      restrictions.layerEdits === 'none' && ctx.state.hostRestrictions.layerEdits !== 'none'
    if (fixing) endLayerEdits()
    ctx.state.hostRestrictions = { ...ctx.state.hostRestrictions, ...restrictions }
    if (fixing) fixedAt = { undo: ctx.undo.peekUndo(), redo: ctx.undo.peekRedo() }
    if (restrictions.layerEdits === 'all') fixedAt = null
    if (restrictions.pathEdits === 'handles') {
      // What was drawn stays; the path just stops growing, and regions stop taking the pointer.
      endPathContinuation()
      if (ctx.state.nodeEditState) ctx.state.nodeEditState.hoveredRegion = null
    }
    // A tool no longer offered gives way to Move as a picked tool does, so a pen path in
    // progress is committed rather than left pending.
    pickTool(offeredTool(ctx.state, ctx.state.activeTool))
    ctx.emitEditorEvent('document:restrictions-changed')
    ctx.requestRepaint()
  }

  /** Why undo or redo is refused: a read-only document, or a step from before layers were fixed. */
  function historyRefusal(step: HistoryStep): RefusedEditError | null {
    const profile = resolveEditorProfile(ctx.state)
    if (!profile.edits) return new ReadOnlyDocumentError()
    if (profile.layerEdits === 'all' || !fixedAt) return null
    const next = step === 'undo' ? ctx.undo.peekUndo() : ctx.undo.peekRedo()
    return next && next === fixedAt[step] ? new FixedLayersError() : null
  }

  /** Why an editor action is refused, if it is (`refusalFor`), undo and redo by their history. */
  function refusal(action: string): RefusedEditError | null {
    if (action === 'undoAction') return historyRefusal('undo')
    if (action === 'redoAction') return historyRefusal('redo')
    return refusalFor(action, resolveEditorProfile(ctx.state))
  }

  return { actions: { setReadOnly, setHostRestrictions }, refusal, historyRefusal }
}
