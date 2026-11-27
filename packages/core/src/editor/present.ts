import { slideRows } from '@open-pencil/scene-graph/slides'
import { randomHex } from '@open-pencil/std/random'

import type { EditorContext } from '#core/editor/types'
import {
  createSlidePlayer,
  presentedFrames,
  presentedSlides,
  type PlayerScene,
  type SlidePlayer
} from '#core/present/player'

/** Seconds on a clock that only moves forwards, for timing a presentation's motion. */
function seconds(): number {
  return performance.now() / 1000
}

/** How long a frame lasts where the host draws none of its own, as a headless one: 60 a second. */
const FALLBACK_FRAME_MS = 16

/** Runs `callback` before the next frame, or soon where there are no frames. */
function nextFrame(callback: () => void): () => void {
  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(callback)
    return () => cancelAnimationFrame(id)
  }
  const id = setTimeout(callback, FALLBACK_FRAME_MS)
  return () => clearTimeout(id)
}

/**
 * Presenting the deck on the current page: the player, the frames it draws while something moves,
 * and the timer of an After delay transition. `state.presentation` says where it is.
 */
export function createPresentActions(ctx: EditorContext) {
  let player: SlidePlayer | null = null
  let cancelFrame: (() => void) | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  /** Tells the status where the player is at `now`, when that changed. */
  function report(now: number): void {
    const status = ctx.state.presentation
    if (!player || !status) return
    const moving = player.moving(now)
    if (
      status.index === player.index &&
      status.played === player.played &&
      status.steps === player.steps &&
      status.moving === moving
    )
      return
    ctx.state.presentation = {
      ...status,
      index: player.index,
      played: player.played,
      steps: player.steps,
      moving
    }
  }

  /**
   * Draws frames while something moves, and waits for the next timed move. Each pass reads the
   * clock once: the player first ends what ran its course and moves on if a timed move is due, so
   * what is still moving and what comes next are decided at the same moment.
   */
  function schedule(): void {
    cancelFrame?.()
    cancelFrame = null
    if (timer !== null) clearTimeout(timer)
    timer = null
    const current = player
    if (!current) return
    const now = seconds()
    current.tick(now)
    report(now)
    ctx.requestRepaint()
    if (current.moving(now)) {
      cancelFrame = nextFrame(() => {
        cancelFrame = null
        schedule()
      })
      return
    }
    const due = current.dueAt()
    if (due === null) return
    timer = setTimeout(
      () => {
        timer = null
        schedule()
      },
      Math.max(0, (due - now) * 1000)
    )
  }

  /** Starts presenting `slides`, the layers presented in order, from `start`. */
  function begin(slides: string[], start: string): void {
    stopPresenting()
    player = createSlidePlayer(ctx.graph, slides, start)
    player.start(seconds())
    ctx.state.presentation = {
      id: randomHex(8),
      slideIds: slides,
      index: player.index,
      played: player.played,
      steps: player.steps,
      moving: player.moving(seconds()),
      startedAt: Date.now()
    }
    schedule()
  }

  /**
   * Presents the deck on the current page from `slideId`, or from its first slide; a skipped
   * slide starts it at the next one. False when the page has no slides to present.
   */
  function present(slideId?: string | null): boolean {
    const slides = presentedSlides(ctx.graph, ctx.state.currentPageId)
    if (slides.length === 0) return false
    // A skipped slide, which is not presented, starts the deck at the next one that is.
    const deck = slideRows(ctx.graph, ctx.state.currentPageId)
      .flat()
      .map((slide) => slide.id)
    const from = slideId ? deck.indexOf(slideId) : 0
    begin(slides, deck.slice(Math.max(0, from)).find((id) => slides.includes(id)) ?? slides[0])
    return true
  }

  /**
   * Presents a design's frames as slides, without making it a deck: the selected ones at the top
   * of the page, or all of them, top to bottom and left to right. False when there are none.
   */
  function presentFrames(ids: Iterable<string> = ctx.state.selectedIds): boolean {
    const frames = presentedFrames(ctx.graph, ctx.state.currentPageId, ids)
    if (frames.length === 0) return false
    begin(frames, frames[0])
    return true
  }

  /** What the presentation shows at this moment; nothing when there is none. */
  function presentationScene(): PlayerScene {
    return player?.sceneAt(seconds()) ?? { slides: [], layers: new Map() }
  }

  function move(step: (player: SlidePlayer, now: number) => boolean): boolean {
    if (!player) return false
    const moved = step(player, seconds())
    if (moved) schedule()
    return moved
  }

  /** Plays the next step or moves on; false at the end of the deck. */
  function presentNext(): boolean {
    return move((current, now) => current.next(now))
  }

  /** Takes a step back or goes back a slide, at once; false at the start of the deck. */
  function presentPrevious(): boolean {
    return move((current, now) => current.previous(now))
  }

  /** Shows the presented slide at `index` at once. */
  function presentSlide(index: number): void {
    move((current, now) => {
      current.goTo(index, now)
      return true
    })
  }

  function stopPresenting(): void {
    cancelFrame?.()
    cancelFrame = null
    if (timer !== null) clearTimeout(timer)
    timer = null
    player = null
    if (ctx.state.presentation) ctx.state.presentation = null
  }

  // Another document has none of these slides.
  ctx.onEditorEvent('graph:replaced', stopPresenting)

  return {
    present,
    presentFrames,
    presentationScene,
    presentNext,
    presentPrevious,
    presentSlide,
    stopPresenting
  }
}
