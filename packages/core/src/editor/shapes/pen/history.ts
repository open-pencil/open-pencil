import type { EditorContext, EditorState } from '#core/editor/types'

type PenSnapshot = EditorState['penState']

/**
 * Pen points as undo steps, as in Figma: each press, with the drag that shapes its handles, is one
 * step, and ending the path is one more, so undo after it draws on from the last point again.
 */
export interface PenHistory {
  /**
   * Records the press before and starts the one now beginning. A press that has changed nothing
   * yet carries on, so a host may start a press before the action that places its point.
   */
  begin(): void
  /**
   * Ends the path with `run` as one step. A press on the first point that closes it belongs to
   * that step, so undo takes back the close in one go.
   */
  end(label: string, run: () => void): void
}

export function createPenHistory(ctx: EditorContext): PenHistory {
  let pending: { before: PenSnapshot } | null = null
  // Undo and redo act on the newest point, so a press waiting to be recorded is recorded first.
  let stopSettling: (() => void) | null = null

  const snapshot = (): PenSnapshot => structuredClone(ctx.state.penState)
  const same = (a: PenSnapshot, b: PenSnapshot) => JSON.stringify(a) === JSON.stringify(b)

  function restore(path: PenSnapshot) {
    pending = null
    stopSettling?.()
    stopSettling = null
    ctx.state.penState = structuredClone(path)
    ctx.state.penCursorX = null
    ctx.state.penCursorY = null
    if (path) ctx.setActiveTool('PEN')
    ctx.requestRender()
  }

  function settle() {
    stopSettling?.()
    stopSettling = null
    if (!pending) return
    const { before } = pending
    pending = null
    const after = snapshot()
    if (same(before, after)) return
    ctx.undo.push({
      label: 'Pen point',
      forward: () => restore(after),
      inverse: () => restore(before)
    })
  }

  function begin() {
    if (pending && same(pending.before, ctx.state.penState)) return
    settle()
    pending = { before: snapshot() }
    stopSettling = ctx.undo.onBeforeHistory(settle)
  }

  function end(label: string, run: () => void) {
    const closing = !!ctx.state.penState?.pendingClose
    if (!closing) settle()
    const before = pending?.before ?? snapshot()
    pending = null
    stopSettling?.()
    stopSettling = null
    ctx.undo.runBatch(label, () => {
      run()
      // Redo leaves the tool the path ended with.
      const tool = ctx.state.activeTool
      ctx.undo.push({
        label,
        forward: () => {
          restore(null)
          ctx.setActiveTool(tool)
        },
        inverse: () => restore(before)
      })
    })
  }

  return { begin, end }
}
