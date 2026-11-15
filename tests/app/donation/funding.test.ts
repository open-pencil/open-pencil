import { expect, test } from 'bun:test'

import { fundingURL } from '@/app/donation/funding'

test('links the first platform the file names, as GitHub does', () => {
  expect(fundingURL('ko_fi: dannote\n')).toBe('https://ko-fi.com/dannote')
  expect(fundingURL('github: [octocat, hubot]\nko_fi: other\n')).toBe(
    'https://github.com/sponsors/octocat'
  )
  expect(fundingURL('custom: ["https://example.org/donate"]\n')).toBe('https://example.org/donate')
})

test('skips platforms it cannot link and entries left empty', () => {
  expect(fundingURL('tidelift: npm/open-pencil\npatreon:\nliberapay: openpencil\n')).toBe(
    'https://liberapay.com/openpencil'
  )
  expect(fundingURL('custom: ["http://example.org"]\n')).toBeNull()
  expect(fundingURL('ko_fi: "../evil"\n')).toBeNull()
  expect(fundingURL('# nothing yet\n')).toBeNull()
})

test('fails on a file that is not a mapping of platforms', () => {
  expect(() => fundingURL('- ko_fi\n')).toThrow()
})
