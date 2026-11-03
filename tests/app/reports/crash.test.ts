import { expect, test } from 'bun:test'

import type { DiagnosticEvent } from '@/app/diagnostics'
import { crashErrors, panicExceptions, storedErrorExceptions } from '@/app/reports/crash'
import { APP_VERSION } from '@/app/runtime/version'

function runtimeError(
  session: string,
  timestamp: number,
  overrides: Partial<DiagnosticEvent['attributes']> = {}
): DiagnosticEvent {
  return {
    id: `${session}-${timestamp}`,
    timestamp,
    category: 'runtime',
    level: 'error',
    name: 'runtime.error',
    attributes: {
      source: 'window',
      errorName: 'TypeError',
      errorCode: null,
      message: `failed at ${timestamp}`,
      stack: `TypeError: failed\n    at Le (tauri://localhost/assets/index-a1.js:1:${timestamp})`,
      info: null,
      appSession: session,
      appVersion: APP_VERSION,
      ...overrides
    }
  }
}

test('the crashed sessions’ errors come most recent first', () => {
  const events = [
    runtimeError('crashed', 10),
    runtimeError('crashed', 30),
    runtimeError('closed', 40),
    runtimeError('crashed', 50, { appVersion: '0.1.0' }),
    { ...runtimeError('crashed', 60), name: 'chat.failed' }
  ]

  const errors = crashErrors(events, new Set(['crashed']))
  expect(errors.map((error) => error.at)).toEqual([30, 10])
})

test('a stored error becomes an exception with its frames again', () => {
  const [error] = crashErrors([runtimeError('crashed', 20)], new Set(['crashed']))
  const [exception] = storedErrorExceptions(error)

  expect(exception.type).toBe('TypeError')
  expect(exception.mechanism.type).toBe('window')
  expect(exception.stacktrace?.frames.at(-1)).toMatchObject({
    filename: 'tauri://localhost/assets/index-a1.js',
    colno: 20
  })
})

test('a panic is reported with where it happened, without the home folder', () => {
  const [exception] = panicExceptions({
    message: 'called `Option::unwrap()` on a `None` value',
    location: '/Users/jane/.cargo/registry/src/tauri-2.0.0/src/app.rs:12:5',
    version: APP_VERSION
  })

  expect(exception.type).toBe('panic')
  expect(exception.mechanism.type).toBe('panic')
  expect(exception.value).toContain('app.rs:12:5')
  expect(exception.value).not.toContain('jane')
})
