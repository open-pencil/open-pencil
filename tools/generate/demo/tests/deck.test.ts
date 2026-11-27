import { beforeAll, describe, expect, test } from 'bun:test'

import { buildDemoDeck } from '#demo/deck/build'
import { MOTION_VARIABLES } from '#demo/deck/names'

import { populateAllFigPages, readFigFile } from '@open-pencil/core/io/formats/fig'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { readBehaviour } from '@open-pencil/scene-graph/behaviours'
import { slideBuild, slideRows, slideSettings } from '@open-pencil/scene-graph/slides'

let graph: SceneGraph
let sections: SceneNode[][]

beforeAll(async () => {
  // The .deck the gallery publishes.
  graph = await readFigFile(new File([(await buildDemoDeck()).slice()], 'Presenting.deck'))
  populateAllFigPages(graph)
  const [page] = graph.getPages()
  sections = slideRows(graph, page.id)
})

describe('demo deck', () => {
  test('opens as a deck of numbered slides in four sections, the last one skipped', () => {
    expect(graph.documentKind).toBe('slides')
    expect(sections.map((section) => section.map((slide) => slide.name))).toEqual([
      ['1'],
      ['2', '3', '4', '5'],
      ['6'],
      ['-']
    ])
    const slides = sections.flat()
    expect(slides.map((slide) => slideSettings(slide)?.skipped)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true
    ])
    expect(slides.every((slide) => slideSettings(slide)?.notes)).toBe(true)
  })

  test('moves on with transitions and builds its second slide in three clicks', () => {
    const [title, build] = sections.flat()
    expect(slideSettings(title)?.transition?.style).toBe('PUSH_FROM_RIGHT')
    const steps = slideBuild(graph, build.id)
    expect(steps.map((step) => step.onClick)).toEqual([true, true, true])
    expect(steps.map((step) => step.layers[0]?.animation.style)).toEqual([
      'SLIDE_FROM_LEFT',
      'SLIDE_FROM_BOTTOM',
      'FADE'
    ])
  })

  test('places a live switch whose main component waits on the skipped slide', () => {
    const slides = sections.flat()
    const instance = graph.getChildren(slides[2].id).find((node) => node.type === 'INSTANCE')
    const main = instance?.componentId ? graph.getNode(instance.componentId) : undefined
    const set = main?.parentId ? graph.getNode(main.parentId) : undefined
    expect(set && readBehaviour(set)?.kind).toBe('switch')
    expect(set?.parentId).toBe(slides[6].id)
  })

  test('times its fourth slide and eases it by Motion variables', () => {
    const motion = sections.flat()[3]
    const transition = slideSettings(motion)?.transition
    const name = (id: string | undefined) => (id ? graph.variables.get(id)?.name : undefined)
    expect(name(transition?.durationVariableId)).toBe(MOTION_VARIABLES.slow)
    expect(name(transition?.easingVariableId)).toBe(MOTION_VARIABLES.bouncy)
    const [step] = slideBuild(graph, motion.id)
    expect(name(step?.layers[0]?.animation.easingVariableId)).toBe(MOTION_VARIABLES.bouncy)
  })
})
