import { describe, expect, test } from 'bun:test'

import {
  addEmptySlide,
  createEmptyDeckGraph,
  EMPTY_SLIDE_CORNER_RADIUS,
  EMPTY_SLIDE_HEIGHT,
  EMPTY_SLIDE_WIDTH
} from '../src/empty'

describe('createEmptyDeckGraph', () => {
  test('builds one page with a white 1920×1080 artboard and starter text', () => {
    const graph = createEmptyDeckGraph()
    const pages = graph.getPages()
    expect(pages).toHaveLength(1)

    const children = graph.getChildren(pages[0].id)
    expect(children).toHaveLength(1)
    expect(children[0].type).toBe('FRAME')
    expect(children[0].width).toBe(EMPTY_SLIDE_WIDTH)
    expect(children[0].height).toBe(EMPTY_SLIDE_HEIGHT)
    expect(children[0].cornerRadius).toBe(EMPTY_SLIDE_CORNER_RADIUS)
    expect(children[0].topLeftRadius).toBe(EMPTY_SLIDE_CORNER_RADIUS)
    expect(children[0].clipsContent).toBe(true)
    expect(children[0].fills[0]?.type).toBe('SOLID')
    expect(children[0].fills[0]?.type === 'SOLID' && children[0].fills[0].color).toEqual({
      r: 1,
      g: 1,
      b: 1,
      a: 1
    })

    const texts = graph.getChildren(children[0].id).filter((n) => n.type === 'TEXT')
    expect(texts).toHaveLength(2)
    expect(texts.some((t) => t.text.includes('Slide Deck Title'))).toBe(true)
    expect(texts.some((t) => t.text.includes('beginning of something big'))).toBe(true)
  })
})

describe('addEmptySlide', () => {
  test('appends a blank white artboard page', () => {
    const graph = createEmptyDeckGraph()
    const pageId = addEmptySlide(graph)
    expect(graph.getPages()).toHaveLength(2)
    const page = graph.getNode(pageId)
    expect(page?.type).toBe('CANVAS')
    expect(page?.name).toBe('2')
    const artboard = graph.getChildren(pageId)[0]
    expect(artboard?.type).toBe('FRAME')
    expect(artboard?.width).toBe(EMPTY_SLIDE_WIDTH)
    expect(graph.getChildren(artboard.id)).toHaveLength(0)
  })
})
