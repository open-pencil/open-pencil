import { describe, expect, test } from 'bun:test'

import { materializeDocument } from '@open-pencil/fig'

import { canvas, doc, node } from '../helpers'

describe('fig-import: clipsContent with resizeToFit', () => {
  test('regular FRAME with frameMaskDisabled=false clips content', () => {
    const graph = materializeDocument([
      doc(),
      canvas(),
      node('FRAME', 10, 1, { frameMaskDisabled: false })
    ]).graph
    const frame = graph.getChildren(graph.getPages()[0].id)[0]
    expect(frame.clipsContent).toBe(true)
  })

  test('resizeToFit FRAME does not clip even with frameMaskDisabled=false', () => {
    const graph = materializeDocument([
      doc(),
      canvas(),
      node('FRAME', 10, 1, { frameMaskDisabled: false, resizeToFit: true })
    ]).graph
    const frame = graph.getChildren(graph.getPages()[0].id)[0]
    expect(frame.clipsContent).toBe(false)
  })

  test('FRAME with frameMaskDisabled=true does not clip', () => {
    const graph = materializeDocument([
      doc(),
      canvas(),
      node('FRAME', 10, 1, { frameMaskDisabled: true })
    ]).graph
    const frame = graph.getChildren(graph.getPages()[0].id)[0]
    expect(frame.clipsContent).toBe(false)
  })
})
