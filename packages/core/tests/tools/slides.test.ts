import { describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import { createDocumentGraph } from '@open-pencil/core'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { slideRows } from '@open-pencil/scene-graph/slides'

import { createSlides, getDeck, moveSlides, setAnimations, setSlides } from '#core/tools/slides'

/** A new deck, its one slide holding a title, and the API tools run against. */
function deck() {
  const graph = createDocumentGraph('slides', 'light')
  const figma = new FigmaAPI(graph)
  const [first] = slideRows(graph, figma.currentPage.id).flat()
  const title = graph.createNode('TEXT', first.id, { name: 'Title', text: 'Quarterly results' })
  return { graph, figma, first: first.id, title: title.id }
}

const outlineSchema = v.object({
  sections: v.array(
    v.object({
      id: v.string(),
      slides: v.array(
        v.looseObject({
          id: v.string(),
          number: v.nullable(v.number()),
          animations: v.array(
            v.looseObject({ name: v.string(), direction: v.nullable(v.string()) })
          )
        })
      )
    })
  )
})
const madeSchema = v.object({ slides: v.array(v.string()) })

async function outline(figma: FigmaAPI) {
  return v.parse(outlineSchema, await getDeck.execute(figma, {})).sections
}

/** The IDs of the slides a call made. */
async function made(result: unknown): Promise<string[]> {
  return v.parse(madeSchema, await result).slides
}

describe('slide tools', () => {
  test('slides are created after one or in a new section, numbered by their place', async () => {
    const { figma, first } = deck()
    await made(createSlides.execute(figma, { count: 2, after: first }))
    const section = await made(createSlides.execute(figma, { newSection: true }))
    const sections = await outline(figma)
    expect(sections.map((row) => row.slides.map((slide) => slide.number))).toEqual([[1, 2, 3], [4]])
    expect(sections[1].slides[0].id).toBe(section[0])
  })

  test('slides move after another and empty sections go away', async () => {
    const { figma, first } = deck()
    const [second, third] = await made(createSlides.execute(figma, { count: 2 }))
    await moveSlides.execute(figma, { slides: [third], newSection: true })
    await moveSlides.execute(figma, { slides: [third, first], after: second })
    const sections = await outline(figma)
    expect(sections.map((row) => row.slides.map((slide) => slide.id))).toEqual([
      [second, third, first]
    ])
  })

  test('notes, skipping, and a transition following a variable read back from the outline', async () => {
    const { graph, figma, first } = deck()
    const motion = graph.createCollection('Motion')
    graph.createVariable('Slow', 'TIMING', motion.id, 1.2)
    await createSlides.execute(figma, {})
    await setSlides.execute(figma, {
      slides: [first],
      notes: 'Open with the numbers',
      transition: { style: 'PUSH', direction: 'UP', duration: { variable: 'Slow' }, delay: 4 }
    })
    const [[slide, next]] = (await outline(figma)).map((row) => row.slides)
    expect(slide).toMatchObject({
      notes: 'Open with the numbers',
      text: ['Quarterly results'],
      transition: { style: 'PUSH', direction: 'UP', duration: { variable: 'Slow' }, delay: 4 }
    })
    await setSlides.execute(figma, { slides: [next.id], skipped: true })
    expect((await outline(figma))[0].slides[1].number).toBeNull()
  })

  test('layers animate as steps in the order given, and stop with null', async () => {
    const { graph, figma, first, title } = deck()
    const box = graph.createNode('RECTANGLE', first, { name: 'Box' }).id
    await setAnimations.execute(figma, {
      layers: [box, title],
      animation: { style: 'SLIDE', direction: 'UP', duration: 0.4, easing: 'ease-out' }
    })
    let [{ slides }] = await outline(figma)
    expect(slides[0].animations.map(({ name, direction }) => [name, direction])).toEqual([
      ['Box', 'UP'],
      ['Title', 'UP']
    ])
    await setAnimations.execute(figma, { layers: [box], animation: null })
    ;[{ slides }] = await outline(figma)
    expect(slides[0].animations.map(({ name }) => name)).toEqual(['Title'])
  })

  test('a layer inside an instance animates as its instance, which the result names', async () => {
    const { graph, figma, first } = deck()
    const card = graph.createNode('COMPONENT', first, { name: 'Card' })
    graph.createNode('ELLIPSE', card.id, { name: 'Dot' })
    const instance = graph.createInstance(card.id, first)
    if (!instance) throw new Error('No instance')
    const [inner] = graph.getChildren(instance.id)
    const result = await setAnimations.execute(figma, { layers: [inner.id], animation: {} })
    expect(result).toEqual({ layers: [instance.id] })
  })

  test('a page without slides is reported', async () => {
    const figma = new FigmaAPI(createDocumentGraph('design', 'light'))
    expect(await getDeck.execute(figma, {})).toEqual({
      error: 'The current page has no slides; open a deck (.deck) or a page with slides'
    })
  })
})
