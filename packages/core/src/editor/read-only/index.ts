import type { UndoEntry, UndoManager } from '@open-pencil/scene-graph/undo'

import type { EditorContext, Tool } from '#core/editor/types'
import {
  offeredTool,
  resolveEditorProfile,
  type EditorProfile,
  type EditorRestrictions
} from '#core/editor/views'

import { MOVE_ACTIONS, PATH_EDIT_ACTIONS, POSITION_ACTIONS, READ_ONLY_ACTIONS } from './actions'

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

/** Raised by a change other than a move while the host lets layers only move (`layerEdits: 'move'`). */
export class MoveOnlyLayersError extends RefusedEditError {
  constructor() {
    super("Can't change layers here; they can only be moved")
    this.name = 'MoveOnlyLayersError'
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  )
}

/** Whether an update changes nothing but where a layer is. */
function movesOnly(args: readonly unknown[]): boolean {
  const changes = args[1]
  return (
    typeof changes === 'object' &&
    changes !== null &&
    Object.keys(changes).every((key) => key === 'x' || key === 'y')
  )
}

/**
 * The error an action is refused with, or null when it may run: while the profile offers no
 * edits every action outside `READ_ONLY_ACTIONS` is refused; while it offers no layer edits so
 * is every one outside those and `PATH_EDIT_ACTIONS`; and while layers may only move, every one
 * outside those and `MOVE_ACTIONS`, with `POSITION_ACTIONS` let through for positions alone.
 */
export function refusalFor(
  action: string,
  profile: EditorProfile,
  args: readonly unknown[] = []
): RefusedEditError | null {
  if (READ_ONLY_ACTIONS.has(action)) return null
  if (!profile.edits) return new ReadOnlyDocumentError()
  if (profile.layerEdits === 'all') return null
  if (profile.layerEdits === 'none')
    return PATH_EDIT_ACTIONS.has(action) ? null : new FixedLayersError()
  if (MOVE_ACTIONS.has(action) || (POSITION_ACTIONS.has(action) && movesOnly(args))) return null
  return new MoveOnlyLayersError()
}

/** The error a change to layers is refused with, or null when the profile allows it. */
export function layerEditRefusal(profile: EditorProfile): RefusedEditError | null {
  if (!profile.edits) return new ReadOnlyDocumentError()
  if (profile.layerEdits === 'none') return new FixedLayersError()
  if (profile.layerEdits === 'move') return new MoveOnlyLayersError()
  return null
}

/**
 * Returns the editor with every action its restrictions refuse throwing the refusal (see
 * `refusalFor`); allowed actions and the editor's getters pass through.
 */
export function guardEdits<T extends object>(
  editor: T,
  refusal: (action: string, args: readonly unknown[]) => RefusedEditError | null
): T {
  const descriptors = Object.getOwnPropertyDescriptors(editor)
  for (const [name, descriptor] of Object.entries(descriptors)) {
    const action: unknown = descriptor.value
    if (typeof action !== 'function' || READ_ONLY_ACTIONS.has(name)) continue
    descriptor.value = (...args: unknown[]): unknown => {
      const refused = refusal(name, args)
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
  /** Records a step still being gathered, such as a run of nudges, as undo would first. */
  flushPendingStep: () => void
}

export function createReadOnlyActions(
  ctx: EditorContext,
  { endEdits, endLayerEdits, endPathContinuation, pickTool, flushPendingStep }: RestrictionEnds
) {
  /**
   * The newest undo and redo steps when layers became fixed. Stepping back to them would change
   * layers again, so undo and redo stop there, leaving only what was done since.
   */
  let fixedAt: Record<HistoryStep, UndoEntry | undefined> | null = null
  /** How deep the host's own edits run (`asHost`), which its restrictions don't narrow. */
  let hostDepth = 0
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
      restrictions.layerEdits !== undefined &&
      restrictions.layerEdits !== 'all' &&
      ctx.state.hostRestrictions.layerEdits === 'all'
    if (restrictions.layerEdits !== undefined && restrictions.layerEdits !== 'all') endLayerEdits()
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

  /**
   * Runs the host's own edit past its restrictions, which narrow what the person does on the
   * canvas, with keys, and in panels: a game whose pieces only move still combines them from its
   * own buttons. A read-only document still refuses it. The edit is undone like any other.
   * It runs synchronously: past an await the person's input could run unrestricted too, so a
   * callback that returns a promise throws, and its edits after the first await are refused.
   */
  function asHost<T>(run: () => T): T {
    hostDepth++
    let result: T
    try {
      result = run()
    } finally {
      hostDepth--
    }
    if (isThenable(result)) {
      throw new TypeError('asHost runs synchronous edits only; await outside it and call it again')
    }
    return result
  }

  /** The profile restrictions are judged by: the host's own edits run as if unrestricted. */
  function judgedProfile(): EditorProfile {
    const profile = resolveEditorProfile(ctx.state)
    return hostDepth > 0 && profile.edits ? { ...profile, layerEdits: 'all' } : profile
  }

  /**
   * Why undo or redo is refused: a read-only document, or a step from before the host restricted
   * layers, which would change them again.
   */
  function historyRefusal(step: HistoryStep): RefusedEditError | null {
    const profile = judgedProfile()
    if (!profile.edits) return new ReadOnlyDocumentError()
    if (profile.layerEdits === 'all' || !fixedAt) return null
    // A nudge the person just made is the step undo takes back, once it is recorded.
    flushPendingStep()
    const next = step === 'undo' ? ctx.undo.peekUndo() : ctx.undo.peekRedo()
    if (!next || next !== fixedAt[step]) return null
    return profile.layerEdits === 'move' ? new MoveOnlyLayersError() : new FixedLayersError()
  }

  /** Why an editor action is refused, if it is (`refusalFor`), undo and redo by their history. */
  function refusal(action: string, args: readonly unknown[] = []): RefusedEditError | null {
    if (action === 'undoAction') return historyRefusal('undo')
    if (action === 'redoAction') return historyRefusal('redo')
    return refusalFor(action, judgedProfile(), args)
  }

  return { actions: { setReadOnly, setHostRestrictions, asHost }, refusal, historyRefusal }
}
