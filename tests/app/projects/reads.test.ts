import { expect, test } from 'bun:test'

import { isMissingFile, readFailure, readTextOrMissing } from '@/app/projects/reads'

/** The message the desktop app's file plugin writes for a path that is not there. */
function missing(code: 2 | 3): Error {
  return new Error(
    `failed to open file at path: D:/app/package.json with error: cannot find it. (os error ${code})`
  )
}

test('a file that is not there answers null, whichever code the system uses', async () => {
  for (const code of [2, 3] as const) {
    const read = async () => {
      throw missing(code)
    }
    expect(await readTextOrMissing('D:/app/package.json', read)).toBeNull()
  }
})

test('reads text as UTF-8 and leaves the file alone', async () => {
  const text = await readTextOrMissing('D:/app/package.json', async () => {
    return new TextEncoder().encode('{"name":"проект"}')
  })

  expect(text).toBe('{"name":"проект"}')
})

test('a read the app may not make is thrown rather than reported as a missing file', async () => {
  const forbidden = new Error(
    'forbidden path: D:/app/.git/HEAD, maybe it is not allowed on the scope for `allow-read-file` permission in your capability file'
  )
  const read = async () => {
    throw forbidden
  }

  await expect(readTextOrMissing('D:/app/.git/HEAD', read)).rejects.toThrow(
    'Could not read D:/app/.git/HEAD'
  )
  expect(isMissingFile(forbidden)).toBe(false)
})

test('a file that is there but cannot be opened is reported too', async () => {
  // A directory reads as access denied rather than as missing.
  const denied = new Error(
    'failed to open file at path: D:/app/src with error: denied. (os error 5)'
  )
  const read = async () => {
    throw denied
  }

  await expect(readTextOrMissing('D:/app/src', read)).rejects.toThrow('os error 5')
})

test('a failure without a system code is reported, not read as a missing file', () => {
  expect(isMissingFile(new Error('the window has no file plugin'))).toBe(false)
  expect(readFailure('D:/app/x.json', 'nope').message).toBe('Could not read D:/app/x.json: nope')
})
