import { describe, expect, test } from 'bun:test'

import { documentIdFromFigKey } from '@/app/integrations/storage/namespace'
import {
  parseListObjectsV2Page,
  parseListObjectsV2Xml,
  parseS3ErrorXml
} from '@/app/integrations/storage/s3/xml'

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
      .map((object) => documentIdFromFigKey(object.key))
      .filter((id): id is string => id != null)
    expect(canvasIds).toEqual(['a1'])
  })

  test('decodes entities and reads namespaced pagination fields', () => {
    const xml = `<s3:ListBucketResult xmlns:s3="urn:s3"><s3:Contents><s3:Key>open_pencil_storage/canvases/a&amp;b.fig</s3:Key><s3:Size>1</s3:Size></s3:Contents><s3:IsTruncated>true</s3:IsTruncated><s3:NextContinuationToken>a&amp;b</s3:NextContinuationToken></s3:ListBucketResult>`
    const page = parseListObjectsV2Page(xml)
    expect(page.objects[0]?.key).toBe('open_pencil_storage/canvases/a&b.fig')
    expect(page.isTruncated).toBe(true)
    expect(page.nextContinuationToken).toBe('a&b')
  })

  test('parses S3 error XML without interpreting markup-like text', () => {
    expect(
      parseS3ErrorXml(
        `<Error><Code>AccessDenied</Code><Message>Key contains &lt;Code&gt;fake&lt;/Code&gt;</Message></Error>`,
        403
      )
    ).toEqual({ code: 'AccessDenied', message: 'Key contains <Code>fake</Code>' })
  })

  test('returns an empty page for malformed XML', () => {
    expect(parseListObjectsV2Page('<ListBucketResult><Contents>')).toEqual({
      objects: [],
      isTruncated: false,
      nextContinuationToken: null
    })
  })
})
