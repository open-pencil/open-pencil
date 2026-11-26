import { beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { FIXTURES } from '@open-pencil/test-support/paths'

import { readHTMLDocument } from '#core/io/formats/html/import'
import { fontManager } from '#core/text/font/manager'

const FAMILY = 'OpenPencil Direction Sans'

beforeAll(async () => {
  const font = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
  await fontManager.markLoaded(FAMILY, 'Regular', font)
})

async function importedText(attributes: string) {
  const { graph } = await readHTMLDocument(
    `<p ${attributes} style="width:300px;margin:0;font:14px '${FAMILY}'">Hello world</p>`
  )
  const text = graph.flattenTree(graph.getPages()[0].id).find(({ node }) => node.type === 'TEXT')
  return text?.node
}

describe('text direction and alignment from a page', () => {
  test('keeps a right-to-left direction and starts its text at the right', async () => {
    const text = await importedText('dir="rtl"')
    expect(text?.textDirection).toBe('RTL')
    expect(text?.textAlignHorizontal).toBe('RIGHT')
  })

  test('keeps the side a right-to-left paragraph is aligned to', async () => {
    const { graph } = await readHTMLDocument(
      `<p dir="rtl" style="width:300px;margin:0;text-align:left;font:14px '${FAMILY}'">Hello world</p>`
    )
    const text = graph.flattenTree(graph.getPages()[0].id).find(({ node }) => node.type === 'TEXT')
    expect(text?.node.textDirection).toBe('RTL')
    expect(text?.node.textAlignHorizontal).toBe('LEFT')
  })

  test('leaves left-to-right text in its automatic direction, at the left', async () => {
    const text = await importedText('')
    expect(text?.textDirection).toBe('AUTO')
    expect(text?.textAlignHorizontal).toBe('LEFT')
  })
})
