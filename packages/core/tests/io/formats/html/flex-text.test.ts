import { beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { FIXTURES } from '@open-pencil/test-support/paths'

import { readHTMLDocument } from '#core/io/formats/html/import'
import { fontManager } from '#core/text/font/manager'

const FAMILY = 'OpenPencil Flex Text'

beforeAll(async () => {
  const font = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
  await fontManager.markLoaded(FAMILY, 'Regular', font)
})

describe('text among the items of a flex container', () => {
  test('wraps beside them in the room they leave, as a browser wraps it', async () => {
    const { graph } = await readHTMLDocument(
      `<div style="width:220px;font-family:'${FAMILY}'"><p style="display:flex;gap:8px;font-size:14px;line-height:1.5;margin:0"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M0 0h24v24H0z"/></svg>This is the app's own tour, a real .fig file. Open a chapter in the layers and click around.</p></div>`
    )
    const text = graph
      .flattenTree(graph.getPages()[0].id)
      .find(({ node }) => node.type === 'TEXT')?.node

    // The row is 220px; the icon and the gap take 24px, so the text wraps within the rest.
    expect(text?.textAutoResize).toBe('HEIGHT')
    expect(text?.width).toBeLessThanOrEqual(196)
    expect(text?.height).toBeGreaterThan(21 * 2)
  })

  test('leaves an item that became text in its own box, beside the run of text', async () => {
    const { graph } = await readHTMLDocument(
      `<p style="display:flex;width:300px;margin:0;font:14px '${FAMILY}'">Label <span>Value</span></p>`
    )
    const texts = graph
      .flattenTree(graph.getPages()[0].id)
      .flatMap(({ node }) => (node.type === 'TEXT' ? [node] : []))
    const label = texts.find((text) => text.text.trim() === 'Label')
    const value = texts.find((text) => text.text === 'Value')
    const labelAt = graph.getAbsolutePosition(label?.id ?? '')
    const valueAt = graph.getAbsolutePosition(value?.id ?? '')

    // The span follows the label, which ends in a space the row drops, rather than lying over it.
    expect(valueAt.x).toBeGreaterThan(labelAt.x + (label?.width ?? 0) / 2)
  })
})
