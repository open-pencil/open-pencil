import { describe, expect, test } from 'bun:test'

import { cloudEmbedCode } from '@/app/cloud/sharing/embed'

describe('Cloud embed code', () => {
  test('frames the link’s embed address with its secret, and escapes the title', () => {
    const code = cloudEmbedCode('https://cloud.example/share/abc#s3cret', 'Q3 "launch" & <plan>')
    expect(code).toContain('src="https://cloud.example/embed/share/abc#s3cret"')
    expect(code).toContain('title="Q3 &quot;launch&quot; &amp; <plan>"')
    expect(code).toStartWith('<iframe ')
    expect(code).toEndWith('></iframe>')
  })

  test('makes no code for an address that is no shared link with its secret', () => {
    expect(cloudEmbedCode('https://cloud.example/share/abc', 'Plan')).toBeNull()
    expect(cloudEmbedCode('https://cloud.example/documents/abc#secret', 'Plan')).toBeNull()
  })
})
