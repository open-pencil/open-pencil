import { beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { bound, named, VARIABLES } from '#core-tests/helpers/html/kit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { FIXTURES } from '@open-pencil/test-support/paths'

import { readHTMLDocument } from '#core/io/formats/html/import'
import { fontManager } from '#core/text/font/manager'

const FAMILY = 'OpenPencil Field Text'

beforeAll(async () => {
  const font = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
  await fontManager.markLoaded(FAMILY, 'Regular', font)
})

const PAGE = `<style>
  :root { --muted: #888888; --ink: #111111 }
  .dark { --muted: #bbbbbb; --ink: #eeeeee }
  .field { width: 240px; padding: 6px 10px; border: 1px solid #ccc; font: 14px/20px '${FAMILY}'; color: var(--ink) }
  .field::placeholder { color: var(--muted) }
</style>
<input id="email" class="field" placeholder="Email">
<input id="name" class="field" value="Sam">
<textarea id="message" class="field" rows="4" placeholder="Type your message here."></textarea>`

function textIn(graph: SceneGraph, field: string): SceneNode {
  const text = graph
    .flattenTree(named(graph, field).id)
    .map(({ node }) => node)
    .find((node) => node.type === 'TEXT')
  if (!text) throw new Error(`No text in ${field}`)
  return text
}

describe('text fields', () => {
  test('show their placeholder in the color their ::placeholder gives it, in every mode', async () => {
    const { graph } = await readHTMLDocument(PAGE, { variables: VARIABLES })
    const placeholder = textIn(graph, 'email')
    expect(placeholder.text).toBe('Email')
    expect(bound(graph, placeholder, 'fills/0/color')).toBe('muted')
  })

  test('show their value in their own text style', async () => {
    const { graph } = await readHTMLDocument(PAGE, { variables: VARIABLES })
    const value = textIn(graph, 'name')
    expect(value.text).toBe('Sam')
    expect(bound(graph, value, 'fills/0/color')).toBe('ink')
  })

  test('start a placeholder inside the padding, centered in an input and at the top of a textarea', async () => {
    const { graph } = await readHTMLDocument(PAGE)
    const at = (field: string) => {
      const box = graph.getAbsoluteBounds(named(graph, field).id)
      const text = graph.getAbsoluteBounds(textIn(graph, field).id)
      return { x: text.x - box.x, y: text.y - box.y }
    }
    // Inside the 1px border and the 10px and 6px padding.
    expect(at('email')).toEqual({ x: 11, y: 7 })
    expect(at('message')).toEqual({ x: 11, y: 7 })
    expect(named(graph, 'message').height).toBeGreaterThan(80)
  })
})
