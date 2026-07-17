import { beforeAll, describe, expect, test } from 'bun:test'

import { initCodec } from '@open-pencil/core'
import { buildFigmaClipboardHTML } from '@open-pencil/core/clipboard'
import { createEditor } from '@open-pencil/core/editor'
import type { ClipboardImageResolution } from '@open-pencil/core/editor'

import { expectDefined } from '#tests/helpers/assert'

const IMAGE_HASH_A = '1111111111111111111111111111111111111111'
const IMAGE_HASH_B = '2222222222222222222222222222222222222222'

async function imageClipboardHtml(hashes: string[]) {
  const source = createEditor()
  const frame = source.graph.createNode('FRAME', source.state.currentPageId, {
    name: 'Images',
    width: 200,
    height: 200
  })
  for (const [index, hash] of hashes.entries()) {
    source.graph.createNode('RECTANGLE', frame.id, {
      name: `Image ${index}`,
      x: index * 20,
      width: 20,
      height: 20,
      fills: [
        {
          type: 'IMAGE',
          imageHash: hash,
          imageScaleMode: 'FILL',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })
  }
  return expectDefined(await buildFigmaClipboardHTML([frame], source.graph), 'Figma clipboard HTML')
}

describe('Figma clipboard images', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('resolves and stores missing images before completing paste', async () => {
    const html = await imageClipboardHtml([IMAGE_HASH_A, IMAGE_HASH_A])
    const imageBytes = new Uint8Array([1, 2, 3])
    const calls: Array<{ fileKey: string; hashes: string[] }> = []
    const resolutions: ClipboardImageResolution[] = []
    const editor = createEditor({
      resolveFigmaClipboardImages: async (fileKey, hashes) => {
        calls.push({ fileKey, hashes })
        return new Map([[IMAGE_HASH_A, imageBytes]])
      }
    })
    editor.onEditorEvent('clipboard:images-missing', (resolution) => {
      resolutions.push(resolution)
    })

    await editor.pasteFromHTML(html)

    expect(calls).toEqual([{ fileKey: 'openpencil', hashes: [IMAGE_HASH_A] }])
    expect(editor.graph.images.get(IMAGE_HASH_A)).toEqual(imageBytes)
    expect(resolutions).toEqual([])
  })

  test('reports images that cannot be fetched without a resolver', async () => {
    const html = await imageClipboardHtml([IMAGE_HASH_A])
    const resolutions: ClipboardImageResolution[] = []
    const editor = createEditor()
    editor.onEditorEvent('clipboard:images-missing', (resolution) => {
      resolutions.push(resolution)
    })

    await editor.pasteFromHTML(html)

    expect(resolutions).toEqual([{ total: 1, missing: 1, fetchAttempted: false }])
  })

  test('stores partial results and reports remaining images', async () => {
    const html = await imageClipboardHtml([IMAGE_HASH_A, IMAGE_HASH_B])
    const editor = createEditor({
      resolveFigmaClipboardImages: async () => new Map([[IMAGE_HASH_A, new Uint8Array([4, 5, 6])]])
    })
    const resolutions: ClipboardImageResolution[] = []
    editor.onEditorEvent('clipboard:images-missing', (resolution) => {
      resolutions.push(resolution)
    })

    await editor.pasteFromHTML(html)

    expect(editor.graph.images.has(IMAGE_HASH_A)).toBe(true)
    expect(editor.graph.images.has(IMAGE_HASH_B)).toBe(false)
    expect(resolutions).toEqual([{ total: 2, missing: 1, fetchAttempted: true }])
  })
})
