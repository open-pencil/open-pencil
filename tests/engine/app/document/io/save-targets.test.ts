import { afterEach, describe, expect, test } from 'bun:test'

import { chooseBrowserFigSaveHandle } from '@/app/document/io/save-targets'

type PickerOptions = NonNullable<Parameters<NonNullable<Window['showSaveFilePicker']>>[0]>

const HANDLE = { kind: 'file', name: 'saved' } as FileSystemFileHandle

function setWindow(win: Partial<Window>) {
  globalThis.window = win as Window & typeof globalThis
}

/** Install a `showSaveFilePicker` stub and capture the options it is called with. */
function stubPicker(behaviour?: () => Promise<FileSystemFileHandle>) {
  const calls: PickerOptions[] = []
  setWindow({
    showSaveFilePicker: async (options?: PickerOptions) => {
      if (options) calls.push(options)
      return behaviour ? await behaviour() : HANDLE
    }
  })
  return calls
}

function abortError() {
  const error = new Error('user cancelled')
  error.name = 'AbortError'
  return error
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window')
})

describe('chooseBrowserFigSaveHandle', () => {
  test('offers .fig first for a design document', async () => {
    const calls = stubPicker()

    await expect(chooseBrowserFigSaveHandle('poster.fig')).resolves.toBe(HANDLE)

    expect(calls[0]).toEqual({
      suggestedName: 'poster.fig',
      types: [
        { description: 'Figma Design', accept: { 'application/octet-stream': ['.fig'] } },
        { description: 'Figma Slides', accept: { 'application/octet-stream': ['.deck'] } }
      ]
    })
  })

  test('offers .deck first for a deck document', async () => {
    const calls = stubPicker()

    await chooseBrowserFigSaveHandle('talk.deck')

    // The document's own format leads; the other native format stays available second.
    expect(calls[0]).toEqual({
      suggestedName: 'talk.deck',
      types: [
        { description: 'Figma Slides', accept: { 'application/octet-stream': ['.deck'] } },
        { description: 'Figma Design', accept: { 'application/octet-stream': ['.fig'] } }
      ]
    })
  })

  test('treats an unknown extension as a design document', async () => {
    const calls = stubPicker()

    await chooseBrowserFigSaveHandle('sketch.svg')

    expect(calls[0]?.suggestedName).toBe('sketch.svg')
    expect(calls[0]?.types?.[0]?.description).toBe('Figma Design')
  })

  test('matches the .deck extension case-insensitively', async () => {
    const calls = stubPicker()

    await chooseBrowserFigSaveHandle('TALK.DECK')

    expect(calls[0]?.types?.[0]?.description).toBe('Figma Slides')
  })

  test.each([
    ['no name', undefined],
    ['an empty name', ''],
    ['a whitespace-only name', '   ']
  ])('falls back to Untitled.fig given %s', async (_label, name) => {
    const calls = stubPicker()

    await chooseBrowserFigSaveHandle(name)

    expect(calls[0]?.suggestedName).toBe('Untitled.fig')
    expect(calls[0]?.types?.[0]?.description).toBe('Figma Design')
  })

  test('returns null when the browser has no file picker', async () => {
    setWindow({})

    await expect(chooseBrowserFigSaveHandle('poster.fig')).resolves.toBeNull()
  })

  test('returns null when the user dismisses the picker', async () => {
    stubPicker(() => Promise.reject(abortError()))

    await expect(chooseBrowserFigSaveHandle('poster.fig')).resolves.toBeNull()
  })

  test('propagates failures that are not a dismissal', async () => {
    stubPicker(() => Promise.reject(new Error('disk on fire')))

    await expect(chooseBrowserFigSaveHandle('poster.fig')).rejects.toThrow('disk on fire')
  })
})
