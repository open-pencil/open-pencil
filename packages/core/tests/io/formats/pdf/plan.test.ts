import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'

import { MAX_PDF_PAGES, PDFPlanError, planPDFPages } from '#core/io/formats/pdf/plan'

/** Page "Cards" (Front, Back, hidden Draft), page "Posters" (Poster), empty page "Blank". */
function document() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const cards = figma.currentPage
  cards.name = 'Cards'
  const front = figma.createFrame()
  front.name = 'Front'
  const back = figma.createFrame()
  back.name = 'Back'
  const draft = figma.createFrame()
  draft.name = 'Draft'
  draft.visible = false
  const posters = figma.createPage()
  posters.name = 'Posters'
  figma.currentPage = posters
  const poster = figma.createFrame()
  poster.name = 'Poster'
  const blank = figma.createPage()
  blank.name = 'Blank'
  figma.currentPage = cards
  return { graph, figma, cards, posters, blank, front, back, draft, poster }
}

describe('planPDFPages', () => {
  test('single puts every visible top-level node on one page, or just the ids given', () => {
    const { graph, cards, front, back } = document()
    const all = planPDFPages(graph, { mode: 'single', currentPageId: cards.id })
    expect(all).toEqual([{ pageId: cards.id, nodeIds: [front.id, back.id] }])

    const some = planPDFPages(graph, { mode: 'single', ids: [back.id], currentPageId: cards.id })
    expect(some).toEqual([{ pageId: cards.id, nodeIds: [back.id] }])
  })

  test('frames makes one page per frame, named after it', () => {
    const { graph, cards, front, back } = document()
    const specs = planPDFPages(graph, { mode: 'frames', currentPageId: cards.id })
    expect(specs.map((spec) => [spec.label, spec.nodeIds])).toEqual([
      ['Front', [front.id]],
      ['Back', [back.id]]
    ])
  })

  test('frames follows the order of the ids and finds the design page of each', () => {
    const { graph, cards, posters, front, poster } = document()
    const specs = planPDFPages(graph, {
      mode: 'frames',
      ids: [poster.id, front.id],
      currentPageId: cards.id
    })
    expect(specs.map((spec) => spec.pageId)).toEqual([posters.id, cards.id])
  })

  test('frames finds the design page of a nested node', () => {
    const { graph, figma, cards, front } = document()
    const inner = figma.createFrame()
    inner.name = 'Inner'
    front.appendChild(inner)
    const [spec] = planPDFPages(graph, { mode: 'frames', ids: [inner.id], currentPageId: cards.id })
    expect(spec).toEqual({ pageId: cards.id, nodeIds: [inner.id], label: 'Inner' })
  })

  test('pages makes one page per design page and skips empty ones', () => {
    const { graph, cards, front, back, poster } = document()
    const specs = planPDFPages(graph, { mode: 'pages', currentPageId: cards.id })
    expect(specs.map((spec) => [spec.label, spec.nodeIds])).toEqual([
      ['Cards', [front.id, back.id]],
      ['Posters', [poster.id]]
    ])
  })

  test('pages follows page_ids in the order given', () => {
    const { graph, cards, posters } = document()
    const specs = planPDFPages(graph, {
      mode: 'pages',
      pageIds: [posters.id, cards.id],
      currentPageId: cards.id
    })
    expect(specs.map((spec) => spec.label)).toEqual(['Posters', 'Cards'])
  })

  test('names a missing node or page', () => {
    const { graph, cards } = document()
    expect(() =>
      planPDFPages(graph, { mode: 'frames', ids: ['9:9'], currentPageId: cards.id })
    ).toThrow('Node "9:9" not found')
    expect(() =>
      planPDFPages(graph, { mode: 'pages', pageIds: ['9:9'], currentPageId: cards.id })
    ).toThrow('Page "9:9" not found')
  })

  test('rejects a request that exports nothing', () => {
    const { graph, blank, cards } = document()
    expect(() =>
      planPDFPages(graph, { mode: 'pages', pageIds: [blank.id], currentPageId: cards.id })
    ).toThrow(PDFPlanError)
    expect(() => planPDFPages(graph, { mode: 'single', currentPageId: blank.id })).toThrow(
      'No visible nodes to export'
    )
  })

  test('rejects more pages than a PDF may hold', () => {
    const { graph, figma, cards } = document()
    for (let i = 0; i < MAX_PDF_PAGES; i++) figma.createFrame()
    expect(() => planPDFPages(graph, { mode: 'frames', currentPageId: cards.id })).toThrow(
      /limit is 200/
    )
  })
})
