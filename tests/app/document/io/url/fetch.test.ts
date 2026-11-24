import { describe, expect, test } from 'bun:test'

import { countedFetch } from '@/app/document/io/url/fetch'

describe('countedFetch', () => {
  test('counts each file once as it is asked for and as it finishes, failed ones too', async () => {
    const reports: [number, number][] = []
    const fetch = countedFetch(
      async (url) => {
        if (url.endsWith('missing.png')) throw new Error('404')
        return null
      },
      (completed, total) => reports.push([completed, total])
    )
    const signal = new AbortController().signal

    await Promise.all([
      fetch('https://site.test/a.css', signal),
      fetch('https://site.test/a.css', signal),
      fetch('https://site.test/missing.png', signal).catch(() => null)
    ])

    expect(reports).toEqual([
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 2]
    ])
  })
})
