import { describe, expect, test } from 'bun:test'

import { parsePenFile, type PenNode } from '@open-pencil/pen'

function at<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a value')
  return value
}

/**
 * A component holding a text, a second component holding an instance of the first, and an
 * instance of the second. Pencil addresses the inner text of that instance either directly or by
 * the `parent/child` path it takes to reach it.
 */
function nestedDocument(descendants: Record<string, Partial<PenNode>>): string {
  return JSON.stringify({
    version: '2.8',
    children: [
      {
        type: 'frame',
        id: 'innerComp',
        name: 'Badge',
        reusable: true,
        width: 20,
        height: 20,
        children: [
          { type: 'text', id: 'badgeLabel', name: 'Label', content: 'A', width: 10, height: 10 }
        ]
      },
      {
        type: 'frame',
        id: 'outerComp',
        name: 'Card',
        reusable: true,
        width: 100,
        height: 100,
        children: [
          { type: 'ref', id: 'outerRef', name: 'Badge instance', ref: 'innerComp' },
          { type: 'text', id: 'cardTitle', name: 'Title', content: 'T', width: 40, height: 10 }
        ]
      },
      {
        type: 'ref',
        id: 'inst',
        name: 'Card instance',
        ref: 'outerComp',
        width: 100,
        height: 100,
        descendants
      }
    ]
  })
}

/** Every text inside the named instance, in tree order. */
function textsInside(json: string, instanceName: string): string[] {
  const graph = parsePenFile(json)
  const instance = at(
    [...graph.getAllNodes()].find((node) => node.name === instanceName && node.type === 'INSTANCE')
  )
  const texts: string[] = []
  const walk = (nodeId: string) => {
    const node = graph.getNode(nodeId)
    if (!node) return
    if (node.type === 'TEXT') texts.push(node.text)
    for (const childId of node.childIds) walk(childId)
  }
  for (const childId of instance.childIds) walk(childId)
  return texts
}

describe('a descendant override keyed by a plain node id', () => {
  test('still applies to the matching descendant', () => {
    const json = nestedDocument({ cardTitle: { content: 'Overridden' } })

    expect(textsInside(json, 'Card instance')).toContain('Overridden')
  })
})

describe('a descendant override keyed by a parent/child path', () => {
  test('applies to the node the path reaches', () => {
    const json = nestedDocument({ 'outerRef/badgeLabel': { content: 'Z' } })

    expect(textsInside(json, 'Card instance')).toContain('Z')
  })

  test('leaves the text alone when the path reaches nothing', () => {
    const json = nestedDocument({ 'noSuchNode/badgeLabel': { content: 'Z' } })

    expect(textsInside(json, 'Card instance')).not.toContain('Z')
  })
})

/**
 * A component whose only child paints from a variable, and an instance of it. Overriding that
 * child's fill replaces the paint, so the variable the component bound no longer describes it.
 */
function variableBoundDocument(override: Record<string, string>): string {
  return JSON.stringify({
    version: '2.8',
    variables: {
      '--brand': { type: 'color', value: '#144633' },
      '--onbrand': { type: 'color', value: '#FFFFFF' }
    },
    children: [
      {
        type: 'frame',
        id: 'logoComp',
        name: 'Logo',
        reusable: true,
        width: 100,
        height: 40,
        children: [
          {
            type: 'path',
            id: 'mark',
            name: 'Mark',
            geometry: 'M0 0L10 0L10 10Z',
            width: 100,
            height: 40,
            fill: '$--brand'
          }
        ]
      },
      {
        type: 'ref',
        id: 'logoInst',
        name: 'Logo instance',
        ref: 'logoComp',
        width: 100,
        height: 40,
        descendants: { mark: override }
      }
    ]
  })
}

function markFill(json: string): string {
  const graph = parsePenFile(json)
  const instance = at(
    [...graph.getAllNodes()].find(
      (node) => node.name === 'Logo instance' && node.type === 'INSTANCE'
    )
  )
  const mark = at(instance.childIds.map((id) => graph.getNode(id))[0])
  return at(mark.fills[0]).color.r === 1 ? 'white' : 'brand'
}

describe('an override that replaces a variable-bound fill', () => {
  test('keeps the paint the override names instead of the one the component bound', () => {
    expect(markFill(variableBoundDocument({ fill: '#FFFFFF' }))).toBe('white')
  })

  test('still follows a variable when the override itself names one', () => {
    expect(markFill(variableBoundDocument({ fill: '$--onbrand' }))).toBe('white')
  })

  test('keeps the component paint when there is no override', () => {
    expect(markFill(variableBoundDocument({}))).toBe('brand')
  })
})
