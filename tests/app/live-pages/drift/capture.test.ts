import { expect, test } from 'bun:test'

import { fromUint8Array } from 'js-base64'

import {
  CAPTURE_COMMAND,
  captureSize,
  decodeBase64,
  desktopPageCapture,
  isLoopbackAddress
} from '@/app/live-pages/drift/capture'

const target = { nodeId: 'frame-1', url: 'http://localhost:3000/pricing' }

/** What the native command answers for a picture of the word `page`. */
function shotOf(text: string) {
  return { bytes: fromUint8Array(new TextEncoder().encode(text)), width: 1440, height: 900 }
}

test('only a page this machine serves is drawn', () => {
  for (const allowed of [
    'http://localhost:3000/pricing',
    'http://127.0.0.1:1420/',
    'http://127.0.0.53:8080/',
    'https://app.localhost/',
    'http://[::1]:8080/pricing'
  ]) {
    expect(isLoopbackAddress(allowed)).toBe(true)
  }
  for (const refused of [
    'http://example.com/',
    'https://10.0.0.1/',
    'http://192.168.1.10:3000/',
    'file:///etc/passwd',
    'data:text/html,hi',
    'not an address',
    ''
  ]) {
    expect(isLoopbackAddress(refused)).toBe(false)
  }
})

test('the loopback rule answers what the native command answers', () => {
  // The address forms a dev server is reached by, which the native rule takes: the short IPv4 form
  // is normalized by the parser, and the bracketed IPv6 loopback stays bracketed in `hostname`.
  for (const allowed of ['http://127.1/', 'http://[0:0:0:0:0:0:0:1]/']) {
    expect(isLoopbackAddress(allowed)).toBe(true)
  }
  for (const refused of [
    // Not an address the parser will take, and not a name the native rule treats as this machine.
    'http://127.999.999.999/',
    // An IPv4-mapped address is not the IPv6 loopback.
    'http://[::ffff:127.0.0.1]/',
    // Every interface, not this one.
    'http://0.0.0.0:3000/',
    // `localhost` over a scheme a page is not served with.
    'ws://localhost:3000/'
  ]) {
    expect(isLoopbackAddress(refused)).toBe(false)
  }
})

test('a picture is drawn at the frame size, within what the command takes', () => {
  expect(captureSize({ nodeId: 'f', url: 'http://localhost:3000' })).toEqual({
    width: 1440,
    height: 900
  })
  expect(captureSize({ ...target, width: 375, height: 812 })).toEqual({ width: 375, height: 812 })
  expect(captureSize({ ...target, width: 375.4, height: 812.6 })).toEqual({
    width: 375,
    height: 813
  })
  expect(captureSize({ ...target, width: 4, height: 20000 })).toEqual({ width: 64, height: 4096 })
})

test('a picture travels as base64 and comes back byte for byte', () => {
  const bytes = decodeBase64('cGFnZQ==')
  expect(bytes === null ? '' : new TextDecoder().decode(bytes)).toBe('page')
  expect(decodeBase64('')?.length).toBe(0)
  expect(decodeBase64('not base64!')).toBeNull()
})

test('a drawn page answers its bytes and the size it was drawn at', async () => {
  const calls: unknown[] = []
  const capture = desktopPageCapture(async (command, args) => {
    calls.push({ command, args })
    return shotOf('page')
  })
  const captured = await capture({ ...target, width: 800, height: 600 })
  expect(captured?.width).toBe(1440)
  expect(captured?.height).toBe(900)
  expect(captured === null ? '' : new TextDecoder().decode(captured.bytes)).toBe('page')
  expect(calls).toEqual([
    { command: CAPTURE_COMMAND, args: { url: target.url, width: 800, height: 600 } }
  ])
})

test('a page elsewhere is never drawn, and the command is not called', async () => {
  let calls = 0
  const capture = desktopPageCapture(async () => {
    calls += 1
    return shotOf('page')
  })
  expect(await capture({ nodeId: 'f', url: 'https://example.com/' })).toBeNull()
  expect(calls).toBe(0)
})

test('a capture that failed, or answered nothing readable, has no picture', async () => {
  const refused = desktopPageCapture(async () => {
    throw new Error('no browser')
  })
  const unreadable = desktopPageCapture(async () => ({ bytes: '', width: 0, height: 0 }))
  const notBase64 = desktopPageCapture(async () => ({
    bytes: 'not base64!',
    width: 10,
    height: 10
  }))
  expect(await refused(target)).toBeNull()
  expect(await unreadable(target)).toBeNull()
  expect(await notBase64(target)).toBeNull()
})
