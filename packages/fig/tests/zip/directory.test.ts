import { describe, expect, test } from 'bun:test'

import { readZipDirectory, zipEntryContents, zipEntryStoredBytes } from '#fig/zip/directory'
import { zipSync } from 'fflate'

describe('readZipDirectory', () => {
  const stored = new Uint8Array([1, 2, 3, 4])
  const text = new TextEncoder().encode('deflated '.repeat(20))
  const archive = zipSync({ 'images/a': [stored, { level: 0 }], 'meta.json': text })

  test('lists the entries an archive holds', () => {
    expect(
      readZipDirectory(archive)?.map(({ name, method, size }) => ({ name, method, size }))
    ).toEqual([
      { name: 'images/a', method: 0, size: 4 },
      { name: 'meta.json', method: 8, size: text.byteLength }
    ])
  })

  test('reads a stored entry as a view of the archive and inflates a deflated one', () => {
    const [image, meta] = readZipDirectory(archive) ?? []
    const contents = zipEntryContents(archive, image)

    expect(contents).toEqual(stored)
    expect(contents.buffer).toBe(archive.buffer)
    expect(zipEntryContents(archive, meta)).toEqual(text)
    expect(zipEntryStoredBytes(archive, meta).byteLength).toBe(meta.compressedSize)
  })

  test('is null for bytes that are not a ZIP archive', () => {
    expect(readZipDirectory(new TextEncoder().encode('fig-kiwi'))).toBeNull()
    expect(readZipDirectory(new Uint8Array())).toBeNull()
  })
})
