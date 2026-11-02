import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { commandCandidates, referenceCandidates } from '@/app/ai/chat/references/candidates'
import { resolveReference } from '@/app/ai/chat/references/resolve'

import { skillFixture } from '#tests/helpers/chat/skills'

function document() {
  const graph = new SceneGraph()
  const [home] = graph.getPages()
  if (!home) throw new Error('Expected a page')
  const checkout = graph.addPage('Checkout')
  const hero = graph.createNode('FRAME', home.id, { name: 'Hero' })
  graph.createNode('TEXT', hero.id, { name: 'Title' })
  graph.createNode('FRAME', checkout.id, { name: 'Summary' })
  return { graph, home, checkout, hero }
}

describe('reference candidates', () => {
  test('lists the current page’s layers first, then other pages’, pages, and skills', () => {
    const { graph, checkout } = document()
    const candidates = referenceCandidates(graph, checkout.id, [skillFixture()])
    expect(
      candidates.map(({ reference, detail }) => [reference.kind, reference.label, detail])
    ).toEqual([
      ['node', 'Summary', null],
      ['node', 'Hero', 'Page 1'],
      ['node', 'Title', 'Hero · Page 1'],
      ['page', 'Page 1', null],
      ['page', 'Checkout', null],
      ['skill', 'grid', null]
    ])
  })

  test('the query narrows layers before the cap, so any layer can be reached', () => {
    const graph = new SceneGraph()
    const [page] = graph.getPages()
    if (!page) throw new Error('Expected a page')
    for (let index = 0; index < 600; index++)
      graph.createNode('RECTANGLE', page.id, { name: `Box ${index}` })
    const footer = graph.createNode('FRAME', page.id, { name: 'Footer' })
    const found = referenceCandidates(graph, page.id, [], 'foot')
    expect(found.map(({ reference }) => reference.id)).toEqual([footer.id])
  })

  test('commands are an ACP agent’s own, or else the skills the user can run', () => {
    const skills = [skillFixture(), skillFixture({ name: 'auto', userInvocable: false })]
    expect(commandCandidates(null, skills).map((command) => command.insert)).toEqual([
      '/skill:grid '
    ])
    expect(
      commandCandidates([{ name: 'review', description: 'Review', hint: null }], skills).map(
        (command) => command.insert
      )
    ).toEqual(['/review '])
  })
})

describe('resolveReference', () => {
  test('follows renames, and falls back to the written label for what is gone', () => {
    const { graph, hero, checkout } = document()
    graph.updateNode(hero.id, { name: 'Hero banner' })
    const skills = new Set(['grid'])
    expect(
      resolveReference({ graph }, { kind: 'node', id: hero.id, label: 'Hero' }, skills)
    ).toMatchObject({
      name: 'Hero banner',
      present: true
    })
    expect(
      resolveReference({ graph }, { kind: 'node', id: '9:9', label: 'Old' }, skills)
    ).toMatchObject({
      name: 'Old',
      present: false
    })
    // A page is not a layer, nor a layer a page.
    expect(
      resolveReference({ graph }, { kind: 'node', id: checkout.id, label: 'x' }, skills).present
    ).toBe(false)
    expect(
      resolveReference({ graph }, { kind: 'page', id: checkout.id, label: 'x' }, skills).name
    ).toBe('Checkout')
    // Another document's conversation resolves nothing by ID.
    expect(
      resolveReference(null, { kind: 'node', id: hero.id, label: 'Hero' }, skills).present
    ).toBe(false)
    expect(
      resolveReference(null, { kind: 'skill', id: 'grid', label: 'grid' }, skills).present
    ).toBe(true)
  })
})
