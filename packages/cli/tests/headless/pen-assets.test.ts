import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { computeImageHash } from '@open-pencil/scene-graph'

import { loadDocument } from '#cli/headless'

setDefaultTimeout(60_000)

/** A tiny but real PNG signature, so the reader has bytes to name. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 11, 12, 13])

async function writePenWithAsset(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-pen-assets-'))
  await mkdir(join(dir, 'assets'), { recursive: true })
  await writeFile(join(dir, 'assets', 'hero.png'), PNG)
  const penPath = join(dir, 'doc.pen')
  await writeFile(
    penPath,
    JSON.stringify({
      version: '2.8',
      children: [
        {
          type: 'frame',
          id: 'f1',
          name: 'Hero',
          width: 100,
          height: 100,
          fill: { type: 'image', enabled: true, url: 'assets/hero.png', mode: 'fit' }
        }
      ]
    })
  )
  return penPath
}

describe('loading a .pen document from disk', () => {
  test('reads the image assets it references relative to itself', async () => {
    const graph = await loadDocument(await writePenWithAsset())
    const hero = [...graph.getAllNodes()].find(
      (node) => node.name === 'Hero' && node.type !== 'CANVAS'
    )

    expect(hero?.fills[0]?.type).toBe('IMAGE')
    expect(hero?.fills[0]?.imageHash).toBe(computeImageHash(PNG))
  })

  test('keeps the asset bytes in the graph, so a renderer can draw them', async () => {
    const graph = await loadDocument(await writePenWithAsset())

    expect(graph.images.get(computeImageHash(PNG))).toEqual(PNG)
  })

  test('opens an asset it cannot read without failing the whole document', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-pen-missing-'))
    const penPath = join(dir, 'doc.pen')
    await writeFile(
      penPath,
      JSON.stringify({
        version: '2.8',
        children: [
          {
            type: 'frame',
            id: 'f1',
            name: 'Hero',
            width: 100,
            height: 100,
            fill: { type: 'image', enabled: true, url: 'assets/gone.png', mode: 'fit' }
          }
        ]
      })
    )

    const graph = await loadDocument(penPath)

    expect([...graph.getAllNodes()].some((node) => node.name === 'Hero')).toBe(true)
    expect(graph.images.size).toBe(0)
  })

  test('opens the document when an asset exists but cannot be read', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-pen-unreadable-'))
    // A directory where the document expects a file: it exists, and reading it fails.
    await mkdir(join(dir, 'assets', 'hero.png'), { recursive: true })
    const penPath = join(dir, 'doc.pen')
    await writeFile(
      penPath,
      JSON.stringify({
        version: '2.8',
        children: [
          {
            type: 'frame',
            id: 'f1',
            name: 'Hero',
            width: 100,
            height: 100,
            fill: { type: 'image', enabled: true, url: 'assets/hero.png', mode: 'fit' }
          }
        ]
      })
    )

    const graph = await loadDocument(penPath)

    expect([...graph.getAllNodes()].some((node) => node.name === 'Hero')).toBe(true)
    expect(graph.images.size).toBe(0)
  })
})
