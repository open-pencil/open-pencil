import { describe, expect, test } from 'bun:test'

import { createMarkdownHardenOptions } from '@/app/shell/markdown/config'

describe('chat Markdown configuration', () => {
  test('derives the image allowlist from the runtime origin', () => {
    expect(createMarkdownHardenOptions('http://localhost:1420')).toMatchObject({
      allowedImagePrefixes: ['http://localhost:1420/']
    })
    expect(createMarkdownHardenOptions('https://design.example.org/app')).toMatchObject({
      allowedImagePrefixes: ['https://design.example.org/']
    })
  })
})
