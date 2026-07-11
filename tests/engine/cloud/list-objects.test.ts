import { describe, expect, test } from 'bun:test'

import { canvasIdFromFigKey } from '@/app/cloud/namespace'
import { parseListObjectsV2Xml } from '@/app/cloud/s3/client'

describe('parseListObjectsV2Xml', () => {
  test('extracts keys and ignores objects outside canvas fig pattern when filtered', () => {
    const xml = `<?xml version="1.0"?>
<ListBucketResult>
  <Contents>
    <Key>open_pencil_storage/canvases/a1.fig</Key>
    <LastModified>2026-01-02T03:04:05.000Z</LastModified>
    <Size>12</Size>
  </Contents>
  <Contents>
    <Key>open_pencil_storage/canvases/a1.meta.json</Key>
    <LastModified>2026-01-02T03:04:06.000Z</LastModified>
    <Size>40</Size>
  </Contents>
  <Contents>
    <Key>other-app/file.bin</Key>
    <LastModified>2026-01-01T00:00:00.000Z</LastModified>
    <Size>1</Size>
  </Contents>
</ListBucketResult>`

    const listed = parseListObjectsV2Xml(xml)
    expect(listed).toHaveLength(3)
    expect(listed[0]?.key).toBe('open_pencil_storage/canvases/a1.fig')
    expect(listed[0]?.lastModified).toBe('2026-01-02T03:04:05.000Z')
    expect(listed[0]?.size).toBe(12)

    const canvasIds = listed
      .map((o) => canvasIdFromFigKey(o.key))
      .filter((id): id is string => id != null)
    expect(canvasIds).toEqual(['a1'])
  })

  test('decodes basic XML entities in keys', () => {
    const xml = `<ListBucketResult><Contents><Key>open_pencil_storage/canvases/a&amp;b.fig</Key><Size>1</Size></Contents></ListBucketResult>`
    const listed = parseListObjectsV2Xml(xml)
    expect(listed[0]?.key).toBe('open_pencil_storage/canvases/a&b.fig')
  })
})
