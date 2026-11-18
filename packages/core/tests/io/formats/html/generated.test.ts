import { beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { FIXTURES } from '@open-pencil/test-support/paths'

import { readHTMLDocument } from '#core/io/formats/html/import'
import { fontManager } from '#core/text/font/manager'

const FAMILY = 'OpenPencil Generated Text'

beforeAll(async () => {
  const font = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
  await fontManager.markLoaded(FAMILY, 'Regular', font)
})

describe('generated content', () => {
  test('imports ::before and ::after as layers of their own, with their text and boxes', async () => {
    const { graph } = await readHTMLDocument(
      `<style>
        body { margin: 0; font-family: '${FAMILY}'; font-size: 14px }
        .link::after { content: " " attr(data-mark) }
        .rule::before { content: ""; display: block; width: 1px; height: 24px; background: #ccc }
      </style>
      <p><a class="link" data-mark="↗">GitHub</a></p>
      <div class="rule"></div>`
    )
    const layers = graph.flattenTree(graph.getPages()[0].id).map(({ node }) => node)
    const before = layers.find((node) => node.name === '::before')

    // An inline ::after runs on in its element's text, as it does on the page.
    expect(layers.some((node) => node.type === 'TEXT' && node.text === 'GitHub ↗')).toBe(true)
    expect(before).toMatchObject({ width: 1, height: 24 })
    expect(before?.fills[0]?.color).toMatchObject({ r: 0.8, g: 0.8, b: 0.8 })
  })
})
