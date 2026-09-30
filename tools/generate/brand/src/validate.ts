import assert from 'node:assert/strict'

import sharp from 'sharp'

import { brand, targetFiles } from './config.ts'
import type { BrandTarget } from './config.ts'
import type { BrandFiles } from './web.ts'

/** Tauri emits ICNS chunks from an unordered map; stabilize order without re-encoding images. */
export function canonicalIcns(data: Buffer): Buffer {
  assert.ok(data.length >= 8 && data.toString('ascii', 0, 4) === 'icns', 'Invalid ICNS header')
  assert.equal(data.readUInt32BE(4), data.length, 'Invalid ICNS length')
  const chunks: Buffer[] = []
  for (let offset = 8; offset < data.length;) {
    assert.ok(offset + 8 <= data.length, 'Truncated ICNS chunk')
    const size = data.readUInt32BE(offset + 4)
    assert.ok(size >= 8 && offset + size <= data.length, 'Invalid ICNS chunk length')
    chunks.push(data.subarray(offset, offset + size))
    offset += size
  }
  assert.ok(chunks.length > 0, 'Empty ICNS')
  chunks.sort((a, b) => Buffer.compare(a.subarray(0, 4), b.subarray(0, 4)))
  return Buffer.concat([data.subarray(0, 8), ...chunks])
}

export function icoSizes(data: Buffer): number[] {
  assert.ok(
    data.length >= 6 && data.readUInt16LE(0) === 0 && data.readUInt16LE(2) === 1,
    'Invalid ICO header'
  )
  const count = data.readUInt16LE(4)
  assert.ok(count > 0 && data.length >= 6 + count * 16, 'Truncated ICO directory')
  return Array.from({ length: count }, (_, index) => {
    const offset = 6 + index * 16
    const width = data[offset] || 256
    assert.equal(width, data[offset + 1] || 256, 'Non-square ICO frame')
    const length = data.readUInt32LE(offset + 8)
    const start = data.readUInt32LE(offset + 12)
    assert.ok(
      length > 0 && start >= 6 + count * 16 && start + length <= data.length,
      'Invalid ICO frame bounds'
    )
    return width
  })
}

export async function validateMaskable(data: Buffer): Promise<void> {
  const { data: pixels, info } = await sharp(data)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const background = [1, 3, 5].map((offset) =>
    Number.parseInt(brand.background.slice(offset, offset + 2), 16)
  )
  const radius = info.width * 0.4
  let foreground = 0
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * 4
      assert.equal(pixels[offset + 3], 255, 'Maskable icon must be opaque')
      const difference = background.reduce(
        (sum, channel, i) => sum + Math.abs(channel - pixels[offset + i]),
        0
      )
      if (difference < 30) continue
      foreground++
      assert.ok(
        Math.hypot(x + 0.5 - info.width / 2, y + 0.5 - info.height / 2) <= radius,
        'Mark exceeds maskable safe circle'
      )
    }
  }
  assert.ok(foreground > 0, 'Empty maskable mark')
}

function pngSize(name: string): number | undefined {
  if (name === 'brand/app-icon-1024.png') return 1024
  if (name === 'apple-touch-icon.png') return 180
  if (name === 'brand/favicon-96x96.png') return 96
  if (name === '128x128@2x.png') return 256
  if (name === 'icon.png') return 512
  if (name === 'StoreLogo.png') return 50
  const size = name.match(/(?:pwa-(?:maskable-)?|Square)(\d+)/)?.[1] ?? name.match(/^(\d+)x/)?.[1]
  return size ? Number(size) : undefined
}

export async function validateFiles(files: BrandFiles, target: BrandTarget): Promise<void> {
  for (const name of targetFiles(target)) {
    const data = files.get(name)
    assert.ok(data && data.length > 0, `Missing brand output: ${name}`)
    if (name.endsWith('.png')) {
      const meta = await sharp(data).metadata()
      assert.equal(meta.format, 'png', name)
      assert.equal(meta.width, meta.height, `Non-square ${name}`)
      const size = pngSize(name)
      if (size) assert.equal(meta.width, size, name)
      if (target === 'desktop') assert.equal(meta.channels, 4, `${name} must be RGBA`)
      if (name === 'apple-touch-icon.png') {
        const stats = await sharp(data).ensureAlpha().stats()
        assert.equal(stats.channels[3].min, 255, 'Touch icon must be opaque')
        const { data: corner } = await sharp(data)
          .extract({ left: 0, top: 0, width: 1, height: 1 })
          .raw()
          .toBuffer({ resolveWithObject: true })
        assert.equal(
          `#${corner.subarray(0, 3).toString('hex')}`.toUpperCase(),
          brand.background,
          'Touch icon must not bake in rounded corners'
        )
      }
    }
    if (name.endsWith('.ico')) {
      const expected = target === 'desktop' ? [16, 24, 32, 48, 64, 256] : [16, 32, 48]
      const sizes = icoSizes(data)
      for (const size of expected)
        assert.ok(sizes.includes(size), `Missing ${size}px ICO frame in ${name}`)
    }
    if (name.endsWith('.icns')) {
      canonicalIcns(data)
    }
  }
  if (target === 'web') {
    const maskable = files.get('brand/pwa-maskable-512.png')
    assert.ok(maskable)
    await validateMaskable(maskable)
  }
}
