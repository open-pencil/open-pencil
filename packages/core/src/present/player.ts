import type { SceneGraph } from '@open-pencil/scene-graph'
import {
  layerAtRest,
  layerFrame,
  resolveSlideTransition,
  slideBuild,
  slideRows,
  slideSettings,
  transitionFrames,
  type BuildStep,
  type LayerFrame,
  type ResolvedSlideTransition,
  type SlideFrame
} from '@open-pencil/scene-graph/slides'
import { easingPosition, easingSeconds, resolveMotion } from '@open-pencil/scene-graph/variables'

/** What a presentation draws at a moment: its slides, the first drawn first, and their layers. */
export interface PlayerScene {
  slides: { id: string; frame: SlideFrame }[]
  /** Where the animated layers of those slides are drawn, by ID. */
  layers: Map<string, LayerFrame>
  /** Layers live islands show in place of the canvas, which leaves them out. */
  islands?: ReadonlySet<string>
}

/** A step's layers with when each starts and how long it plays, in seconds from the step's start. */
interface TimedStep {
  onClick: boolean
  layers: { id: string; step: BuildStep['layers'][number]; start: number; seconds: number }[]
  seconds: number
}

interface RunningTransition {
  from: string
  to: string
  transition: ResolvedSlideTransition
  /** How many steps of the slide left had played: an After delay leaves before they all have. */
  fromPlayed: number
  start: number
  seconds: number
}

const STILL: SlideFrame = { x: 0, y: 0, opacity: 1, dim: 0 }

/** The slides a deck on `pageId` presents, in order: skipped ones are passed by. */
export function presentedSlides(graph: SceneGraph, pageId: string): string[] {
  return slideRows(graph, pageId)
    .flat()
    .filter((slide) => !slideSettings(slide)?.skipped)
    .map((slide) => slide.id)
}

/** The layers that present as slides on a design's page: frames and components at its top. */
const FRAME_TYPES = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE'])

/**
 * The frames of a design's page that present as slides: those of `ids` at the page's top level,
 * or every one when none is chosen, in reading order: top to bottom, then left to right.
 */
export function presentedFrames(
  graph: SceneGraph,
  pageId: string,
  ids: Iterable<string> = []
): string[] {
  const chosen = new Set(ids)
  const frames = graph
    .getChildren(pageId)
    .filter((node) => node.visible && FRAME_TYPES.has(node.type))
  const picked = frames.filter((node) => chosen.has(node.id))
  return (picked.length > 0 ? picked : frames)
    .toSorted((a, b) => a.y - b.y || a.x - b.x)
    .map((node) => node.id)
}

/**
 * A deck being presented: the slide it shows, how many steps of that slide's build have played,
 * and the transitions and steps still moving. Times are seconds on the caller's clock, so the
 * same player draws a live presentation and a test's chosen moments.
 */
export function createSlidePlayer(graph: SceneGraph, slides: readonly string[], startId?: string) {
  let index = Math.max(0, startId ? slides.indexOf(startId) : 0)
  let steps = timedSteps(slides.at(index))
  let played = 0
  let running: RunningTransition | null = null
  /** The step that is playing and when it started. */
  let stepping: { index: number; start: number } | null = null
  /** When the slide on show appeared, for an After delay transition. */
  let shownAt = 0
  let started = false

  function timedSteps(slideId: string | undefined): TimedStep[] {
    if (!slideId) return []
    return slideBuild(graph, slideId).map((step) => {
      let start = 0
      const layers = step.layers.map((layer) => {
        const motion = resolveMotion(graph, layer.animation, layer.id)
        const seconds = easingSeconds(motion.easing, motion.duration)
        const timed = { id: layer.id, step: layer, start, seconds }
        start += seconds
        return timed
      })
      return { onClick: step.onClick, layers, seconds: start }
    })
  }

  function stepsOf(slideId: string | undefined): BuildStep[] {
    return slideId ? slideBuild(graph, slideId) : []
  }

  /** Whether the first step of the slide on show plays as it appears, without a click. */
  function autoStep(): boolean {
    return steps.length > 0 && !steps[0].onClick
  }

  function playStep(now: number): void {
    stepping = { index: played, start: now }
    played++
  }

  /**
   * Ends the transition under way. It ends at its time when it ran its course, and the slide's own
   * first step starts then; `cut` ends it at once, as when the presenter moves on before it
   * finished, and that step is played already.
   */
  function endTransition(now: number, cut: boolean): void {
    if (!running) return
    const end = running.start + running.seconds
    running = null
    shownAt = cut ? now : end
    if (!autoStep() || played > 0) return
    if (cut) played = 1
    else playStep(end)
  }

  /** Brings what is moving to its end at once. */
  function settle(now: number): void {
    endTransition(now, true)
    stepping = null
  }

  function enter(target: number, now: number, transition: ResolvedSlideTransition | null): void {
    const from = slides[index]
    const fromPlayed = played
    index = target
    steps = timedSteps(slides[index])
    played = 0
    stepping = null
    const to = slides[index]
    const seconds = transition ? easingSeconds(transition.easing, transition.duration) : 0
    if (transition && transition.style !== 'NONE' && seconds > 0 && from !== to) {
      running = { from, to, transition, fromPlayed, start: now, seconds }
      return
    }
    running = null
    shownAt = now
    if (autoStep()) playStep(now)
  }

  /** Moves on to the next slide with the transition of the one on show; false at the end. */
  function moveOn(now: number): boolean {
    if (index + 1 >= slides.length) return false
    const current = graph.getNode(slides[index])
    enter(index + 1, now, current ? resolveSlideTransition(graph, current) : null)
    return true
  }

  const player = {
    get slides(): readonly string[] {
      return slides
    },
    /** The slide on show, by its place among the presented slides. */
    get index(): number {
      return index
    },
    /** How many steps of the slide's build have played. */
    get played(): number {
      return played
    },
    get steps(): number {
      return steps.length
    },

    /** Starts the presentation at `now`, playing the first slide's own first step if it has one. */
    start(now: number): void {
      started = true
      shownAt = now
      if (autoStep()) playStep(now)
    },

    /** Plays the next step, or moves on to the next slide; false at the end of the deck. */
    next(now: number): boolean {
      if (!started) player.start(now)
      settle(now)
      if (played < steps.length) {
        playStep(now)
        return true
      }
      return moveOn(now)
    },

    /**
     * Takes the last step back, or goes back to the slide before with its build played, at once
     * as Figma does; false at the start of the deck.
     */
    previous(now: number): boolean {
      settle(now)
      if (played > (autoStep() ? 1 : 0)) {
        played--
        return true
      }
      if (index === 0) return false
      index--
      steps = timedSteps(slides[index])
      played = steps.length
      shownAt = now
      return true
    },

    /** Shows the slide at `target` at once, with none of its build played but its own first step. */
    goTo(target: number, now: number): void {
      if (target < 0 || target >= slides.length) return
      running = null
      enter(target, now, null)
    },

    /**
     * When the player next moves by itself: an After delay transition, counted from the slide
     * appearing whether its steps played or not, as in Figma; null when nothing is timed.
     */
    dueAt(): number | null {
      // The last slide has nowhere to move on to.
      if (running || index + 1 >= slides.length) return null
      const current = graph.getNode(slides[index])
      const delay = current ? resolveSlideTransition(graph, current)?.delay : null
      return delay === null || delay === undefined ? null : shownAt + delay
    },

    /** Ends what ran its course and moves on if a timed move is due at `now`; true when it did. */
    tick(now: number): boolean {
      if (running && now >= running.start + running.seconds) endTransition(now, false)
      const due = player.dueAt()
      if (due === null || now < due) return false
      settle(now)
      return moveOn(now)
    },

    /** Whether something is still moving at `now`, so the caller keeps drawing. */
    moving(now: number): boolean {
      if (running && now < running.start + running.seconds) return true
      return stepping !== null && now < stepping.start + (steps[stepping.index]?.seconds ?? 0)
    },

    /** The layer whose animation is under way at `now`, or null between and outside steps. */
    animatingAt(now: number): string | null {
      const step = stepping && steps[stepping.index]
      if (!stepping || !step) return null
      const elapsed = now - stepping.start
      return (
        step.layers.find((layer) => elapsed > layer.start && elapsed < layer.start + layer.seconds)
          ?.id ?? null
      )
    },

    /** Where everything is at `now`. */
    sceneAt(now: number): PlayerScene {
      const layers = new Map<string, LayerFrame>()
      if (running && now < running.start + running.seconds) {
        const { transition } = running
        const position = easingPosition(transition.easing, now - running.start, transition.duration)
        const frames = transitionFrames(transition.style, position)
        // The slide left keeps its build played; the one coming has none of it yet.
        for (const [stepIndex, step] of stepsOf(running.from).entries())
          for (const layer of step.layers)
            layers.set(layer.id, layerAtRest(layer.animation, stepIndex < running.fromPlayed))
        for (const step of stepsOf(running.to))
          for (const layer of step.layers) layers.set(layer.id, layerAtRest(layer.animation, false))
        const from = { id: running.from, frame: frames.from }
        const to = { id: running.to, frame: frames.to }
        return { slides: frames.above === 'to' ? [from, to] : [to, from], layers }
      }
      const slideId = slides[index]
      for (const [stepIndex, step] of steps.entries()) {
        const playing = stepping?.index === stepIndex ? stepping : null
        for (const layer of step.layers) {
          const animation = layer.step.animation
          if (!playing) {
            layers.set(layer.id, layerAtRest(animation, stepIndex < played))
            continue
          }
          const elapsed = now - playing.start - layer.start
          if (elapsed <= 0) layers.set(layer.id, layerAtRest(animation, false))
          else if (elapsed >= layer.seconds) layers.set(layer.id, layerAtRest(animation, true))
          else {
            const motion = resolveMotion(graph, animation, layer.id)
            layers.set(
              layer.id,
              layerFrame(animation, easingPosition(motion.easing, elapsed, motion.duration))
            )
          }
        }
      }
      return { slides: slideId ? [{ id: slideId, frame: STILL }] : [], layers }
    }
  }
  return player
}

export type SlidePlayer = ReturnType<typeof createSlidePlayer>
