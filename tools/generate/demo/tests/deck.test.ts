import { beforeAll, describe, expect, test } from 'bun:test'

import { buildDemoDeck } from '#demo/deck/build'
import { DECK_SECTIONS, MOTION_VARIABLES } from '#demo/deck/names'

import { slideIslandRoots } from '@open-pencil/core'
import { populateAllFigPages, readFigFile } from '@open-pencil/core/io/formats/fig'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { slideBuild, slideRows, slideSettings } from '@open-pencil/scene-graph/slides'

let graph: SceneGraph
let sections: SceneNode[][]
let slides: SceneNode[]

beforeAll(async () => {
  // The .deck the gallery publishes.
  graph = await readFigFile(new File([(await buildDemoDeck()).slice()], 'Lumen 2 launch.deck'))
  populateAllFigPages(graph)
  const [page] = graph.getPages()
  sections = slideRows(graph, page.id)
  slides = sections.flat()
})

/** The variable a slide's background color follows, by name. */
function background(slide: SceneNode): string | undefined {
  const id = slide.boundVariables['fills/0/color']
  return id ? graph.variables.get(id)?.name : undefined
}

describe('demo deck', () => {
  test('opens as a deck in its sections, numbered, with the appendix skipped', () => {
    expect(graph.documentKind).toBe('slides')
    expect(sections.map((section) => section.length)).toEqual(
      DECK_SECTIONS.map((section) => section.length)
    )
    expect(slides.map((slide) => slide.name)).toEqual(['1', '2', '3', '4', '5', '6', '7', '-'])
    expect(slides.map((slide) => slideSettings(slide)?.skipped)).toEqual([
      ...Array.from({ length: 7 }, () => false),
      true
    ])
    expect(slides.every((slide) => slideSettings(slide)?.notes)).toBe(true)
  })

  test("follows the tour's Theme: every slide's background is its Page color", () => {
    expect(slides.map(background)).toEqual(slides.map(() => 'Page'))
    const collections = [...graph.variableCollections.values()].map((collection) => collection.name)
    expect(collections).toContain('Theme')
  })

  test('runs the real player, with its controls live on the slides that show it', () => {
    const [, , covers, controls] = slides
    expect(slideIslandRoots(graph, covers.id)).toHaveLength(1)
    expect(slideIslandRoots(graph, controls.id).length).toBeGreaterThan(0)
  })

  test('builds its agenda from one click and its numbers one click each', () => {
    const [, agenda, , , , numbers] = slides
    expect(slideBuild(graph, agenda.id).map((step) => step.layers.length)).toEqual([4])
    expect(slideBuild(graph, numbers.id).map((step) => step.onClick)).toEqual([true, true, true])
  })

  test('times the cover and eases the agenda by Motion variables', () => {
    const [cover, agenda] = slides
    const name = (id: string | undefined) => (id ? graph.variables.get(id)?.name : undefined)
    expect(name(slideSettings(cover)?.transition?.durationVariableId)).toBe(MOTION_VARIABLES.slow)
    expect(name(slideSettings(agenda)?.transition?.easingVariableId)).toBe(MOTION_VARIABLES.bouncy)
  })
})
