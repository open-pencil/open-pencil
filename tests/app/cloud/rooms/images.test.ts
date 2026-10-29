import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import type { DocumentImageLink } from '@open-pencil/cloud/contract'

import { cloudRoomImages } from '@/app/cloud/rooms/images'
import { cloudChecksum } from '@/app/integrations/storage/cloud/download'

import { fetchStub } from '#tests/helpers/fetch'

const DOCUMENT = 'document-1'
const photo = new Uint8Array([137, 80, 78, 71, 1, 2, 3])
const logo = new Uint8Array([71, 73, 70, 56, 4, 5])

let objectStore: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>> | undefined

afterEach(() => {
  objectStore?.mockRestore()
})

/** Links to images at `https://objects.test/<checksum>`, the ones in `stored` answering. */
async function cloud(stored: Map<string, Uint8Array>) {
  const asked: string[][] = []
  objectStore = spyOn(globalThis, 'fetch').mockImplementation(
    fetchStub(async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      const bytes = stored.get(decodeURIComponent(url.pathname.slice(1)))
      return bytes ? new Response(Uint8Array.from(bytes)) : new Response(null, { status: 503 })
    })
  )
  const images = cloudRoomImages(
    {
      requestImageUploads: async () => [],
      commitImageUploads: async () => undefined,
      async getImageLinks(_documentId, checksums): Promise<DocumentImageLink[]> {
        asked.push(checksums)
        return checksums.map((checksum) => ({
          checksum,
          byteSize: stored.get(checksum)?.byteLength ?? 1,
          download: {
            method: 'GET',
            url: `https://objects.test/${encodeURIComponent(checksum)}`,
            headers: {},
            expiresAt: new Date(Date.now() + 60_000).toISOString()
          }
        }))
      }
    },
    DOCUMENT,
    true
  )
  return { images, asked }
}

describe('Cloud room images', () => {
  test('loads the images it can and leaves out a failed download and a malformed reference', async () => {
    const photoChecksum = await cloudChecksum(photo)
    const logoChecksum = await cloudChecksum(logo)
    const { images, asked } = await cloud(new Map([[logoChecksum, logo]]))
    const loaded = await images.load([
      { name: 'photo', ref: photoChecksum },
      { name: 'logo', ref: logoChecksum },
      { name: 'copy', ref: logoChecksum },
      { name: 'broken', ref: 'not a checksum' }
    ])
    expect(asked).toEqual([[photoChecksum, logoChecksum]])
    expect([...loaded.keys()].sort()).toEqual(['copy', 'logo'])
    expect(loaded.get('logo')).toEqual(logo)
  })

  test('asks the server nothing when no reference is a checksum', async () => {
    const { images, asked } = await cloud(new Map())
    expect((await images.load([{ name: 'broken', ref: 'nope' }])).size).toBe(0)
    expect(asked).toEqual([])
  })
})
