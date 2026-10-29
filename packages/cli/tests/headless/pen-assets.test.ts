import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { toUint8Array } from 'js-base64'

import { loadDocument } from '#cli/headless'

// A 2 × 1 PNG.
const PNG = toUint8Array(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAADElEQVR4nGP8zwACAAYIAQFazwZIAAAAAElFTkSuQmCC'
)

const root = await mkdtemp(join(tmpdir(), 'pen-assets-'))
afterAll(() => rm(root, { recursive: true, force: true }))

describe('loadDocument — .pen images', () => {
  test('reads images beside the document, but nothing outside its folder', async () => {
    const folder = join(root, 'doc')
    await mkdir(join(folder, 'images'), { recursive: true })
    await writeFile(join(folder, 'images', 'inside.png'), PNG)
    await writeFile(join(root, 'outside.png'), PNG)
    await symlink(join(root, 'outside.png'), join(folder, 'linked.png'))
    const image = (id: string, url: string) => ({
      id,
      type: 'rectangle',
      width: 20,
      height: 10,
      fill: { type: 'image', url }
    })
    await writeFile(
      join(folder, 'doc.pen'),
      JSON.stringify({
        version: '2.21',
        children: [
          image('inside', './images/inside.png'),
          image('parent', '../outside.png'),
          image('linked', 'linked.png')
        ]
      })
    )

    const graph = await loadDocument(join(folder, 'doc.pen'))

    expect(graph.getNode('inside')?.fills[0]?.type).toBe('IMAGE')
    expect(graph.getNode('parent')?.fills).toEqual([])
    expect(graph.getNode('linked')?.fills).toEqual([])
  })
})
