import * as v from 'valibot'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  createSlide,
  createSlideGrid,
  createSlideRow,
  SLIDE_TRANSITION_CURVES,
  SLIDE_TRANSITION_STYLES,
  slideGrid,
  slideRows,
  slideSettings,
  type SlideTransition
} from '@open-pencil/scene-graph/slides'

import {
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessors/utils'

import { invalid, parseFigma, received } from './validation'

/** The bounds Figma's plugin API holds a transition to, in seconds. */
const MIN_DURATION = 0.01
const MAX_DURATION = 10

const transitionSchema = v.object({
  style: v.picklist(SLIDE_TRANSITION_STYLES),
  duration: v.pipe(v.number(), v.minValue(MIN_DURATION), v.maxValue(MAX_DURATION)),
  curve: v.picklist(SLIDE_TRANSITION_CURVES),
  timing: v.variant('type', [
    v.object({ type: v.literal('ON_CLICK') }),
    v.object({ type: v.literal('AFTER_DELAY'), delay: v.pipe(v.number(), v.minValue(0)) })
  ])
})

/** What Figma reports for a slide whose transition was never set. */
const UNSET_TRANSITION: SlideTransition = {
  style: 'NONE',
  duration: 0,
  curve: 'EASE_OUT',
  timing: { type: 'ON_CLICK' }
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
      value(this: ProxyThis): SlideTransition {
        const { transition } = settingsOf(this, 'getSlideTransition')
        return structuredClone(transition ?? UNSET_TRANSITION)
      }
    },
    setSlideTransition: {
      value(this: ProxyThis, value: unknown): void {
        const settings = settingsOf(this, 'setSlideTransition')
        const transition = parseFigma(
          transitionSchema,
          value,
          'setSlideTransition',
          'slideTransition'
        )
        updateNode(this, internals, { slide: { ...settings, transition } })
      }
    }
  })
}
