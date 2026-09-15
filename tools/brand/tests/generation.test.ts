import { describe, expect, test } from 'bun:test'

import { checkBrandAssets } from '#brand/check'
import { repositoryRoot, webFiles } from '#brand/config'
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

  test('preserves transparent counters and draws the optical micro master on its own grid', async () => {
    const main = await sharp(file('brand/mark.svg')).ensureAlpha().raw().toBuffer()
    expect(main[(80 * 256 + 130) * 4 + 3]).toBe(0)
    expect(main[(80 * 256 + 90) * 4 + 3]).toBe(255)
    const micro = await sharp(file('brand/mark-micro.svg')).ensureAlpha().raw().toBuffer()
    expect(micro[(6 * 16 + 8) * 4 + 3]).toBe(0)
    expect(micro[(6 * 16 + 4) * 4 + 3]).toBe(255)
    expect(micro.length).toBe(16 * 16 * 4)
  })

  test('keeps dark-mode favicon styling and separates light/dark UI artwork', () => {
    expect(file('brand/favicon.svg').toString()).toContain('prefers-color-scheme: dark')
    expect(file('brand/mark-dark.svg').equals(file('brand/mark.svg'))).toBe(false)
    expect(file('brand/mark-micro-dark.svg').equals(file('brand/mark-micro.svg'))).toBe(false)
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
