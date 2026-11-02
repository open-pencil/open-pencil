import { describe, expect, test } from 'bun:test'

import { noop } from 'es-toolkit'

import { createTextFontGate } from '#core/editor/text/font-gate'

import { createDefaultEditorState } from '@open-pencil/core'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

/** A canvas still loading its own fonts, which `load` finishes. */
function loadingCanvas() {
  let finish: () => void = noop
  const loaded = new Promise<void>((resolve) => {
    finish = resolve
  })
  const canvas = {
    fontsLoaded: false,
    whenFontsLoaded: () => loaded
  }
  const load = async () => {
    canvas.fontsLoaded = true
    finish()
    // The gate prepares the text's own fonts next; let that settle.
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
  return { canvas, load }
}

function setup() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const text = graph.createNode('TEXT', page.id, { text: 'Hello' })
  const { canvas, load } = loadingCanvas()
  const ctx = {
    graph,
    state: createDefaultEditorState(page.id),
    getRenderer: () => canvas,
    loadFont: async () => null
  }
  const gate = createTextFontGate(ctx)
  const texts = (): SceneNode[] => [{ ...text, text: 'Hello again' }]
  return { ctx, gate, text, texts, load }
}

describe('the text font gate', () => {
  test('a write waits for the canvas fonts, then lands, in order behind earlier ones', async () => {
    const { gate, text, texts, load } = setup()
    const landed: string[] = []
    gate.write([text.id], texts, () => landed.push('first'))
    gate.write([text.id], () => [], () => landed.push('second'))
    expect(landed).toEqual([])
    expect(gate.settled(text.id)).not.toBeNull()
    await load()
    await gate.settled(text.id)
    expect(landed).toEqual(['first', 'second'])
  })

  test('a write meant for a replaced document is dropped', async () => {
    const { ctx, gate, text, texts, load } = setup()
    const landed: string[] = []
    gate.write([text.id], texts, () => landed.push('write'))
    ctx.graph = new SceneGraph()
    await load()
    await gate.settled(text.id)
    expect(landed).toEqual([])
  })

  test('a write still waiting when the document turns read-only is dropped', async () => {
    const { ctx, gate, text, texts, load } = setup()
    const landed: string[] = []
    gate.write([text.id], texts, () => landed.push('write'))
    ctx.state.hostRestrictions = { ...ctx.state.hostRestrictions, readOnly: true }
    await load()
    await gate.settled(text.id)
    expect(landed).toEqual([])
  })

  test('a write that leaves no text to wait for lands at once', () => {
    const { gate, text } = setup()
    const landed: string[] = []
    gate.write([text.id], () => [], () => landed.push('write'))
    expect(landed).toEqual(['write'])
  })
})
