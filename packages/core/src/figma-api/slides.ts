import * as v from 'valibot'

import type { EasingCurve, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  createSlide,
  createSlideGrid,
  createSlideRow,
  SLIDE_TRANSITION_STYLES,
  slideGrid,
  slideRows,
  resolveSlideTransition,
  slideSettings,
  type SlideTransition,
  type SlideTransitionStyle
} from '@open-pencil/scene-graph/slides'
import { easingPreset } from '@open-pencil/scene-graph/variables'

import {
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessors/utils'
import { graphOf } from '#core/figma-api/graph'

import { invalid, parseFigma, received } from './validation'

/** The bounds Figma's plugin API holds a transition to, in seconds. */
const MIN_DURATION = 0.01
const MAX_DURATION = 10

/** The easings Figma's plugin API offers a slide transition, by the records' names for them. */
const CURVE_EASINGS = {
  EASE_IN: 'IN_CUBIC',
  EASE_OUT: 'OUT_CUBIC',
  EASE_IN_AND_OUT: 'INOUT_CUBIC',
  LINEAR: 'LINEAR',
  GENTLE: 'GENTLE_SPRING',
  QUICK: 'SPRING_PRESET_ONE',
  BOUNCY: 'SPRING_PRESET_TWO',
  SLOW: 'SPRING_PRESET_THREE'
} as const satisfies Record<string, EasingCurve>
type SlideTransitionCurve = keyof typeof CURVE_EASINGS
const SLIDE_TRANSITION_CURVES = Object.keys(CURVE_EASINGS) as SlideTransitionCurve[]

/** A curve's name for an easing; one the plugin API has no name for reads as Ease out. */
function curveOf(easing: EasingCurve): SlideTransitionCurve {
  if (easing === 'EASE_IN') return 'EASE_IN'
  const curve = SLIDE_TRANSITION_CURVES.find((name) => CURVE_EASINGS[name] === easing)
  return curve ?? 'EASE_OUT'
}

const transitionSchema = v.object({
  style: v.picklist(SLIDE_TRANSITION_STYLES),
  duration: v.pipe(v.number(), v.minValue(MIN_DURATION), v.maxValue(MAX_DURATION)),
  curve: v.picklist(SLIDE_TRANSITION_CURVES),
  timing: v.variant('type', [
    v.object({ type: v.literal('ON_CLICK') }),
    v.object({ type: v.literal('AFTER_DELAY'), delay: v.pipe(v.number(), v.minValue(0)) })
  ])
})

/** A slide transition as Figma's plugin API takes and gives it. */
export interface PluginSlideTransition {
  style: SlideTransitionStyle
  duration: number
  curve: SlideTransitionCurve
  timing: { type: 'ON_CLICK' } | { type: 'AFTER_DELAY'; delay: number }
}

/** What Figma reports for a slide whose transition was never set. */
const UNSET_TRANSITION: PluginSlideTransition = {
  style: 'NONE',
  duration: 0,
  curve: 'EASE_OUT',
  timing: { type: 'ON_CLICK' }
}

/** A transition as the plugin API gives it: values, whichever variables they follow. */
/**
 * A slide's transition as the plugin API gives it: the values it plays, with the variables it
 * follows read for the slide, as presenting reads them. Setting it back sets those values.
 */
function pluginTransition(graph: SceneGraph, slide: SceneNode): PluginSlideTransition {
  const played = resolveSlideTransition(graph, slide)
  if (!played) return structuredClone(UNSET_TRANSITION)
  return {
    style: played.style,
    // A variable may give a duration past Figma's longest, which the setter would refuse; a
    // file's 0 reads as 0, as Figma reports it.
    duration: Math.min(MAX_DURATION, played.duration),
    curve: curveOf(played.easing.easing),
    timing:
      played.delay === null ? { type: 'ON_CLICK' } : { type: 'AFTER_DELAY', delay: played.delay }
  }
}

function gridOf(graph: SceneGraph, pageId: string): SceneNode {
  return slideGrid(graph, pageId) ?? createSlideGrid(graph, pageId)
}

function rowsOf(graph: SceneGraph, pageId: string): SceneNode[] {
  return graph.getChildren(gridOf(graph, pageId).id).filter((node) => node.type === 'SLIDE_ROW')
}

/** A row at `index` of the page's grid, or after its last row. */
export function newSlideRow(graph: SceneGraph, pageId: string, index?: number): SceneNode {
  const grid = gridOf(graph, pageId)
  const row = createSlideRow(graph, grid.id)
  if (index !== undefined) graph.insertChildAt(row.id, grid.id, index)
  return row
}

/** A slide at `column` of a row, or at the end of the last row. */
export function newSlide(
  graph: SceneGraph,
  pageId: string,
  rowIndex?: number,
  column?: number
): SceneNode {
  const rows = rowsOf(graph, pageId)
  const row =
    (rowIndex === undefined ? rows.at(-1) : rows.at(rowIndex)) ?? newSlideRow(graph, pageId)
  const slide = createSlide(graph, row.id)
  if (column !== undefined) graph.insertChildAt(slide.id, row.id, column)
  return slide
}

/**
 * Puts the deck's slides in `order`, row by row. Every slide must be named once, as a slide left
 * out would be lost; rows with nothing left are removed.
 */
export function arrangeSlides(graph: SceneGraph, pageId: string, order: readonly string[][]): void {
  const held = slideRows(graph, pageId).flat()
  const named = new Set(order.flat())
  const complete = named.size === held.length && held.every((slide) => named.has(slide.id))
  if (!complete || order.flat().length !== held.length) {
    throw new Error('in setSlideGrid: The grid must hold every slide of the deck exactly once')
  }
  const rows = rowsOf(graph, pageId)
  const grid = gridOf(graph, pageId)
  // A row goes where the first of its slides does, so a moved section keeps its name.
  const free = new Set(rows.map((row) => row.id))
  const targets = order.map((slides) => {
    const own = slides.map((id) => graph.getNode(id)?.parentId).find((id) => id && free.has(id))
    if (own) free.delete(own)
    return own ?? null
  })
  for (const [index, slides] of order.entries()) {
    const rowId = targets[index] ?? createSlideRow(graph, grid.id).id
    graph.insertChildAt(rowId, grid.id, index)
    for (const [column, id] of slides.entries()) graph.insertChildAt(id, rowId, column)
  }
  for (const id of free) if (graph.getChildren(id).length === 0) graph.deleteNode(id)
}

/** `SlideNode`'s members; on other layers the property reads undefined and the methods refuse. */
export function installSlideNodeProxyAccessors(
  prototype: object,
  internals: NodeProxyInternals
): void {
  const settingsOf = (target: ProxyThis, method: string) => {
    const settings = slideSettings(raw(target, internals))
    if (!settings) throw new Error(`in ${method}: Not a slide`)
    return settings
  }
  Object.defineProperties(prototype, {
    isSkippedSlide: {
      get(this: ProxyThis): boolean | undefined {
        return slideSettings(raw(this, internals))?.skipped
      },
      set(this: ProxyThis, value: unknown) {
        const settings = settingsOf(this, 'set_isSkippedSlide')
        if (typeof value !== 'boolean') {
          throw invalid(
            'set_isSkippedSlide',
            `Expected boolean, received ${received(value)}`,
            'isSkippedSlide'
          )
        }
        updateNode(this, internals, { slide: { ...settings, skipped: value } })
      }
    },
    getSlideTransition: {
      value(this: ProxyThis): PluginSlideTransition {
        settingsOf(this, 'getSlideTransition')
        return pluginTransition(graphOf(this), raw(this, internals))
      }
    },
    setSlideTransition: {
      value(this: ProxyThis, value: unknown): void {
        const settings = settingsOf(this, 'setSlideTransition')
        const { curve, ...values } = parseFigma(
          transitionSchema,
          value,
          'setSlideTransition',
          'slideTransition'
        )
        // The plugin API sets values, so the transition no longer follows any variable.
        const transition: SlideTransition = {
          ...values,
          easing: easingPreset(CURVE_EASINGS[curve])
        }
        updateNode(this, internals, { slide: { ...settings, transition } })
      }
    }
  })
}
