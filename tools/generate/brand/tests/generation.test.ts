import { describe, expect, test } from 'bun:test'

import { checkBrandAssets } from '#brand/check'
import { repositoryRoot, webFiles } from '#brand/config'
import { generateDesktop } from '#brand/desktop'
import { canonicalIcns, icoSizes, validateFiles, validateMaskable } from '#brand/validate'
import { generateWeb } from '#brand/web'
import sharp from 'sharp'

const files = await generateWeb(repositoryRoot)

function file(name: string): Buffer {
  const bytes = files.get(name)
  if (!bytes) throw new Error(`Missing ${name}`)
  return bytes
}

describe('brand generation', () => {
  test('produces the web and docs contract, without taking ownership of the PWA manifest', async () => {
    await validateFiles(files, 'web')
    await validateFiles(files, 'docs')
    for (const name of webFiles) expect(files.has(name)).toBe(true)
    expect([...files.keys()].some((name) => name.endsWith('.webmanifest'))).toBe(false)
    expect(icoSizes(file('favicon.ico')).sort((a, b) => a - b)).toEqual([16, 32, 48])
  })

  test('preserves the transparent counter and renders the micro master at 16px', async () => {
    const main = await sharp(file('brand/mark.svg')).ensureAlpha().raw().toBuffer()
    expect(main[(85 * 256 + 128) * 4 + 3]).toBe(0)
    expect(main[(43 * 256 + 64) * 4 + 3]).toBe(255)
    const micro = await sharp(file('brand/mark-micro.svg')).ensureAlpha().raw().toBuffer()
    expect(micro[(5 * 16 + 8) * 4 + 3]).toBe(0)
    expect(micro[(8 * 16 + 4) * 4 + 3]).toBe(255)
    expect(micro.length).toBe(16 * 16 * 4)
  })

  test('keeps the three piece colours in both themes', async () => {
    for (const suffix of ['', '-dark']) {
      const pixels = await sharp(file(`brand/mark${suffix}.svg`))
        .ensureAlpha()
        .raw()
        .toBuffer()
      for (const [x, y, hex] of [
        [68, 26, 'f5501e'],
        [68, 145, 'f5501e'],
        [179, 85, 'ffd43b'],
        [85, 213, '9b5cff']
      ] as const) {
        const offset = (y * 256 + x) * 4
        expect(pixels.subarray(offset, offset + 4).toString('hex')).toBe(`${hex}ff`)
      }
    }
  })

  test('keeps dark-mode favicon styling and the colour mark on dark backgrounds', () => {
    expect(file('brand/favicon.svg').toString()).toContain('prefers-color-scheme: dark')
    // The kit places the colour mark bare on black as well as on white.
    expect(file('brand/mark-dark.svg').equals(file('brand/mark.svg'))).toBe(true)
    expect(file('brand/mark-micro-dark.svg').equals(file('brand/mark-micro.svg'))).toBe(true)
  })

  test('draws the one-colour marks as a flat silhouette in ink and white', async () => {
    for (const suffix of ['', '-dark']) {
      const pixels = await sharp(file(`brand/mark-mono${suffix}.svg`))
        .ensureAlpha()
        .raw()
        .toBuffer()
      const colors = new Set<string>()
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (pixels[offset + 3] === 255)
          colors.add(pixels.subarray(offset, offset + 3).toString('hex'))
      }
      expect([...colors]).toEqual([suffix ? 'ffffff' : '111111'])
    }
  })

  test('shares the ink rounded tile across profile and any-purpose PWA assets', async () => {
    for (const [name, size] of [
      ['brand/app-icon-1024.png', 1024],
      ['brand/favicon-96x96.png', 96],
      ['brand/pwa-192.png', 192],
      ['brand/pwa-512.png', 512]
    ] as const) {
      const { data, info } = await sharp(file(name))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      expect([info.width, info.height]).toEqual([size, size])
      expect(data[3]).toBe(0)
      // No desktop-style inset: the ink reaches the midpoint of each edge.
      for (const [x, y] of [
        [size / 2, 0],
        [0, size / 2],
        [size - 1, size / 2],
        [size / 2, size - 1]
      ]) {
        const edge = (y * size + x) * 4
        expect([...data.subarray(edge, edge + 4)]).toEqual([17, 17, 17, 255])
      }
      const offset = (Math.round((size * 80) / 1024) * size + size / 2) * 4
      expect([...data.subarray(offset, offset + 4)]).toEqual([17, 17, 17, 255])
    }
    const svg = await sharp(file('brand/app-icon.svg')).ensureAlpha().raw().toBuffer()
    const png = await sharp(file('brand/app-icon-1024.png')).ensureAlpha().raw().toBuffer()
    expect(svg.equals(png)).toBe(true)
  })

  test('rejects a transparent maskable icon', async () => {
    await expect(
      validateMaskable(await sharp(file('brand/mark.svg')).resize(512).png().toBuffer())
    ).rejects.toThrow('opaque')
  })

  test('rejects missing and wrong-size output', async () => {
    const missing = new Map(files)
    missing.delete('favicon.ico')
    await expect(validateFiles(missing, 'docs')).rejects.toThrow('Missing brand output')
    const wrong = new Map(files)
    wrong.set('apple-touch-icon.png', file('brand/pwa-512.png'))
    await expect(validateFiles(wrong, 'docs')).rejects.toThrow('apple-touch-icon.png')
  })

  test('validates native icon and StoreLogo dimensions', async () => {
    const desktop = await generateDesktop(repositoryRoot)
    await validateFiles(desktop, 'desktop')
    for (const name of ['icon.png', 'StoreLogo.png']) {
      const wrong = new Map(desktop)
      wrong.set(name, await sharp(file('brand/app-icon.svg')).resize(64, 64).png().toBuffer())
      await expect(validateFiles(wrong, 'desktop')).rejects.toThrow(name)
    }
  }, 30_000)

  test('web output is byte-reproducible across repeated adapter instances', async () => {
    await checkBrandAssets(repositoryRoot, ['web'])
  })

  test('normalizes ICNS frame ordering without changing frame bytes', () => {
    const chunk = (type: string) => {
      const buffer = Buffer.alloc(9)
      buffer.write(type)
      buffer.writeUInt32BE(9, 4)
      buffer[8] = 42
      return buffer
    }
    const a = chunk('ic07'),
      b = chunk('ic08')
    const header = Buffer.alloc(8)
    header.write('icns')
    header.writeUInt32BE(26, 4)
    expect(canonicalIcns(Buffer.concat([header, b, a]))).toEqual(Buffer.concat([header, a, b]))
    expect(() => canonicalIcns(Buffer.from('icns'))).toThrow('header')
    const bad = Buffer.concat([header, a, b])
    bad.writeUInt32BE(0, 12)
    expect(() => canonicalIcns(bad)).toThrow('chunk length')
  })

  test('rejects ICO frames that point outside their container', () => {
    const bad = Buffer.from(file('favicon.ico'))
    bad.writeUInt32LE(bad.length, 18)
    expect(() => icoSizes(bad)).toThrow('bounds')
  })
})
