import { describe, expect, test } from 'bun:test'

import { nextTick, ref } from 'vue'

import { asDouble } from '@open-pencil/test-support/doubles'

import {
  parseEmbedderOrigin,
  startEmbedderBridge,
  type EmbeddedDocument,
  type EmbedderFrame,
  type EmbedderMessage
} from '@/app/document/io/embedder'

const ORIGIN = 'https://host.example'

describe('parseEmbedderOrigin', () => {
  test('accepts an origin, with or without the trailing slash', () => {
    expect(parseEmbedderOrigin(`?embedder=${encodeURIComponent(ORIGIN)}`)).toBe(ORIGIN)
    expect(parseEmbedderOrigin(`?embedder=${encodeURIComponent(`${ORIGIN}/`)}`)).toBe(ORIGIN)
    expect(parseEmbedderOrigin('?embedder=http%3A%2F%2Flocalhost%3A5173')).toBe(
      'http://localhost:5173'
    )
  })

  test('refuses a path, query, or fragment after the origin', () => {
    expect(parseEmbedderOrigin(`?embedder=${encodeURIComponent(`${ORIGIN}/a`)}`)).toBeNull()
    expect(parseEmbedderOrigin(`?embedder=${encodeURIComponent(`${ORIGIN}?x=1`)}`)).toBeNull()
    expect(parseEmbedderOrigin(`?embedder=${encodeURIComponent(`${ORIGIN}#x`)}`)).toBeNull()
  })

  test('refuses a wildcard, an opaque origin, and other schemes', () => {
    expect(parseEmbedderOrigin('?embedder=*')).toBeNull()
    expect(parseEmbedderOrigin('?embedder=null')).toBeNull()
    expect(parseEmbedderOrigin('?embedder=file%3A%2F%2F%2Ftmp')).toBeNull()
    expect(parseEmbedderOrigin('?embedder=data%3Atext%2Fhtml%2Cx')).toBeNull()
  })

  test('returns null without an embedder', () => {
    expect(parseEmbedderOrigin('')).toBeNull()
    expect(parseEmbedderOrigin('?embedder=')).toBeNull()
  })
})

function harness() {
  const sent: Array<{ message: EmbedderMessage; target: string }> = []
  const listeners = new Set<(event: MessageEvent) => void>()
  const parent = {
    postMessage: (message: EmbedderMessage, target: string) => sent.push({ message, target })
  }
  const frame: EmbedderFrame = {
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    parent: asDouble<Window>(parent)
  }
  const edited = ref(false)
  const opened: string[] = []
  const document: EmbeddedDocument = {
    hasUnsavedChanges: () => edited.value,
    saveFigFileCopy: async (write) => {
      await write(new Uint8Array([1, 2, 3]))
      edited.value = false
      return true
    }
  }
  const stop = startEmbedderBridge(ORIGIN, frame, {
    open: async (file) => {
      opened.push(`${file.name}:${file.size}`)
      return document
    }
  })
  const receive = (data: unknown, origin = ORIGIN, source: unknown = parent) => {
    for (const listener of listeners) {
      listener(asDouble<MessageEvent>({ data, origin, source }))
    }
  }
  const settle = async () => {
    for (let turn = 0; turn < 5; turn++) await nextTick()
  }
  return { sent, listeners, edited, opened, stop, receive, settle }
}

describe('startEmbedderBridge', () => {
  test('says it is ready, to the embedder origin only', () => {
    const { sent } = harness()
    expect(sent).toEqual([{ message: { type: 'openpencil:ready' }, target: ORIGIN }])
  })

  test('opens a posted file and reports edits until it is saved', async () => {
    const { sent, edited, opened, receive, settle } = harness()
    receive({ type: 'openpencil:open', name: 'design.fig', data: new ArrayBuffer(4) })
    await settle()
    expect(opened).toEqual(['design.fig:4'])
    expect(sent.at(-1)?.message).toEqual({ type: 'openpencil:opened' })

    edited.value = true
    await settle()
    expect(sent.at(-1)?.message).toEqual({ type: 'openpencil:edited', edited: true })

    receive({ type: 'openpencil:save', id: 'first' })
    await settle()
    const saved = sent.find(({ message }) => message.type === 'openpencil:saved')?.message
    expect(saved?.type === 'openpencil:saved' && [...new Uint8Array(saved.data)]).toEqual([1, 2, 3])
    expect(sent.map(({ message }) => message).slice(-2)).toContainEqual({
      type: 'openpencil:edited',
      edited: false
    })
    expect(sent.every(({ target }) => target === ORIGIN)).toBe(true)
  })

  test('ignores messages from another origin or another window', async () => {
    const { opened, receive, settle } = harness()
    const open = { type: 'openpencil:open', name: 'design.fig', data: new ArrayBuffer(1) }
    receive(open, 'https://other.example')
    receive(open, ORIGIN, {})
    await settle()
    expect(opened).toEqual([])
  })

  test('ignores messages that are not requests', async () => {
    const { sent, opened, receive, settle } = harness()
    receive({ type: 'openpencil:open', name: '', data: new ArrayBuffer(1) })
    receive({ type: 'openpencil:open', name: 'design.fig', data: 'not bytes' })
    receive('openpencil:save')
    await settle()
    expect(opened).toEqual([])
    expect(sent).toHaveLength(1)
  })

  test('answers a save before any open with a failure for that request', async () => {
    const { sent, receive, settle } = harness()
    receive({ type: 'openpencil:save', id: 'early' })
    await settle()
    expect(sent.at(-1)?.message).toMatchObject({ type: 'openpencil:failed', id: 'early' })
  })

  test('stops listening when stopped', () => {
    const { listeners, stop } = harness()
    stop()
    expect(listeners.size).toBe(0)
  })

  test('stays quiet about a file that finishes opening after it stopped', async () => {
    const { sent, edited, receive, stop, settle } = harness()
    receive({ type: 'openpencil:open', name: 'design.fig', data: new ArrayBuffer(4) })
    stop()
    await settle()
    edited.value = true
    await settle()
    expect(sent.map(({ message }) => message.type)).toEqual(['openpencil:ready'])
  })
})
