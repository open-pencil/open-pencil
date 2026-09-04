import { describe, expect, test } from 'bun:test'

import { createMarkdownHardenOptions } from '@/app/shell/markdown/config'
import { markdownRenderKey } from '@/app/shell/markdown/state'

describe('chat Markdown rendering state', () => {
  test('keeps one parser while streaming and remounts when content settles', () => {
    expect(markdownRenderKey({ mode: 'streaming', surface: 'message' })).toBe('message-streaming')
    expect(markdownRenderKey({ mode: 'static', surface: 'message' })).toBe('message-static')
  })

  test('derives the image allowlist from the runtime origin', () => {
    expect(createMarkdownHardenOptions('http://localhost:1420')).toMatchObject({
      allowedImagePrefixes: ['http://localhost:1420/']
    })
    expect(createMarkdownHardenOptions('https://design.example.org/app')).toMatchObject({
      allowedImagePrefixes: ['https://design.example.org/']
    })
  })

  test('isolates reasoning parser keys from response parser keys', () => {
    expect(markdownRenderKey({ mode: 'streaming', surface: 'reasoning' })).toBe(
      'reasoning-streaming'
    )
  })
})
