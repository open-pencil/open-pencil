import { describe, expect, test } from 'bun:test'

import { createDocumentGraph } from '@open-pencil/core'
import { createSlidePlayer, presentedFrames, presentedSlides } from '@open-pencil/core/present'
import type { SceneGraph } from '@open-pencil/scene-graph'
import {
  createSlide,
  defaultLayerAnimation,
  defaultSlideTransition,
  slideRows,
  type SlideTransition
} from '@open-pencil/scene-graph/slides'

/** A deck of four slides, the third skipped; the first holds a title and a box. */
function deck() {
  const graph = createDocumentGraph('slides', 'light')
  const pageId = graph.getPages()[0].id
  const [first] = slideRows(graph, pageId).flat()
  const row = first.parentId ?? ''
  for (let count = 0; count < 3; count++) createSlide(graph, row)
  const [, second, third, fourth] = slideRows(graph, pageId).flat()
  graph.updateNode(third.id, { slide: { skipped: true, notes: '', transition: null } })
  const title = graph.createNode('TEXT', first.id, { name: 'Title' })
  const box = graph.createNode('RECTANGLE', first.id, { name: 'Box' })
  return { graph, pageId, first, second, fourth, title, box }
}

function transition(graph: SceneGraph, slideId: string, value: SlideTransition) {
  graph.updateNode(slideId, { slide: { skipped: false, notes: '', transition: value } })
}

function opacity(player: ReturnType<typeof createSlidePlayer>, now: number, id: string) {
  return player.sceneAt(now).layers.get(id)?.opacity
}

describe('presenting a deck', () => {
  test('names the layer whose animation is under way, one after another in a chained step', () => {
    const { graph, first, title, box } = deck()
    graph.updateNode(title.id, { animation: { ...defaultLayerAnimation(0), duration: 0.5 } })
    graph.updateNode(box.id, {
      animation: { ...defaultLayerAnimation(1), trigger: 'AFTER_PREVIOUS', duration: 0.5 }
    })
    const player = createSlidePlayer(graph, [first.id])
    player.start(0)
    // The build waits for a click: nothing is under way.
    expect(player.animatingAt(0.1)).toBeNull()
    player.next(1)
    expect(player.animatingAt(1.2)).toBe(title.id)
    expect(opacity(player, 1.2, title.id)).toBeGreaterThan(0)
    expect(opacity(player, 1.2, title.id)).toBeLessThan(1)
    // The chained box takes over once the title has played.
    expect(player.animatingAt(1.7)).toBe(box.id)
    expect(player.animatingAt(2.5)).toBeNull()
  })

  test("a slide's steps play one click at a time before the deck moves on", () => {
    const { graph, pageId, second, title, box } = deck()
    graph.updateNode(title.id, { animation: defaultLayerAnimation(0) })
    graph.updateNode(box.id, { animation: { ...defaultLayerAnimation(1), style: 'FADE' } })
    const player = createSlidePlayer(graph, presentedSlides(graph, pageId))
    player.start(0)
    expect(opacity(player, 0, title.id)).toBe(0)
    player.next(1)
    // Halfway through its 0.6 s, the title is on its way in.
    const halfway = player.sceneAt(1.3).layers.get(title.id)
    expect(halfway?.x).toBeLessThan(0)
    expect(halfway?.opacity).toBeGreaterThan(0)
    expect(opacity(player, 2, title.id)).toBe(1)
    expect(opacity(player, 2, box.id)).toBe(0)
    player.next(3)
    expect(opacity(player, 4, box.id)).toBe(1)
    player.next(5)
    expect(player.sceneAt(6).slides.map((slide) => slide.id)).toEqual([second.id])
  })

  test('going back takes a step back at once, then shows the slide before built', () => {
    const { graph, pageId, title } = deck()
    graph.updateNode(title.id, { animation: defaultLayerAnimation(0) })
    const player = createSlidePlayer(graph, presentedSlides(graph, pageId))
    player.next(0)
    player.previous(0.1)
    expect(opacity(player, 0.1, title.id)).toBe(0)
    player.next(1)
    player.next(2)
    player.previous(3)
    expect(player.index).toBe(0)
    expect(opacity(player, 3, title.id)).toBe(1)
  })

  test('skipped slides are passed by', () => {
    const { graph, pageId, second, fourth } = deck()
    const slides = presentedSlides(graph, pageId)
    expect(slides).toHaveLength(3)
    const player = createSlidePlayer(graph, slides, second.id)
    player.next(0)
    expect(slides[player.index]).toBe(fourth.id)
  })

  test('a transition plays over its easing, and moving on during it ends it at once', () => {
    const { graph, pageId, first, second } = deck()
    transition(graph, first.id, {
      ...defaultSlideTransition(),
      style: 'PUSH_FROM_RIGHT',
      duration: 1
    })
    const player = createSlidePlayer(graph, presentedSlides(graph, pageId))
    player.next(0)
    const scene = player.sceneAt(0.5)
    expect(scene.slides.map((slide) => slide.id)).toEqual([first.id, second.id])
    expect(scene.slides[1].frame.x).toBeGreaterThan(0)
    expect(player.moving(0.5)).toBe(true)
    player.next(0.6)
    expect(player.moving(0.6)).toBe(false)
    expect(player.index).toBe(2)
  })

  test('After delay moves on by itself, with steps still waiting, as in Figma', () => {
    const { graph, pageId, first, title } = deck()
    graph.updateNode(title.id, { animation: defaultLayerAnimation(0) })
    transition(graph, first.id, {
      ...defaultSlideTransition(),
      style: 'NONE',
      timing: { type: 'AFTER_DELAY', delay: 2 }
    })
    const player = createSlidePlayer(graph, presentedSlides(graph, pageId))
    player.start(0)
    expect(player.tick(1.9)).toBe(false)
    expect(player.tick(2)).toBe(true)
    expect(player.index).toBe(1)
  })

  test("a slide's first step plays as it appears when it follows nothing", () => {
    const { graph, pageId, title } = deck()
    graph.updateNode(title.id, {
      animation: { ...defaultLayerAnimation(0), trigger: 'AFTER_PREVIOUS' }
    })
    const player = createSlidePlayer(graph, presentedSlides(graph, pageId))
    player.start(0)
    expect(opacity(player, 1, title.id)).toBe(1)
    // Going back does not take it away; there is nothing before it to go back to.
    expect(player.previous(1)).toBe(false)
  })

  test('a step lasts as long as the TIMING variable it follows says', () => {
    const { graph, pageId, title } = deck()
    const motion = graph.createCollection('Motion')
    const slow = graph.createVariable('Slow', 'TIMING', motion.id, 2)
    graph.updateNode(title.id, {
      animation: { ...defaultLayerAnimation(0), style: 'FADE', durationVariableId: slow.id }
    })
    const player = createSlidePlayer(graph, presentedSlides(graph, pageId))
    player.next(0)
    expect(player.moving(1.5)).toBe(true)
    expect(player.moving(2.1)).toBe(false)
  })
})

describe('timed moves', () => {
  test('the last slide has no deadline, so nothing keeps waking the player', () => {
    const { graph, pageId, fourth } = deck()
    transition(graph, fourth.id, {
      ...defaultSlideTransition(),
      timing: { type: 'AFTER_DELAY', delay: 1 }
    })
    const player = createSlidePlayer(graph, presentedSlides(graph, pageId), fourth.id)
    player.start(0)
    expect(player.dueAt()).toBeNull()
  })

  test('a slide left by its timer keeps the steps it had not played hidden as it goes', () => {
    const { graph, pageId, first, title } = deck()
    graph.updateNode(title.id, { animation: defaultLayerAnimation(0) })
    transition(graph, first.id, {
      ...defaultSlideTransition(),
      style: 'PUSH_FROM_RIGHT',
      duration: 1,
      timing: { type: 'AFTER_DELAY', delay: 1 }
    })
    const player = createSlidePlayer(graph, presentedSlides(graph, pageId))
    player.start(0)
    player.tick(1)
    expect(player.moving(1.5)).toBe(true)
    expect(opacity(player, 1.5, title.id)).toBe(0)
  })
})

describe("presenting a design's frames", () => {
  test('the chosen top-level frames, or all of them, present top to bottom then left to right', () => {
    const graph = createDocumentGraph('design', 'light')
    const pageId = graph.getPages()[0].id
    const frame = (name: string, x: number, y: number) =>
      graph.createNode('FRAME', pageId, { name, x, y, width: 100, height: 100 }).id
    const right = frame('Right', 400, 0)
    const left = frame('Left', 0, 0)
    const below = frame('Below', 0, 300)
    graph.createNode('RECTANGLE', pageId, { name: 'Loose' })
    expect(presentedFrames(graph, pageId)).toEqual([left, right, below])
    expect(presentedFrames(graph, pageId, [below, right])).toEqual([right, below])
  })
})
