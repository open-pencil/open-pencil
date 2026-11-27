import { uniq } from 'es-toolkit/array'
import * as v from 'valibot'

import type { SceneGraph } from '@open-pencil/scene-graph'
import {
  animatedLayers,
  animationSlide,
  animationTarget,
  createSlide,
  defaultLayerAnimation,
  defaultSlideTransition,
  layerAnimationDirection,
  layerAnimationStyle,
  MOTION_DIRECTIONS,
  renumberSlides,
  SLIDE_TRANSITION_KINDS,
  slideGrid,
  slideNumbers,
  slideRows,
  slideSettings,
  transitionDirection,
  transitionKind,
  transitionStyle,
  type LayerAnimation,
  type SlideTransition
} from '@open-pencil/scene-graph/slides'
import { motionFromSpec, motionSpecSchema, motionToSpec } from '@open-pencil/scene-graph/variables'

import type { FigmaAPI } from '#core/figma-api'
import { graphOf } from '#core/figma-api/graph'
import { arrangeSlides, newSlideRow } from '#core/figma-api/slides'
import { defineTool, toolFailure } from '#core/tools/schema'

/** How many text lines a slide's outline gives, enough to tell what it is about. */
const OUTLINE_TEXT_LINES = 8

const slideIdsSchema = v.pipe(
  v.array(v.string()),
  v.minLength(1),
  v.description('Slide IDs, as get_deck lists them')
)
const directionSchema = v.pipe(
  v.picklist(MOTION_DIRECTIONS),
  v.description('Which way it moves, as the arrows in the Animate tab show it')
)

function deckPage(figma: FigmaAPI): { graph: SceneGraph; pageId: string } {
  const graph = graphOf(figma)
  const pageId = figma.currentPage.id
  if (!slideGrid(graph, pageId))
    throw new Error('The current page has no slides; open a deck (.deck) or a page with slides')
  return { graph, pageId }
}

/** The text of a slide's text layers, in layer order, for an outline. */
function slideText(graph: SceneGraph, slideId: string): string[] {
  const lines: string[] = []
  const visit = (id: string) => {
    for (const child of graph.getChildren(id)) {
      if (lines.length >= OUTLINE_TEXT_LINES) return
      if (child.type === 'TEXT' && child.text.trim()) lines.push(child.text.trim())
      visit(child.id)
    }
  }
  visit(slideId)
  return lines
}

function transitionOutline(graph: SceneGraph, transition: SlideTransition) {
  const { timing } = transition
  return {
    style: transitionKind(transition.style),
    direction: transitionDirection(transition.style),
    ...motionToSpec(graph, transition),
    delay: timing.type === 'AFTER_DELAY' ? timing.delay : null
  }
}

function animationOutline(graph: SceneGraph, id: string, animation: LayerAnimation) {
  return {
    layer: id,
    name: graph.getNode(id)?.name ?? '',
    style: animation.style === 'FADE' ? 'FADE' : 'SLIDE',
    direction: layerAnimationDirection(animation.style),
    phase: animation.phase,
    trigger: animation.trigger,
    ...motionToSpec(graph, animation)
  }
}

export const getDeck = defineTool({
  name: 'get_deck',
  documentKinds: ['slides'],
  description:
    'Read the deck on the current page as an outline: its sections and their slides in ' +
    'presenting order, each with its number (none for a skipped slide), size, speaker notes, ' +
    'the text on it, its transition, and the layers its build animates, in the order they ' +
    'play. Use it before create_slides, move_slides, set_slides, or set_animations.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({}),
  execute: (figma) => {
    try {
      const { graph, pageId } = deckPage(figma)
      const numbers = slideNumbers(graph, pageId)
      const grid = slideGrid(graph, pageId)
      const sections = graph.getChildren(grid?.id ?? '').map((row) => ({
        id: row.id,
        slides: graph
          .getChildren(row.id)
          .filter((slide) => slide.type === 'SLIDE')
          .map((slide) => {
            const settings = slideSettings(slide)
            return {
              id: slide.id,
              number: numbers.get(slide.id) ?? null,
              skipped: settings?.skipped ?? false,
              width: slide.width,
              height: slide.height,
              notes: settings?.notes ?? '',
              text: slideText(graph, slide.id),
              transition: settings?.transition
                ? transitionOutline(graph, settings.transition)
                : null,
              animations: animatedLayers(graph, slide.id).map(({ id, animation }) =>
                animationOutline(graph, id, animation)
              )
            }
          })
      }))
      return { sections }
    } catch (error) {
      return toolFailure(error)
    }
  }
})

/** The deck's slides by section, as IDs. */
function order(graph: SceneGraph, pageId: string): string[][] {
  return slideRows(graph, pageId).map((row) => row.map((slide) => slide.id))
}

/**
 * The deck's order with `moving` taken out and put after `after`, at the start of the deck with
 * null, or, with `newSection`, as a section of their own after the section of `after`.
 */
function placed(
  current: string[][],
  moving: readonly string[],
  after: string | null,
  newSection: boolean
): string[][] {
  const taken = new Set(moving)
  const rows = current.map((row) => row.filter((id) => !taken.has(id)))
  const rowIndex = after === null ? 0 : rows.findIndex((row) => row.includes(after))
  if (rowIndex === -1) throw new Error(`No slide ${after} outside those being moved`)
  if (newSection) {
    rows.splice(after === null ? 0 : rowIndex + 1, 0, [...moving])
  } else {
    const row = rows[rowIndex] ?? []
    const at = after === null ? 0 : row.indexOf(after) + 1
    rows[rowIndex] = [...row.slice(0, at), ...moving, ...row.slice(at)]
  }
  return rows.filter((row) => row.length > 0)
}

const placementInput = {
  after: v.optional(
    v.pipe(
      v.nullable(v.string()),
      v.description('Slide ID to put them after; null for the start; the end if omitted')
    )
  ),
  newSection: v.optional(
    v.pipe(v.boolean(), v.description('Put them in a section of their own, after that of `after`'))
  )
}

function lastSlide(graph: SceneGraph, pageId: string): string | null {
  return order(graph, pageId).flat().at(-1) ?? null
}

export const createSlides = defineTool({
  name: 'create_slides',
  documentKinds: ['slides'],
  description:
    'Add empty slides to the deck on the current page, at the size of the slide before them, ' +
    'after a slide or at the end, optionally as a new section. Slides are numbered by their ' +
    'place, as Figma names them. Returns their IDs; draw on them with the other tools, using ' +
    'a slide ID as the parent.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    count: v.optional(
      v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(50), v.description('1 if omitted'))
    ),
    ...placementInput
  }),
  execute: (figma, { count = 1, after, newSection = false }) => {
    try {
      const { graph, pageId } = deckPage(figma)
      const anchor = after === undefined ? lastSlide(graph, pageId) : after
      const rowId = (anchor && graph.getNode(anchor)?.parentId) ?? newSlideRow(graph, pageId).id
      // New slides take the size of the slide they follow, wherever it is in its row.
      const size = anchor ? graph.getNode(anchor) : undefined
      const ids = Array.from({ length: count }, () => {
        const slide = createSlide(graph, rowId)
        if (size) graph.updateNode(slide.id, { width: size.width, height: size.height })
        return slide.id
      })
      arrangeSlides(graph, pageId, placed(order(graph, pageId), ids, anchor, newSection))
      renumberSlides(graph, pageId)
      return { slides: ids }
    } catch (error) {
      return toolFailure(error)
    }
  }
})

export const moveSlides = defineTool({
  name: 'move_slides',
  documentKinds: ['slides'],
  description:
    'Move slides of the deck on the current page, kept in the order given, after a slide, to ' +
    'the start, or into a section of their own. Sections left empty are removed and slides are ' +
    'numbered again.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({ slides: slideIdsSchema, ...placementInput }),
  execute: (figma, { slides, after, newSection = false }) => {
    try {
      const { graph, pageId } = deckPage(figma)
      const current = order(graph, pageId)
      const known = new Set(current.flat())
      const unknown = slides.find((id) => !known.has(id))
      if (unknown) throw new Error(`No slide ${unknown} in the deck on the current page`)
      const rest = current.flat().filter((id) => !slides.includes(id))
      const anchor = after === undefined ? (rest.at(-1) ?? null) : after
      arrangeSlides(graph, pageId, placed(current, slides, anchor, newSection))
      renumberSlides(graph, pageId)
      return { sections: order(graph, pageId) }
    } catch (error) {
      return toolFailure(error)
    }
  }
})

const transitionSpecSchema = v.strictObject({
  style: v.optional(
    v.pipe(
      v.picklist(SLIDE_TRANSITION_KINDS),
      v.description('The transition, as the Animate tab names it; Smart animate plays as Dissolve')
    )
  ),
  direction: v.optional(directionSchema),
  ...motionSpecSchema.entries,
  delay: v.optional(
    v.pipe(
      v.nullable(v.pipe(v.number(), v.minValue(0))),
      v.description('Seconds before it moves on by itself; null to wait for a click')
    )
  )
})

function slideTransitionFrom(
  graph: SceneGraph,
  current: SlideTransition,
  spec: v.InferOutput<typeof transitionSpecSchema>
): SlideTransition {
  const { style, direction, delay, ...motion } = spec
  const next = motionFromSpec(graph, motion, current)
  next.style = transitionStyle(
    style ?? transitionKind(current.style),
    direction ?? transitionDirection(current.style) ?? 'LEFT'
  )
  if (delay === null) next.timing = { type: 'ON_CLICK' }
  else if (delay !== undefined) next.timing = { type: 'AFTER_DELAY', delay }
  return next
}

export const setSlides = defineTool({
  name: 'set_slides',
  documentKinds: ['slides'],
  description:
    "Set slides' speaker notes (plain text, a line per paragraph), whether presenting skips " +
    'them, and how they move on to the next slide: a style and direction, a duration in ' +
    'seconds and an easing, each a value or a TIMING or EASING variable by name, and a delay ' +
    'to move on by itself. A transition null removes it. Fields left out keep their values.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    slides: slideIdsSchema,
    notes: v.optional(v.pipe(v.string(), v.description('Speaker notes'))),
    skipped: v.optional(v.pipe(v.boolean(), v.description('Whether presenting passes them by'))),
    transition: v.optional(v.nullable(transitionSpecSchema))
  }),
  execute: (figma, { slides, notes, skipped, transition }) => {
    try {
      const { graph, pageId } = deckPage(figma)
      for (const id of slides) {
        const node = graph.getNode(id)
        const settings = node && slideSettings(node)
        if (!settings) throw new Error(`${id} is not a slide`)
        const next = { ...settings }
        if (notes !== undefined) next.notes = notes
        if (skipped !== undefined) next.skipped = skipped
        if (transition === null) next.transition = null
        else if (transition)
          next.transition = slideTransitionFrom(
            graph,
            settings.transition ?? defaultSlideTransition(),
            transition
          )
        graph.updateNode(id, { slide: next })
      }
      renumberSlides(graph, pageId)
      return { slides }
    } catch (error) {
      return toolFailure(error)
    }
  }
})

const animationSpecSchema = v.strictObject({
  style: v.optional(
    v.pipe(v.picklist(['FADE', 'SLIDE']), v.description('Fade, or slide the way of `direction`'))
  ),
  direction: v.optional(directionSchema),
  phase: v.optional(
    v.pipe(v.picklist(['IN', 'OUT']), v.description('IN brings the layer on; OUT takes it away'))
  ),
  trigger: v.optional(
    v.pipe(
      v.picklist(['ON_CLICK', 'AFTER_PREVIOUS']),
      v.description('Wait for a click, or play after the step before')
    )
  ),
  ...motionSpecSchema.entries
})

function layerAnimationFrom(
  graph: SceneGraph,
  current: LayerAnimation,
  spec: v.InferOutput<typeof animationSpecSchema>
): LayerAnimation {
  const { style, direction, phase, trigger, ...motion } = spec
  const next = motionFromSpec(graph, motion, current)
  if (style === 'FADE') next.style = 'FADE'
  else if (style === 'SLIDE' || direction)
    next.style = layerAnimationStyle(direction ?? layerAnimationDirection(current.style) ?? 'RIGHT')
  if (phase) next.phase = phase
  if (trigger) next.trigger = trigger
  return next
}

export const setAnimations = defineTool({
  name: 'set_animations',
  documentKinds: ['slides'],
  description:
    'Animate layers on slides as steps of the slide build, or with null stop animating them; a ' +
    'layer inside an instance animates as its instance, as in Figma, and the result names it. ' +
    'A layer not yet animated is added after the steps its slide has, in the order given, with ' +
    "Figma's default: slide in rightwards on a click over 0.6s. Each step fades or slides, In " +
    'or Out, on a click or after the step before, with a duration in seconds and an easing, ' +
    'each a value or a variable by name.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    layers: v.pipe(v.array(v.string()), v.minLength(1), v.description('Layer IDs on slides')),
    animation: v.nullable(animationSpecSchema)
  }),
  execute: (figma, { layers, animation }) => {
    try {
      const graph = graphOf(figma)
      // A layer inside an instance animates as its instance, as in Figma.
      const targets = layers.map((id) => {
        const target = animationTarget(graph, id)
        if (!target) throw new Error(`${id} is not a layer on a slide`)
        return target
      })
      for (const id of uniq(targets)) {
        const node = graph.getNode(id)
        const slide = animationSlide(graph, id)
        if (!node || !slide) throw new Error(`${id} is not a layer on a slide`)
        if (animation === null) {
          graph.updateNode(id, { animation: null })
          continue
        }
        let last = -1
        for (const step of animatedLayers(graph, slide.id))
          if (step.id !== id) last = Math.max(last, step.animation.order)
        const current = node.animation ?? defaultLayerAnimation(last + 1)
        graph.updateNode(id, { animation: layerAnimationFrom(graph, current, animation) })
      }
      return { layers: uniq(targets) }
    } catch (error) {
      return toolFailure(error)
    }
  }
})
