import { describe, expect, test } from 'bun:test'

import { baselineBrowserFor, describeEnvironment, parseUserAgent } from '@/app/shell/support/detect'

const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Safari/605.1.15'
const MAC_WKWEBVIEW =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)'
const WINDOWS_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
const WINDOWS_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36 Edg/109.0.1518.78'
const LINUX_OPERA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 OPR/94.0.0.0'
const LINUX_FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:115.0) Gecko/20100101 Firefox/115.0'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/110.0.5481.83 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15'

describe('user agent detection', () => {
  test.each([
    [MAC_SAFARI, { os: 'macos', browser: 'safari', browserVersion: 16.3 }],
    [MAC_WKWEBVIEW, { os: 'macos', browser: 'safari', browserVersion: undefined }],
    [WINDOWS_CHROME, { os: 'windows', browser: 'chrome', browserVersion: 105 }],
    [WINDOWS_EDGE, { os: 'windows', browser: 'edge', browserVersion: 109 }],
    [LINUX_OPERA, { os: 'linux', browser: 'opera', browserVersion: 108 }],
    [LINUX_FIREFOX, { os: 'linux', browser: 'firefox', browserVersion: 115 }],
    [IPHONE_CHROME, { os: 'ios', browser: 'safari', browserVersion: 16.3 }],
    ['curl/8.0', { os: 'unknown', browser: 'unknown', browserVersion: undefined }]
  ])('parses %s', (userAgent, expected) => {
    expect(parseUserAgent(userAgent)).toEqual(expected)
  })

  test('recognises iPadOS behind a desktop-class Macintosh user agent', () => {
    expect(parseUserAgent(IPAD_DESKTOP_SAFARI, 5)).toEqual({
      os: 'ios',
      browser: 'safari',
      browserVersion: 16.1
    })
  })

  test('prefers the desktop shell facts over the WebView user agent', () => {
    const env = describeEnvironment(
      { userAgent: MAC_WKWEBVIEW, maxTouchPoints: 0 },
      { platform: 'macos', osVersion: '13.7.8', webviewVersion: '18615.1.26.11.23' }
    )
    expect(env).toEqual({
      host: 'desktop',
      os: 'macos',
      osVersion: '13.7.8',
      browser: 'safari',
      browserVersion: undefined,
      webviewVersion: '18615.1.26.11.23',
      userAgent: MAC_WKWEBVIEW
    })
  })

  test('keeps the user agent operating system when the shell cannot name one', () => {
    const env = describeEnvironment(
      { userAgent: LINUX_FIREFOX, maxTouchPoints: 0 },
      { platform: 'unknown' }
    )
    expect(env.host).toBe('desktop')
    expect(env.os).toBe('linux')
  })

  test.each([
    [WINDOWS_CHROME, 'chrome'],
    [LINUX_OPERA, 'chrome'],
    [WINDOWS_EDGE, 'edge'],
    [LINUX_FIREFOX, 'firefox'],
    [MAC_SAFARI, 'safari'],
    [IPHONE_CHROME, 'ios'],
    ['curl/8.0', undefined]
  ])('maps %s to its baseline entry', (userAgent, expected) => {
    const env = describeEnvironment({ userAgent, maxTouchPoints: 0 })
    expect(baselineBrowserFor(env)).toBe(expected)
  })
})
