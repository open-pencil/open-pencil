import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { materializeDocument, parseFigBuffer } from '@open-pencil/fig'
import type { SceneNode } from '@open-pencil/scene-graph'

test('Gold document exposes effective Boolean assignments and supports editor undo/redo', async () => {
  const parsed = parseFigBuffer(
    await Bun.file(
      new URL('../../../../tests/fixtures/gold-preview.fig', import.meta.url)
    ).arrayBuffer()
  )
  const diagnostics: unknown[] = []
  const { graph, sources } = materializeDocument(parsed.nodeChanges, parsed.blobs, {
    images: new Map(parsed.images),
    derivedBounds: true,
    onUnresolvedProperty: (d) => diagnostics.push(d)
  })
  const inputId = sources.get('1:3503')
  if (!inputId) throw new Error('Missing input')
  const contents: SceneNode[] = []
  const visit = (id: string): void => {
    for (const child of graph.getChildren(id)) {
      if (child.type === 'INSTANCE' && child.name === '_badge-and-tag') contents.push(child)
      visit(child.id)
    }
  }
  visit(inputId)
  expect(contents).toHaveLength(3)
  const first = contents[0]
  expect(first.componentPropertyAssignments['4270:0']).toBe('true')
  expect(first.componentPropertyAssignments['4270:3']).toBe('true')
  const avatar = graph.getChildren(first.id).find((n) => n.name === 'Avatar')
  if (!avatar) throw new Error('Missing avatar')
  const originalComponents = contents.map((node) => {
    const avatar = graph.getChildren(node.id).find((child) => child.name === 'Avatar')
    return avatar?.componentId ? graph.getNode(avatar.componentId)?.name : undefined
  })
  expect(originalComponents).toEqual(['avatar04', 'avatar05', 'avatar06'])
  const originalSizes = contents.map((node) => {
    const avatar = graph.getChildren(node.id).find((child) => child.name === 'Avatar')
    if (!avatar) throw new Error('Missing original avatar')
    return { width: avatar.width, height: avatar.height }
  })
  const originalInput = graph.getNode(inputId)
  if (!originalInput) throw new Error('Missing original input')
  const originalInputSize = { width: originalInput.width, height: originalInput.height }
  const editor = createEditor({ graph })
  editor.setInstanceComponentProperty(first.id, '4270:0', 'false')
  expect(avatar.visible).toBe(false)
  editor.undo.undo()
  expect(avatar.visible).toBe(true)
  editor.undo.redo()
  expect(avatar.visible).toBe(false)
  graph.updateNode(inputId, { name: 'Gold edited input' })
  await initCodec()
  const bytes = await exportFigFile(graph)
  const saved = parseFigBuffer(bytes.buffer as ArrayBuffer)
  const { graph: restored } = materializeDocument(saved.nodeChanges, saved.blobs, {
    images: new Map(saved.images),
    derivedBounds: true
  })
  const input = [...restored.getAllNodes()].find((node) => node.name === 'Gold edited input')
  if (!input) throw new Error('Missing edited input after reload')
  const restoredContents: SceneNode[] = []
  const collect = (id: string): void => {
    for (const child of restored.getChildren(id)) {
      if (child.type === 'INSTANCE' && child.name === '_badge-and-tag') restoredContents.push(child)
      collect(child.id)
    }
  }
  collect(input.id)
  expect(restoredContents).toHaveLength(3)
  expect(
    restoredContents.map(
      (node) =>
        restored
          .getChildren(node.id)
          .find((child) =>
            child.componentPropertyReferences.some(
              (ref) => ref.propertyId === '4270:0' && ref.field === 'VISIBLE'
            )
          )?.visible
    )
  ).toEqual([false, true, true])
  expect(
    restoredContents.map((node) => {
      const avatar = restored
        .getChildren(node.id)
        .find((child) =>
          child.componentPropertyReferences.some(
            (ref) => ref.propertyId === '4270:0' && ref.field === 'VISIBLE'
          )
        )
      return avatar?.componentId ? restored.getNode(avatar.componentId)?.name : undefined
    })
  ).toEqual(originalComponents)
  expect({ width: input.width, height: input.height }).toEqual(originalInputSize)
  expect(
    restoredContents.map((node) => {
      const avatar = restored
        .getChildren(node.id)
        .find((child) =>
          child.componentPropertyReferences.some(
            (ref) => ref.propertyId === '4270:0' && ref.field === 'VISIBLE'
          )
        )
      if (!avatar) throw new Error('Missing restored avatar')
      return { width: avatar.width, height: avatar.height }
    })
  ).toEqual(originalSizes)
  const reopenedEditor = createEditor({ graph: restored })
  reopenedEditor.setInstanceComponentProperty(restoredContents[1].id, '4270:0', 'false')
  const secondAvatar = restored
    .getChildren(restoredContents[1].id)
    .find((child) =>
      child.componentPropertyReferences.some(
        (ref) => ref.propertyId === '4270:0' && ref.field === 'VISIBLE'
      )
    )
  if (!secondAvatar) throw new Error('Missing reopened avatar target')
  expect(secondAvatar.visible).toBe(false)
  reopenedEditor.undo.undo()
  expect(secondAvatar.visible).toBe(true)
  expect(graph.getChildren(contents[1].id).find((n) => n.name === 'Avatar')?.visible).toBe(true)
})
