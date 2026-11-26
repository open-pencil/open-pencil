import { slideRows } from '@open-pencil/scene-graph/slides'
import { randomHex } from '@open-pencil/std/random'

import type { EditorContext } from '#core/editor/types'
import {
  createSlidePlayer,
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

  function report(): void {
    if (!player || !ctx.state.presentation) return
    ctx.state.presentation = {
      ...ctx.state.presentation,
      index: player.index,
      played: player.played,
      steps: player.steps
    }
  }

  /** Draws frames while something moves, and waits for the next timed move. */
  function schedule(): void {
    cancelFrame?.()
    cancelFrame = null
    if (timer !== null) clearTimeout(timer)
    timer = null
    const current = player
    if (!current) return
    ctx.requestRepaint()
    if (current.moving(seconds())) {
      cancelFrame = nextFrame(() => {
        cancelFrame = null
        if (current.tick(seconds())) report()
        schedule()
      })
      return
    }
    const due = current.dueAt()
    if (due === null) return
    timer = setTimeout(
      () => {
        timer = null
        if (current.tick(seconds())) report()
        schedule()
      },
      Math.max(0, (due - seconds()) * 1000)
    )
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
    const start = deck.slice(Math.max(0, from)).find((id) => slides.includes(id)) ?? slides[0]
    stopPresenting()
    player = createSlidePlayer(ctx.graph, slides, start)
    player.start(seconds())
    ctx.state.presentation = {
      id: randomHex(8),
      slideIds: slides,
      index: player.index,
      played: player.played,
      steps: player.steps,
      startedAt: Date.now()
    }
    schedule()
    return true
  }

  /** What the presentation shows at this moment; nothing when there is none. */
  function presentationScene(): PlayerScene {
    return player?.sceneAt(seconds()) ?? { slides: [], layers: new Map() }
  }

  function move(step: (player: SlidePlayer, now: number) => boolean): boolean {
    if (!player) return false
    const moved = step(player, seconds())
    if (moved) {
      report()
      schedule()
    }
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
    presentationScene,
    presentNext,
    presentPrevious,
    presentSlide,
    stopPresenting
  }
}
