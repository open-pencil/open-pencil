import { afterEach, describe, expect, test } from 'bun:test'

import { isOwnError, reportExceptions } from '@/app/reports/exception'

const CHUNK = '849ab7be-6ab8-5c38-8851-ee4992cad3e5'

afterEach(() => {
  Reflect.deleteProperty(globalThis, '_posthogChunkIds')
})

describe('reportExceptions', () => {
  test('describes an uncaught error with its frames', () => {
    const [exception] = reportExceptions(new TypeError('nodes.map is not a function'), 'window')

    expect(exception.type).toBe('TypeError')
    expect(exception.value).toBe('nodes.map is not a function')
    expect(exception.mechanism).toEqual({ handled: false, synthetic: false, type: 'window' })
    expect(exception.stacktrace?.frames.length).toBeGreaterThan(0)
    for (const frame of exception.stacktrace?.frames ?? []) {
      expect(frame.platform).toBe('web:javascript')
    }
  })

  test('points frames at the chunk the release build injected an ID into', () => {
    // A chunk registers the stack of an error made at its own top level, as the injected snippet does.
    Reflect.set(globalThis, '_posthogChunkIds', { [new Error('chunk').stack ?? '']: CHUNK })

    const [exception] = reportExceptions(new Error('failed'), 'vue')
    expect(exception.stacktrace?.frames.some((frame) => frame.chunk_id === CHUNK)).toBe(true)
  })

  test('scrubs credentials and home folders from messages', () => {
    const [exception] = reportExceptions(
      new Error('Could not read /Users/jane/Designs/app.fig with api_key=abc123secret'),
      'rejection'
    )
    expect(exception.value).not.toContain('jane')
    expect(exception.value).not.toContain('abc123secret')
  })

  test('keeps no message from a chain where any error may quote prompts', () => {
    const error = new Error('The model refused: "Draw my secret project"')
    error.name = 'AI_APICallError'
    const exceptions = reportExceptions(new Error('Reply failed', { cause: error }), 'rejection')
    const quoting = reportExceptions(error, 'rejection')

    expect(exceptions.length).toBe(2)
    expect(exceptions.every((exception) => exception.value === undefined)).toBe(true)
    expect(quoting.every((exception) => exception.value === undefined)).toBe(true)
  })

  test('follows the cause chain', () => {
    const exceptions = reportExceptions(
      new Error('Could not open the file', {
        cause: new RangeError('Offset is outside the bounds')
      }),
      'window'
    )
    expect(exceptions.map((exception) => exception.type).toSorted()).toEqual([
      'Error',
      'RangeError'
    ])
  })
})

describe('isOwnError', () => {
  const exceptions = reportExceptions(new Error('failed'), 'window')
  const filename = exceptions[0].stacktrace?.frames.at(-1)?.filename ?? ''

  test('accepts an error with a frame from the app’s origin', () => {
    const own = exceptions.map((exception) => ({
      ...exception,
      stacktrace: {
        type: 'raw' as const,
        frames: [{ platform: 'web:javascript' as const, filename: 'tauri://localhost/assets/a.js' }]
      }
    }))
    expect(isOwnError(own, 'tauri://localhost')).toBe(true)
  })

  test('refuses an error thrown elsewhere, such as by an extension', () => {
    expect(filename).not.toStartWith('chrome-extension://')
    expect(isOwnError(exceptions, 'chrome-extension://abcdef')).toBe(false)
  })
})
