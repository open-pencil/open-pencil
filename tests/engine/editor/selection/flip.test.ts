import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'
import { createRect, firstPageId } from '#tests/helpers/scene'

describe('flip', () => {
  test('flipX defaults to false', () => {
    const graph = new SceneGraph()
    const node = createRect(graph, firstPageId(graph))
    expect(node.flipX).toBe(false)
    expect(node.flipY).toBe(false)
  })

  test('flipX can be set via updateNode', () => {
    const graph = new SceneGraph()
    const node = createRect(graph, firstPageId(graph))
    graph.updateNode(node.id, { flipX: true })
    expect(getNodeOrThrow(graph, node.id).flipX).toBe(true)
    expect(getNodeOrThrow(graph, node.id).flipY).toBe(false)
  })

  test('flipY can be set via updateNode', () => {
    const graph = new SceneGraph()
    const node = createRect(graph, firstPageId(graph))
    graph.updateNode(node.id, { flipY: true })
    expect(getNodeOrThrow(graph, node.id).flipX).toBe(false)
    expect(getNodeOrThrow(graph, node.id).flipY).toBe(true)
  })

  test('flip toggles', () => {
    const graph = new SceneGraph()
    const node = createRect(graph, firstPageId(graph))
    graph.updateNode(node.id, { flipX: true })
    expect(getNodeOrThrow(graph, node.id).flipX).toBe(true)
    graph.updateNode(node.id, { flipX: false })
    expect(getNodeOrThrow(graph, node.id).flipX).toBe(false)
  })
})

describe('flip roundtrip via kiwi', () => {
  async function roundtrip(graph: SceneGraph) {
    const { initCodec } = await import('#core/kiwi/binary/codec')
    const { parseFigFile } = await import('#core/kiwi/fig/file')
    const { exportFigFile } = await import('#core/io/formats/fig/export')
    await initCodec()
    const buf = await exportFigFile(graph)
    return parseFigFile(buf)
  }

  function findChild(graph: SceneGraph, name: string) {
    const pages = graph.getPages()
    const children = graph.getChildren(pages[0].id)
    return children.find((c) => c.name === name)
  }

  test('flipX preserved through export/import', async () => {
    const graph = new SceneGraph()
    const page = firstPageId(graph)
    createRect(graph, page, { name: 'Flipped', x: 50, y: 50, width: 100, height: 80 })
    graph.updateNode(
      expectDefined(
        graph.getChildren(page).find((n) => n.name === 'Flipped'),
        'flipped node'
      ).id,
      { flipX: true }
    )

    const imported = await roundtrip(graph)
    const found = findChild(imported, 'Flipped')
    const foundNode = expectDefined(found, 'roundtripped node')
    expect(foundNode.flipX).toBe(true)
  })

  test('non-flipped node stays non-flipped', async () => {
    const graph = new SceneGraph()
    createRect(graph, firstPageId(graph), {
      name: 'Normal',
      x: 100,
      y: 50,
      width: 200,
      height: 100
    })

    const imported = await roundtrip(graph)
    const found = findChild(imported, 'Normal')
    const foundNode = expectDefined(found, 'roundtripped node')
    expect(foundNode.flipX).toBe(false)
  })

  test('flipX with rotation preserved', async () => {
    const graph = new SceneGraph()
    const page = firstPageId(graph)
    createRect(graph, page, { name: 'RotFlip', x: 0, y: 0, width: 100, height: 100 })
    graph.updateNode(
      expectDefined(
        graph.getChildren(page).find((n) => n.name === 'RotFlip'),
        'rotated flipped node'
      ).id,
      {
        flipX: true,
        rotation: 45
      }
    )

    const imported = await roundtrip(graph)
    const found = findChild(imported, 'RotFlip')
    const foundNode = expectDefined(found, 'roundtripped node')
    expect(foundNode.flipX).toBe(true)
    expect(Math.round(foundNode.rotation)).toBe(45)
  })
})
