import { describe, expect, test } from 'bun:test'

import { parsePenFile, type PenNode } from '@open-pencil/pen'

function at<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a value')
  return value
}

function pen(child: PenNode): string {
  return JSON.stringify({ version: '2.8', children: [child] })
}

function read(json: string, name: string) {
  const graph = parsePenFile(json)
  // A page takes the name of the document's first child, so it can shadow the node under test.
  const nodes = [...graph.getAllNodes()].filter((node) => node.type !== 'CANVAS')
  return at(nodes.find((node) => node.name === name))
}

const TEXT: PenNode = {
  type: 'text',
  id: 't1',
  name: 'Body',
  content: 'Hello',
  width: 100,
  height: 20
}

const FRAME: PenNode = { type: 'frame', id: 'f1', name: 'Panel', width: 100, height: 100 }

describe('text growth', () => {
  test('a box fixed on both axes keeps its size instead of resizing to the text', () => {
    const body = read(pen({ ...TEXT, textGrowth: 'fixed-width-height' }), 'Body')

    expect(body.textAutoResize).toBe('NONE')
  })

  test('a box fixed in width grows in height', () => {
    const body = read(pen({ ...TEXT, textGrowth: 'fixed-width' }), 'Body')

    expect(body.textAutoResize).toBe('HEIGHT')
  })

  test('text that declares no growth resizes to its content', () => {
    const body = read(pen(TEXT), 'Body')

    expect(body.textAutoResize).toBe('WIDTH_AND_HEIGHT')
  })
})

describe('italic', () => {
  test('is read from fontStyle', () => {
    const body = read(pen({ ...TEXT, fontStyle: 'italic' }), 'Body')

    expect(body.italic).toBe(true)
  })

  test('stays off when the document declares no style', () => {
    const body = read(pen(TEXT), 'Body')

    expect(body.italic).not.toBe(true)
  })
})

describe('absolute positioning inside auto layout', () => {
  test('is read from layoutPosition', () => {
    const panel = read(pen({ ...FRAME, layoutPosition: 'absolute' }), 'Panel')

    expect(panel.layoutPositioning).toBe('ABSOLUTE')
  })

  test('a node that declares none stays in the flow', () => {
    const panel = read(pen(FRAME), 'Panel')

    expect(panel.layoutPositioning).toBe('AUTO')
  })
})
