import { describe, expect, test } from 'bun:test'

import { createMarkdownSecurityOptions, isAllowedImageSource } from '@/app/shell/markdown/config'

describe('chat Markdown configuration', () => {
  test('derives the image allowlist from the runtime origin', () => {
    expect(createMarkdownSecurityOptions('http://localhost:1420')).toMatchObject({
      allowedImagePrefixes: ['http://localhost:1420/']
    })
    expect(createMarkdownSecurityOptions('https://design.example.org/app')).toMatchObject({
      allowedImagePrefixes: ['https://design.example.org/']
    })
  })

  test('lets images load only from the app, even when bound after the security rules ran', () => {
    const origin = 'http://localhost:1420'
    expect(isAllowedImageSource('/assets/a.png', origin)).toBe(true)
    expect(isAllowedImageSource('http://localhost:1420/assets/a.png', origin)).toBe(true)
    expect(isAllowedImageSource('https://attacker.example/pixel', origin)).toBe(false)
    expect(isAllowedImageSource('//attacker.example/pixel', origin)).toBe(false)
    expect(isAllowedImageSource('data:image/png;base64,AAAA', origin)).toBe(false)
  })
})
