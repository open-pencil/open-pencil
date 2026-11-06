import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveImageFillArgs, stripImageDataUrl } from '#mcp/tool/image-fill'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()))
})

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

describe('stripImageDataUrl', () => {
  test('strips a data URL prefix', () => {
    expect(stripImageDataUrl('data:image/png;base64,abc=')).toBe('abc=')
    expect(stripImageDataUrl('data:image/jpeg;base64,/9j/')).toBe('/9j/')
  })

  test('leaves raw base64 alone', () => {
    expect(stripImageDataUrl('abc=')).toBe('abc=')
  })
})

describe('resolveImageFillArgs', () => {
  test('reads image_path from the MCP root into image_data', async () => {
    const root = await mkdtemp(join(tmpdir(), 'op-image-fill-'))
    cleanups.push(() => rm(root, { recursive: true, force: true }))
    await writeFile(join(root, 'plate.png'), PNG_MAGIC)

    const resolved = await resolveImageFillArgs(
      { id: '1:1', image_path: 'plate.png', scale_mode: 'FILL' },
      root
    )
    expect(resolved.image_path).toBeUndefined()
    expect(typeof resolved.image_data).toBe('string')
    expect(resolved.image_data).toBe(Buffer.from(PNG_MAGIC).toString('base64'))
    expect(resolved.id).toBe('1:1')
    expect(resolved.scale_mode).toBe('FILL')
  })

  test('strips data URLs on image_data', async () => {
    const b64 = Buffer.from(PNG_MAGIC).toString('base64')
    const resolved = await resolveImageFillArgs(
      { id: '1:1', image_data: `data:image/png;base64,${b64}` },
      null
    )
    expect(resolved.image_data).toBe(b64)
  })

  test('rejects truncated image_data', async () => {
    await expect(
      resolveImageFillArgs({ id: '1:1', image_data: 'abcde' }, null)
    ).rejects.toThrow(/truncated/)
  })

  test('requires MCP root for image_path', async () => {
    await expect(
      resolveImageFillArgs({ id: '1:1', image_path: 'plate.png' }, null)
    ).rejects.toThrow(/OPENPENCIL_MCP_ROOT/)
  })

  test('requires one of image_path or image_data', async () => {
    await expect(resolveImageFillArgs({ id: '1:1' }, '/tmp')).rejects.toThrow(
      /image_path|image_data/
    )
  })
})
