import { describe, expect, test } from 'bun:test'

import { fromStorableBlobs, toStorableBlobs } from '@/app/ai/chat/history/blobs'

function containsBlob(value: unknown): boolean {
  if (value instanceof Blob) return true
  if (Array.isArray(value)) return value.some(containsBlob)
  if (value && typeof value === 'object') return Object.values(value).some(containsBlob)
  return false
}

const messages = () => [
  {
    message: { id: 'user', role: 'user', parts: [{ type: 'text', text: 'Hero' }] },
    attachments: [{ id: 'image', preview: new Blob(['image'], { type: 'image/png' }) }],
    toolChanges: [{ images: { before: new Blob(['before']), after: null, highlight: null } }]
  }
]

describe('conversation Blobs in storage', () => {
  test('stores no Blob at any depth, so private WebKit contexts can store it', async () => {
    const stored = await toStorableBlobs(messages())
    expect(containsBlob(stored)).toBe(false)
  })

  test('restores each Blob with its bytes and type, and leaves other values alone', async () => {
    const restored = fromStorableBlobs(await toStorableBlobs(messages()))
    expect(restored).toMatchObject([
      {
        message: { id: 'user', parts: [{ text: 'Hero' }] },
        toolChanges: [{ images: { after: null, highlight: null } }]
      }
    ])
    const [entry] = restored as ReturnType<typeof messages>
    expect(entry.attachments[0].preview.type).toBe('image/png')
    expect(await entry.attachments[0].preview.text()).toBe('image')
    expect(await entry.toolChanges[0].images.before?.text()).toBe('before')
  })

  test('keeps Blobs saved before conversion as they are', async () => {
    const blob = new Blob(['old'])
    const [restored] = fromStorableBlobs([blob]) as Blob[]
    expect(restored).toBe(blob)
  })
})
