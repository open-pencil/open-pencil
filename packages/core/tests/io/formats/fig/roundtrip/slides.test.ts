import { describe, expect, test } from 'bun:test'

import { unzipSync } from 'fflate'

import { createDocumentGraph } from '@open-pencil/core'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  createSlide,
  createSlideRow,
  nextSlide,
  slideGrid,
  slideNumbers,
  slideRows,
  slideSettings,
  type SlideTransition
} from '@open-pencil/scene-graph/slides'

const SMART: SlideTransition = {
  style: 'SMART_ANIMATE',
  duration: 0.5,
  curve: 'GENTLE',
  timing: { type: 'AFTER_DELAY', delay: 2 }
}

function pageOf(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

function slidesOf(graph: SceneGraph): SceneNode[] {
  return slideRows(graph, pageOf(graph)).flat()
}

/** A deck of three slides in two rows, the second of them skipped. */
function deck(): SceneGraph {
  const graph = createDocumentGraph('slides', 'light')
  const grid = slideGrid(graph, pageOf(graph))
  if (!grid) throw new Error('A new deck has a grid')
  createSlide(graph, graph.getChildren(grid.id)[0].id)
  createSlide(graph, createSlideRow(graph, grid.id).id)
  const [first, second] = slidesOf(graph)
  graph.updateNode(first.id, {
    slide: { skipped: false, notes: 'First line\n\nThird line', transition: SMART }
  })
  graph.updateNode(second.id, { slide: { skipped: true, notes: '', transition: null } })
  return graph
}

async function reopen(graph: SceneGraph): Promise<SceneGraph> {
  const bytes = await exportFigFile(graph)
  return parseFigFile(bytes.slice().buffer)
}

describe('Slides decks', () => {
  test('a deck saves as a .deck canvas and opens as slides again', async () => {
    const bytes = await exportFigFile(deck())
    const canvas = unzipSync(bytes)['canvas.fig']
    expect(new TextDecoder().decode(canvas.slice(0, 8))).toBe('fig-deck')
    const reopened = await parseFigFile(bytes.slice().buffer)
    expect(reopened.documentKind).toBe('slides')
    expect(slideRows(reopened, pageOf(reopened)).map((row) => row.length)).toEqual([2, 1])
  })

  test('notes, skipping, and transitions survive a save', async () => {
    const [first, second, third] = slidesOf(await reopen(deck()))
    expect(slideSettings(first)).toEqual({
      skipped: false,
      notes: 'First line\n\nThird line',
      transition: SMART
    })
    expect(slideSettings(second)?.skipped).toBe(true)
    expect(slideSettings(third)).toEqual({ skipped: false, notes: '', transition: null })
  })

  test('the deck moves past skipped slides, which have no number', () => {
    const graph = deck()
    const [first, second, third] = slidesOf(graph)
    expect(nextSlide(graph, first)?.id).toBe(third.id)
    expect(nextSlide(graph, third)).toBeUndefined()
    expect([...slideNumbers(graph, pageOf(graph))]).toEqual([
      [first.id, 1],
      [second.id, null],
      [third.id, 2]
    ])
  })

  test('a slide keeps a size of its own, and a new slide takes it', async () => {
    const graph = deck()
    const [first] = slidesOf(graph)
    const row = graph.getNode(first.parentId ?? '')
    if (!row) throw new Error('A slide sits in a row')
    const last = graph.getChildren(row.id).at(-1)
    if (!last) throw new Error('The row has slides')
    graph.updateNode(last.id, { width: 1440, height: 1080 })
    expect(createSlide(graph, row.id)).toMatchObject({ width: 1440, height: 1080 })
    const sizes = slidesOf(await reopen(graph)).map(({ width, height }) => [width, height])
    expect(sizes).toEqual([
      [1920, 1080],
      [1440, 1080],
      [1440, 1080],
      [1920, 1080]
    ])
  })

  test('a copied slide stays a slide with its settings', async () => {
    const graph = deck()
    const [first] = slidesOf(graph)
    const copy = graph.cloneTree(first.id, first.parentId ?? '')
    if (!copy) throw new Error('The slide was copied')
    const reopened = slidesOf(await reopen(graph))
    expect(reopened).toHaveLength(4)
    expect(reopened.filter((slide) => slideSettings(slide)?.transition)).toHaveLength(2)
  })

  test('clearing a transition and notes in a reopened deck removes them', async () => {
    const graph = await reopen(deck())
    const [first] = slidesOf(graph)
    graph.updateNode(first.id, { slide: { skipped: false, notes: '', transition: null } })
    expect(slideSettings(slidesOf(await reopen(graph))[0])).toEqual({
      skipped: false,
      notes: '',
      transition: null
    })
  })
})
